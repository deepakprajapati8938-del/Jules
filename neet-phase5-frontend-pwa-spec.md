# NEET Prep (Jules) — Phase 5 Build Spec: Frontend PWA

**Audience note: written in maximum explicit detail on purpose, because the
coding agent executing this runs on Gemini 3 Pro, which needs concrete,
unambiguous, step-by-step instructions rather than high-level intent. Do
not skip steps. Do not infer requirements not stated here — if something
is ambiguous, stop and ask rather than guessing.**

**Prerequisite: Phase 4 (backend/API layer) should be complete, OR you may
scaffold this frontend against a small set of mock/stub API responses
first and wire up real endpoints once Phase 4 is confirmed ready — your
choice, but tell me which approach you're taking.**

**Governance: read `AGENTS.md` at the repo root before starting, and
follow it — especially the modular-architecture rule (one feature, one
isolated folder; core layer never depends on feature code) and the
mandatory `PROJECT_STATUS.md` read/update cycle.**

---

## Goal of Phase 5
Build the complete frontend PWA covering every Tier 1 feature, using the
tech stack and UI direction locked below. This phase consumes the Phase 4
backend APIs — it does not implement business logic that belongs on the
backend (e.g. streak logic, suggestion ranking, negative-marking
calculation all live in Phase 4; this phase renders and calls them).

Do NOT build in this phase: B.Sc Exam Mode, multi-provider model
switching UI, letters to future/past self, growth timeline, "memory
moments" UI. Those are Tier 2.

---

## Tech stack (locked — do not substitute)
- **Framework:** React + Vite + TypeScript. Do NOT use Next.js — this is
  a single-user PWA with no server-rendering or public-multi-page need;
  Next.js would add deployment/runtime complexity with no benefit here.
- **PWA tooling:** `vite-plugin-pwa` for manifest + service worker
  generation. Do NOT use `next-pwa` (not applicable — we're not on
  Next.js) or a hand-rolled service worker unless `vite-plugin-pwa`
  genuinely can't do something we need — if you hit that wall, stop and
  tell me before hand-rolling.
- **Styling:** Tailwind CSS. Do NOT use Material UI or any other
  full component-library — see the UI direction section below for why.
- **Charts:** Chart.js or Recharts (your choice), lazy-loaded via
  route-level code splitting so the chat screen stays fast.
- **Concept map:** Cytoscape.js or react-force-graph, also lazy-loaded.
- **State:** React state/context is sufficient for this app's size — do
  not introduce Redux or another state-management library unless you hit
  a concrete problem plain state/context can't solve; if so, stop and
  tell me before adding a new dependency.

---

## UI direction (locked — describe, don't copy any specific product's
exact design tokens)

The visual direction is: a clean, minimal, chat-first interface similar
in spirit to a modern AI chat product (think: generous whitespace, calm
neutral background, simple sans-serif type, soft rounded message bubbles,
hairline borders instead of heavy shadows, one blue accent color used
sparingly for primary actions and highlights). This is a general aesthetic
direction, not a pixel-for-pixel clone of any specific branded product —
build your own component styling that fits this description.

**Specific decisions:**
- Background: warm off-white / very light neutral (not stark white, not
  gray).
- Text: dark warm charcoal (not pure black).
- Accent color: a single mid-tone blue, used for primary buttons, active
  states, links, and the send-button. Do not use orange anywhere (this
  was the one explicit change from the original visual reference).
- One exception to "minimal everywhere": the daily affirmation screen
  (Part B below) may have a single soft gradient-orb graphic. No other
  screen gets gradients, glows, or blur effects — this matters for
  performance on the target device (Android, Dimensity 930 chipset,
  mid-range) as much as for visual consistency.
- Corners: rounded (roughly 12-16px for cards, smaller for buttons/pills).
- No sidebar on mobile — use a top bar with a hamburger/menu icon that
  opens a slide-out panel for navigation (chat history, other sections).
- Message bubbles: user messages right-aligned in a filled accent-tinted
  bubble; assistant messages left-aligned, minimal/no background, just
  clean text — this asymmetry is a deliberate part of the chat-interface
  feel.

---

## Part A: Project scaffold

### A1. Folder structure (per AGENTS.md modular rule)
```
src/
  core/           <- API client, shared types, LLM-related shared utilities
  features/
    ncert-chat/
    personal-chat/
    dashboard/
    daily-log/
    tests/
    flashcards/
    reflection-journal/
    streak/
    saved-items/
    concept-map/
    settings/
  app-shell/      <- top bar, navigation, routing
  daily-affirmation/
```
Each feature folder is self-contained: its own components, its own API
calls (via the shared `core` client, not duplicating fetch logic), its
own types. `core/` must never import from any `features/*` folder.

### A2. Core API client
Create `core/api-client.ts` — a thin wrapper around fetch calls to the
Phase 4 backend, with typed request/response shapes matching the Phase 4
schema (personal chat messages, reflection journal entries, streak
state, etc). All feature folders call the backend ONLY through this
client, never with raw fetch calls scattered in components.

---

## Part B: Daily affirmation overlay
- Shown once per day, before the rest of the app loads, on first open of
  the day.
- Displays one line from the existing static affirmation bank
  (30-50 lines, daily rotation — this data already exists per the
  original brief; wire it in here if not already present).
- Include the one soft gradient-orb graphic here (the one visual
  exception noted above).
- Dismissible via a clear "Continue" action.

---

## Part C: App shell
- Top bar: hamburger/menu icon (left), app name (center or left-aligned
  next to menu), a way to start a new chat (right).
- Slide-out navigation panel containing: NCERT Chat, Personal Chat,
  Dashboard, Daily Log, Tests, Flashcards, Reflection Journal, Saved
  Items, Concept Map, Settings.
- Streak indicator visible somewhere persistent (e.g. top bar or nav
  panel) — small, non-intrusive, showing current streak count without
  any "at risk" or urgency styling.

---

## Part D: NCERT Chat screen
- Text input + photo-attach button (for photo-of-question input).
- Message list: user messages right-aligned filled bubbles, assistant
  messages left-aligned plain text per the UI direction above.
- When an assistant answer references a diagram (from Phase 3 data),
  display the diagram image inline near that answer.
- When an assistant answer is a `[NOT FROM NCERT — GENERAL KNOWLEDGE]`
  tagged response (per the original fallback policy), render this
  distinctly — e.g. a small labeled badge above that specific answer —
  so it's visually clear this wasn't textbook-grounded. Do not remove
  this distinction even though Personal Chat now exists as a separate
  outlet — NCERT Chat can still occasionally fall back and must still
  flag it.
- Source citation display: show which chapter/topic the answer was
  grounded in, when applicable (small caption near the answer).
- Interactive widget rendering: when the backend/LLM response includes a
  self-contained interactive HTML/JS component (for numericals or visual
  concepts), render it inside a sandboxed `<iframe>` (using `srcdoc`),
  isolated from the rest of the app. Always show a static-text fallback
  if this content fails to load or errors — never leave a blank space.
- Lazy-load nothing on this screen — it should be the fastest-loading
  screen in the app per the original PWA requirement.

---

## Part E: Personal Chat screen
- Same message-list visual pattern as NCERT Chat, but a clearly different
  context (e.g. a different header/label, so the student always knows
  which chat they're in — this matters since memories never mix).
- No source citations or NCERT-grounding badges here — this is open
  conversation.
- Same interactive-widget rendering capability is not required here
  unless there's a reason to expect numerical content in personal chat
  (likely not needed — skip unless it comes up).

---

## Part F: Dashboard (lazy-loaded)
- Marks-weighted completion (overall + per subject), using
  `chapter_confidence` and `syllabus_config.weightage_marks`.
- Study-time trend chart (from daily log data).
- Confidence-status breakdown (count of chapters in each of the 5 states).
- No rankings, no comparisons, no "you are behind" framing anywhere on
  this screen, per the design principles.

---

## Part G: Daily log entry
- Simple form: subject, chapter, time spent, optional notes. Submits to
  the Phase 4 daily-log endpoint (or the closest existing endpoint —
  confirm naming against what Phase 4 actually implemented).

---

## Part H: Tests (generator + CBT UI + review)
- Test setup screen: choose chapter/subject/custom/mock mode.
- CBT-style test-taking UI: visible timer, question palette showing
  answered/not-answered/marked-for-review states (distinct colors per
  state), "mark for review" action, next/previous navigation.
- On submission: show score with negative marking applied, time spent
  per question, and prompt for a mistake-type tag (silly mistake /
  concept gap / didn't know) on each wrong answer during the review
  screen.

---

## Part I: Flashcards / revision queue
- Card-flip style UI: question/prompt shown, reveal answer on tap,
  then mistake-type-style categorization already tagged from the
  original wrong answer feeds the spaced-repetition scheduling
  (this scheduling logic lives in Phase 4 — this screen just displays
  what's due and records the review outcome).

---

## Part J: Reflection journal
- Evening entry screen: mood selection (4 options, rendered as
  emoji or simple icons — great/good/neutral/low), one-line text input
  for "one small thing you're proud of today."
- A separate view showing past entries and any generated weekly/monthly
  summaries (from Phase 4's `reflection_summaries`).

---

## Part K: Streak / gentle reset ritual
- Normal state: show current streak count, no pressure styling.
- When `pending_reset_ritual` is true (from Phase 4): show a small,
  warm "welcome back" screen offering one tiny action (drink water /
  stretch / smile / take a deep breath / read one NCERT page) as
  selectable options. On selecting one and tapping "done," call the
  Phase 4 endpoint to clear `pending_reset_ritual` — do not show any
  "streak lost" or "failed" messaging at any point in this flow.

---

## Part L: Saved items / favorites
- List view filtered by category (Notes / Revision / Favorites / Read
  Later), showing saved messages/diagrams/answers/images with a way to
  open/view the original and remove it from saved items.

---

## Part M: Concept map (lazy-loaded)
- Tree view by default (chapter > topic > subtopic).
- Toggle to cross-link graph view (Cytoscape.js or react-force-graph).
- Node coloring based on `chapter_confidence` status data.

---

## Part N: Settings
- Syllabus config editor: list of chapters with `included` toggle and
  `weightage_marks` field, editable, saving back to `syllabus_config`.

---

## Part O: Gentle exit message
- Show a brief, warm message (e.g. "see you tomorrow") when the student
  navigates away from or backgrounds the app, if this is technically
  feasible to detect reliably in a PWA context (e.g. via the
  `visibilitychange` event as a best-effort signal). This is a nice-to-
  have polish item — if reliable detection proves difficult, a simpler
  version (e.g. shown when using an explicit in-app "done for today"
  action) is an acceptable fallback. Flag which approach you used.

---

## Part P: PWA configuration
- Manifest: installable, appropriate icons, app name "Jules."
- Service worker (via `vite-plugin-pwa`): cache NCERT markdown content
  and diagram images aggressively (static, rarely changes).
- IndexedDB: local-first storage for chat history, flashcards, test
  results, and daily logs, with background-sync to the backend when
  online.
- Offline behavior: revision features (cached notes/flashcards/past
  chats) work fully offline. New doubt-solving (requires a live Gemini
  call) must clearly show "unavailable offline" — never fail silently
  or hang.
- Background Sync API: queue offline test-attempts and daily-log entries,
  push automatically once back online.
- Route-level code splitting: Dashboard, Tests, Concept Map should be
  lazy-loaded chunks, not part of the initial bundle that loads the chat
  screen.

---

## Explicitly NOT in scope for Phase 5
- B.Sc Exam Mode UI
- Any multi-provider model-switching UI
- Letters to future/past self
- Growth timeline
- "Memory moments" UI
- Mood-aware suggestion UI adjustments

## Definition of done
- All screens in Parts B–O implemented and navigable.
- PWA installs correctly on the target Android device (or an emulator/
  Chrome DevTools PWA check, at minimum) with offline behavior working
  as specified.
- Dashboard/Tests/Concept Map confirmed to be lazy-loaded (check network
  tab / bundle analysis, don't just assume).
- `PROJECT_STATUS.md` regenerated reflecting this phase's completion.

## Things to stop and ask me about
1. If Phase 4 API response shapes don't match what's assumed here, ask
   rather than guessing field names.
2. If `vite-plugin-pwa` genuinely can't achieve a required offline/caching
   behavior, stop and flag it rather than hand-rolling a custom service
   worker silently.
3. Any screen where the "no comparison, no ranking, no pressure" design
   principle seems to conflict with a stated requirement (e.g. showing a
   percentile or leaderboard-like element) — flag it, don't build it.
