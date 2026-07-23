# AGENTS.md — Standing Instructions for This Project

**Every agent session (CLI, Antigravity 2.0, IDE — any surface) reads this
file automatically before starting work. These rules apply to every task,
not just the current one.**

## Project
NEET Prep PWA ("Jules") — single-user study tool for one NEET UG 2027
aspirant. Full feature list and phase specs live in separate files
(`neet-phase1-...md`, `neet-phase2-...md`, `neet-phase3-...md`, etc.) —
this file governs HOW to work, not WHAT to build.

---

## Rule 1 — Mandatory status file read/update cycle

1. **Before starting ANY task**, read `PROJECT_STATUS.md` at the repo
   root in full. It is the single source of truth for what's done,
   what's pending, and what's blocked. Do not rely on chat memory or
   assumptions from a previous session — read the actual file.
2. **If `PROJECT_STATUS.md` doesn't exist yet**, generate it first by
   inspecting the real repo files and real database state (not from
   memory), before proceeding with whatever was asked.
3. **After finishing ANY task** that changes code, schema, config, or
   any project state — however small — regenerate/update
   `PROJECT_STATUS.md` to reflect the new true state. This is the LAST
   step of every task, done automatically, without being asked each
   time.
4. Never skip step 3. A stale status file is worse than none, because
   it will be trusted by the next session.

---

## Rule 2 — Modular architecture (non-negotiable)

**Goal: adding a new feature must never require touching or risking
already-working features.**

1. **One feature = its own isolated file(s).** Each numbered feature
   from the build brief (RAG chat, daily log, dashboard, test
   generator, flashcards, concept map, etc.) gets its own file/folder.
   Never merge two features' logic into one shared file for
   convenience.
2. **Core layer vs. feature layer — strict one-way dependency.**
   Retrieval (`neet_chunks`, `match_neet_chunks`, embeddings) and
   `syllabus_config` are the CORE layer. Feature modules may READ from
   core, but core must NEVER import or depend on feature-specific code.
   If a change to `retriever.py` is needed only for one feature (e.g.
   flashcards), that logic belongs in the flashcard module, not core —
   stop and reconsider before editing core files for a single feature's
   sake.
3. **Config over hardcoding.** Follow the pattern already used for
   `syllabus_config`: values that might change later (thresholds,
   scoring rules, categories, weightages) go in a config table/file,
   not hardcoded into feature logic.
4. **No file over ~300 lines.** If a script grows past this, split it —
   it's a sign the file is doing more than one job.
5. **Additive schema changes only.** New features add new tables/
   columns. Do not repurpose, rename, or restructure existing
   tables/columns that earlier phases already depend on. If a
   rename/restructure is genuinely necessary, stop and flag it
   explicitly before doing it — never silently refactor shared schema.
6. **Extend logs, don't restructure them.** When adding logging/summary
   output for a new feature, append a new section to existing summary
   patterns rather than changing how older phases already report
   status.
7. **Before starting any new feature**, state in chat which existing
   files/tables it will read from, and confirm it will only make
   additive changes to them (e.g. a new column). If it turns out to
   need to modify existing logic, flag that explicitly first rather
   than proceeding.

---

## Reference
- Tech stack, current schema, and phase-by-phase progress: see
  `PROJECT_STATUS.md` (always current, regenerated per Rule 1).
- What to build in each phase: see the individual phase spec files
  already provided.

---

## Rule 3 — Product design principles (Jules philosophy)

Every feature built from Phase 4 onward must respect these constraints.
When writing any user-facing text (system prompts, UI copy, notifications):

- Never compare the student to anyone else.
- Never show rankings.
- Never say or imply "you are behind."
- Never create urgency/anxiety via countdowns or pressure framing.
- Never force a study schedule — suggestions only, student always decides.
- Never shame a missed day — no "streak lost," "failed," or similar framing.
- Never use fear-based or engagement-manipulation tactics (e.g. guilt
  notifications, fake urgency).
- Nothing is ever auto-marked complete or auto-decided by the AI — chapter
  status, schedules, and priorities are student-controlled; the AI suggests.

These constraints apply to backend-generated text (LLM prompts, summary
generation) as much as to frontend copy.
