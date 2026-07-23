# Jules — Concept Map Feature Spec

**Audience note: written in maximum explicit detail on purpose, because the
coding agent executing this runs on Gemini 3.1 Pro, which needs concrete,
unambiguous, step-by-step instructions rather than high-level intent. Do
not skip steps. Do not infer requirements not stated here — if something
is ambiguous, stop and ask rather than guessing.**

**Prerequisite: Phases 1–3 (NCERT content ingested with heading hierarchy
metadata) and Phase 4 (`chapter_confidence`, `question_attempts` tables)
must already exist. Do not start this until confirmed.**

---

## Goal
Build the Concept Map feature: a default tree view (chapter > topic >
subtopic) built entirely from data that already exists, plus a toggleable
cross-link graph view showing how topics connect across chapters/subjects
(new data, generated once at ingestion time), with both views color-coded
using existing confidence/test data.

This spec covers backend (data + one-time ingestion pass) and frontend
(rendering) for this one feature only.

---

## Part A: Tree view — no new data needed

### A1. Source of truth
The tree structure (chapter > topic > subtopic) already exists as
metadata on every row in `neet_chunks` (the `chapter` and `topic` fields
set during Phase 1–3 ingestion, derived from the original Markdown
heading hierarchy).

### A2. What to build
- A query that gets the distinct chapter → topic → subtopic hierarchy
  from `neet_chunks` metadata (group by subject, chapter, topic — and
  subtopic if that level exists as a separate field; if subtopic isn't
  a distinct stored field and is only implicit in how topics were
  chunked, use topic as the leaf level instead — check what actually
  exists before assuming a 3-level hierarchy).
- No new table, no new ingestion step, no LLM call for this part. This
  is purely a read/reshape of existing data into a tree structure for
  the frontend to render.

---

## Part B: Cross-link graph — new data, one-time ingestion pass

### B1. New table: `concept_edges`
| Column | Type | Notes |
|---|---|---|
| `id` | bigserial primary key | |
| `topic_a` | text, not null | must match a `topic` value already used in `neet_chunks` |
| `topic_b` | text, not null | same — the topic this one connects to |
| `relationship_note` | text, nullable | short note on why they connect (from the LLM call) |
| `reviewed` | boolean, not null, default false | set to true only after human review |
| `created_at` | timestamptz, default now() | |

### B2. Generation process (run once per topic, at ingestion time — not
per chat query, not repeated on every app load)
For each distinct topic found in `neet_chunks`:
1. Call the shared `call_llm()` wrapper (built in Phase 4 — do not call
   Gemini directly here, route through the same wrapper as everything
   else) with a prompt like: "Given the NEET topic '{topic}' from
   {subject}, list other topics (possibly from different chapters or
   subjects) that this concept connects to or depends on
   conceptually. For each, give the topic name and a one-sentence
   reason. Only include genuinely meaningful, specific connections —
   not generic ones like 'requires basic understanding of chemistry.'"
2. Parse the response into individual topic-pairs and insert one row
   per connection into `concept_edges`, with `reviewed = false`.
3. Log progress (e.g. every 10 topics processed) since this could be a
   fair number of LLM calls — reuse the same rate-limit/backoff pattern
   already used elsewhere in the project.

### B3. Manual review step (required before edges are used anywhere)
- Build a simple review interface — this can be as basic as a script
  that prints each unreviewed edge (`topic_a`, `topic_b`,
  `relationship_note`) one at a time and accepts a keep/discard input,
  OR a minimal admin-only screen in the app if that's easier given the
  existing settings screen pattern. Either is fine — pick whichever is
  simpler to build, but tell me which you built.
- On "keep": set `reviewed = true`.
- On "discard": delete the row (or set a `rejected` flag instead of
  deleting, your choice — deleting is simpler and fine here since
  there's no other data referencing these rows yet).
- **Only `reviewed = true` edges are ever shown in the actual graph
  view in the app.** Unreviewed edges sit in the queue and are invisible
  to the student until reviewed. This is a hard requirement — do not
  render unreviewed edges "for now" as a placeholder; skip them
  entirely until reviewed.

---

## Part C: Node coloring (both tree and graph views)

### C1. Primary signal — confidence status
Use the existing `chapter_confidence.status` field (from Phase 4:
`not_started`, `learning`, `revised`, `comfortable`, `confident`) as the
primary color signal for every node. This is the ONLY confidence system
in the app — do not reintroduce a separate 3-state
"covered/weak/not-started" scheme; that was an earlier, now-superseded
idea from before Phase 4 existed. Map the 5 states to a color gradient
(you choose 5 visually distinct-but-related shades — e.g. a single hue
ramping from light/muted for `not_started` to fully saturated for
`confident` — consistent with whatever color tokens the rest of the app
already uses).

Note: `chapter_confidence` is tracked per chapter, but concept map nodes
are at the topic (and possibly subtopic) level. For a topic's color,
use its parent chapter's confidence status unless/until a more granular
topic-level confidence tracking exists — do not invent new granular
confidence data for this feature; reuse what's there.

### C2. Secondary signal — "weak" indicator
Separately from the primary color, add a small secondary visual
indicator (e.g. a small dot or outline — your choice of exact styling)
on any topic where `question_attempts` data shows a high recent
wrong-answer rate. This is a secondary/optional layer on top of the
primary confidence color, not a replacement for it — a topic can be
`comfortable` in confidence but still show the weak-indicator if recent
test performance on it has been poor, since those two signals can
genuinely disagree and both are useful to show.

---

## Part D: Rendering

### D1. Library
Use Cytoscape.js or react-force-graph (your choice) — required
specifically because a plain tree-rendering library cannot handle
cross-links (a topic connecting to multiple non-parent topics, not a
strict single-parent hierarchy). Do not attempt to force this into a
simple tree UI component.

### D2. View toggle
- Default view: tree (chapter > topic > subtopic), using Part A's data.
- Toggle control: switches to the cross-link graph view, using Part A's
  nodes plus Part B's reviewed edges layered on top.
- Both views use the same node coloring logic from Part C.

### D3. Loading
This screen must be lazy-loaded (route-level code split), consistent
with the existing PWA requirement that Dashboard/Concept Map/other
heavy screens don't block the initial chat-screen load.

---

## Explicitly NOT in scope
- Auto-generated concept animations (permanently deferred per the
  original brief's V2 section — not part of this feature at all)
- Per-topic (as opposed to per-chapter) confidence tracking — out of
  scope unless explicitly requested later
- Real-time/on-query cross-link generation — links are generated once
  at ingestion time only, never computed live during normal app use

## Definition of done
- Tree view renders correctly from existing metadata, no new data
  required.
- `concept_edges` table populated via the one-time LLM pass, with a
  working review step, and only reviewed edges reaching the frontend.
- Both tree and graph views color nodes using `chapter_confidence` (via
  parent chapter) plus the secondary weak-indicator from
  `question_attempts`.
- Screen is lazy-loaded.
- `PROJECT_STATUS.md` updated per `AGENTS.md`'s standing rule.

## Things to stop and ask me about
1. If `neet_chunks` metadata doesn't actually have a distinct subtopic
   level (only chapter + topic), confirm before deciding the tree stops
   at topic level.
2. Whether the manual review step should be a CLI script or an in-app
   screen — pick the simpler option, but tell me which, don't guess
   silently on something this visible.
3. Exact color values for the 5-state confidence gradient — pick
   something consistent with the app's existing palette, but flag the
   choice for review rather than assuming it's final.
