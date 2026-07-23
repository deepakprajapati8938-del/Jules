# Jules — Interactive Artifact Rendering Spec

**Audience note: written in maximum explicit detail on purpose, because the
coding agent executing this runs on Gemini 3.1 Pro, which needs concrete,
unambiguous, step-by-step instructions rather than high-level intent. Do
not skip steps. Do not infer requirements not stated here — if something
is ambiguous, stop and ask rather than guessing.**

**Prerequisite: Phases 1–4 must exist (RAG chat, diagram extraction from
Phase 3, and the `call_llm()` wrapper from Phase 4).**

---

## Goal
This spec covers TWO related but distinct interactive-content mechanisms
inside NCERT Chat, plus the shared iframe-rendering/security layer both
depend on:

1. **Numerical/graph widgets** — generated live, per-query, for
   mathematical concepts (e.g. kinematics graphs) where a formula can be
   verified as correct.
2. **Diagram hotspots** — generated once at ingestion time, layered on
   top of the REAL extracted NCERT diagram image (from Phase 3), so the
   underlying image is never AI-regenerated, only the tap-points and
   their explanations are.

Both render through the same sandboxed iframe mechanism (Part A).

---

## Part A: Shared iframe rendering + security mechanics

### A1. How content gets into the iframe
Whatever HTML/JS content is produced (from Part B or Part C below) is
inserted into the page using:
```html
<iframe
  srcdoc="...(the generated HTML/JS content)..."
  sandbox="allow-scripts"
  style="width: 100%; border: none;"
  title="Interactive content"
></iframe>
```

### A2. Sandbox attribute — do not weaken this
Use exactly `sandbox="allow-scripts"` — nothing more. Specifically:
- Do NOT add `allow-same-origin` (this would let the iframe content
  access the parent page's cookies/storage — defeats the point of
  sandboxing).
- Do NOT add `allow-top-navigation` or `allow-popups`.
- The generated content only needs to run its own JS and render its own
  DOM — it does not need any of the other sandbox permissions. If a
  specific interactive feature genuinely seems to need a broader
  permission, stop and ask before adding it — don't loosen this by
  default.

### A3. Success/failure signal (so the app knows whether to show a
fallback)
The generated HTML/JS (both Part B and Part C content) must include this
exact pattern at the end of its script:
```javascript
try {
  // ... widget's own rendering/setup logic runs above this point ...
  window.parent.postMessage({ type: 'widget-ready' }, '*');
} catch (e) {
  window.parent.postMessage({ type: 'widget-error', message: String(e) }, '*');
}
```
The parent page (the React app) must:
1. Listen for `message` events.
2. Start a timeout (e.g. 4 seconds) when the iframe is inserted.
3. If a `widget-ready` message arrives before the timeout: show the
   iframe normally.
4. If a `widget-error` message arrives, OR the timeout elapses with no
   message at all (covers cases where the script crashed before even
   reaching the try/catch, or CDN resources failed to load): hide the
   iframe and show the static-text fallback instead (the plain-language
   explanation that should always accompany the generated widget — see
   Part B2 and Part C4 for where this fallback text comes from in each
   case).
5. Never leave a blank space if neither signal arrives — the fallback
   text is the safety net.

---

## Part B: Numerical/graph widgets (generated live, per query)

### B1. Scope — do not make this fully open-ended
Only attempt to generate an interactive widget when the student's
question falls into a pre-approved category where the underlying
formula/relationship is simple and verifiable. Start with this list
only:
- Kinematics (velocity-time, position-time graphs; `v = u + at` and
  related equations)
- Simple circuits (Ohm's law, `V = IR`, series/parallel resistance)
- Basic projectile motion (no air resistance)
- Titration curves (pH vs. volume added, standard weak/strong
  acid-base curves)

For any question outside this list, do NOT attempt to generate an
interactive widget — respond with a normal text/RAG-grounded answer
only. This list can be expanded later after spot-checking new
categories, but do not expand it unilaterally while building this
phase — flag if a common question type seems to need a new category
added.

### B2. Generation flow
1. After determining the query matches an approved category, call
   `call_llm()` (the Phase 4 wrapper — do not call Gemini directly) with
   a prompt that asks for TWO separate things in a structured format
   (e.g. JSON with two fields) so they can be handled independently:
   - `explanation`: a plain-text answer to the student's question
     (this is the fallback text, and is shown regardless of whether the
     widget succeeds).
   - `widget_html`: a self-contained HTML/JS snippet implementing the
     interactive component (following the iframe/postMessage pattern
     from Part A3), using a charting library loaded via CDN (Chart.js
     is fine, matching what's already used in the static dashboard
     charts).
2. Always store and display `explanation` as the primary answer text.
   The widget is a supplementary visual, not a replacement for the
   text answer.
3. Render `widget_html` in the sandboxed iframe per Part A. If it fails
   (per A3's fallback logic), the student still has the `explanation`
   text — nothing is ever missing entirely.

---

## Part C: Diagram hotspots (generated once, at ingestion time)

### C1. New table: `diagram_hotspots`
| Column | Type | Notes |
|---|---|---|
| `id` | bigserial primary key | |
| `diagram_id` | bigint, not null | references the Phase 3 diagram record (image_path/caption/etc table) |
| `part_label` | text, not null | e.g. `"Nucleus"` |
| `x_pct` | float, not null | horizontal position as a percentage (0-100) of image width |
| `y_pct` | float, not null | vertical position as a percentage (0-100) of image height |
| `explanation` | text, not null | short explanation for this part |
| `confidence` | text, not null | `"high"` or `"low"` |
| `reviewed` | boolean, not null, default false | |

Using percentage coordinates (not pixel coordinates) makes this
resolution-independent — works regardless of what size the image is
displayed at.

### C2. Which diagrams get hotspots
Not every extracted diagram has discrete labeled parts worth making
interactive (e.g. a simple graph or a single-concept illustration
doesn't need this — hotspots make sense for things like anatomy/cell/
apparatus diagrams with multiple distinct labeled components). Before
running hotspot generation on a diagram, do a quick classification pass
(can be part of the same LLM call in C3 — ask it to also indicate
whether this image has multiple distinguishable labeled parts worth
making interactive; if not, skip hotspot generation for that image
entirely and it will just display as a static image, same as originally
planned in Phase 3).

### C3. Generation process (run once, at ingestion time, not per chat query)
For each diagram from Phase 3 that passes the classification in C2:
1. Call `call_llm()` (Gemini Vision-capable call) with: the diagram
   image, its existing Phase 3 caption, and the nearby NCERT text chunk
   it's linked to (for grounding — explanations should draw from this
   real textbook text where possible, not be invented purely from the
   image).
2. Ask it to identify each visually distinguishable labeled part, its
   approximate position as a percentage of image width/height, and a
   short (1-2 sentence) explanation grounded in the provided NCERT text.
3. Insert one row per identified part into `diagram_hotspots`, with
   `confidence` set to `"low"` if the position seems approximate/
   uncertain (multiple overlapping parts, unclear boundaries) or
   `"high"` otherwise, and `reviewed = false`.

### C4. Manual review (required, same pattern as Phase 3's diagram-
linking review and the concept-map's edge review)
- Build a simple review step (script or minimal in-app screen — your
  choice, same as the concept-map spec's approach; tell me which).
- Only `reviewed = true` hotspots are ever shown to the student.
  Diagrams with no reviewed hotspots yet simply display as a plain
  static image (Phase 3's original behavior) — this is the fallback,
  not a broken state.

### C5. Frontend rendering
- If a diagram has reviewed hotspots: render the image with small
  tappable markers positioned via `x_pct`/`y_pct` (absolute-positioned
  elements over the image, not an iframe in this case — this part
  doesn't need iframe sandboxing since it's just positioned markers
  over a real static image with plain-text explanations, no generated
  executable code involved). Tapping a marker shows its `explanation`.
- If a diagram has no reviewed hotspots: render it as a plain static
  image, same as originally planned.

---

## Explicitly NOT in scope
- Expanding the Part B category allowlist beyond the four listed
  categories without explicit approval.
- Generating hotspots for diagram types that don't have discrete
  labeled parts (graphs, single-concept illustrations).
- Any interactive widget generation inside Personal Chat (not needed
  there per Phase 5).
- Redrawing/regenerating diagrams from scratch via AI — the real
  extracted image is always the visual source of truth for diagrams;
  only numerical/graph widgets (Part B) are AI-generated visuals from
  scratch, and only within the approved category list.

## Definition of done
- Iframe sandbox + postMessage + timeout-fallback mechanism implemented
  and working for both Part B and Part C content.
- Part B: widget generation works for the four approved categories, always
  paired with a text explanation, with fallback confirmed working (test
  by deliberately breaking a generated widget and confirming the
  fallback text still shows).
- Part C: `diagram_hotspots` table populated for eligible diagrams, with
  working manual review, and frontend correctly falls back to a plain
  static image when no reviewed hotspots exist.
- `PROJECT_STATUS.md` updated per `AGENTS.md`.

## Things to stop and ask me about
1. If a common student question doesn't fit any of the four Part B
   categories but clearly would benefit from a widget, flag it rather
   than expanding the list yourself.
2. If the postMessage timeout value (4 seconds) feels wrong once tested
   on the actual target device (Moto G73), flag it rather than silently
   changing it.
3. Whether the diagram-hotspot review step is a script or in-app screen —
   tell me which you built, don't leave it ambiguous.
