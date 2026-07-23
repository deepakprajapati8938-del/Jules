# NEET Prep (Jules) — Phase 4 Build Spec: Backend/API Layer for Tier 1 Features

**Audience note: written in maximum explicit detail on purpose, because the
coding agent executing this runs on Gemini 3 Pro, which needs concrete,
unambiguous, step-by-step instructions rather than high-level intent. Do
not skip steps. Do not infer requirements not stated here — if something
is ambiguous, stop and ask rather than guessing.**

**Prerequisite: Phases 1–3 must already be complete (NCERT + PYQ ingested,
syllabus config seeded, diagrams extracted/captioned/linked). Do not start
this phase until that is confirmed.**

**Governance: this project has an `AGENTS.md` at the repo root. Read it
before starting. It requires (a) reading and updating `PROJECT_STATUS.md`
before/after every task, and (b) strict modular architecture — one
feature, one isolated file/module, core layer never depends on feature
code. Follow both rules for everything built in this phase.**

---

## Goal of Phase 4
Build the backend data models and API layer for every Tier 1 feature that
is NOT the RAG/NCERT content pipeline (already built) and NOT the UI
(that's Phase 5). This phase is: schema + business logic + API endpoints
only. No frontend code.

Do NOT build in this phase: any UI, B.Sc exam mode, multi-provider AI
abstraction, letters to future/past self, growth timeline, "memory
moments," or mood-aware suggestion adjustments. Those are Tier 2 —
explicitly deferred.

---

## Part 0: Append design principles to AGENTS.md

Before writing any feature code, append the following new section to the
project's EXISTING `AGENTS.md` file (do not overwrite the rest of the
file — only add this section at the end):

```markdown
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
```

---

## Part A: LLM wrapper module (build this first — everything else uses it)

### A1. Purpose
Every LLM call in this project (NCERT chat, Personal Chat, reflection
summaries, suggestion generation if it uses an LLM) must go through ONE
shared wrapper function, not call the Gemini SDK directly in each feature
file. This is so a future provider swap is a one-file change.

### A2. Location and interface
Create `core/llm_wrapper.py` (or equivalent path matching existing project
structure — check where Phase 1–3 code already calls Gemini and place
this at the same architectural layer). Expose a single function:

```python
def call_llm(system_prompt: str, user_prompt: str, context: str = None) -> str:
    """
    Single entry point for all Gemini text-generation calls in this project.
    Do not call the Gemini SDK directly anywhere else in the codebase —
    route every LLM call through this function.
    """
```

### A3. Requirements
- Uses the existing single Gemini API key (no multi-key rotation — that
  was explicitly deferred).
- Includes retry-with-backoff on rate-limit (429) errors, same pattern
  already used in Phase 1–3 ingestion scripts — reuse that logic if it
  already exists as a shared utility, don't duplicate it.
- Do NOT add any other provider (Groq/OpenAI/OpenRouter) — this wrapper
  has exactly one implementation path (Gemini) for now. The function
  signature should be provider-agnostic (no Gemini-specific parameter
  names leaking into the interface) so that IF a provider is added later,
  it's a change inside this one file, not a change to every caller.

### A4. Existing NCERT chat migration
If the existing Phase 1–3 RAG chat code calls Gemini directly (not
through a shared wrapper), refactor it to call `call_llm()` instead, as
part of this phase. Confirm this refactor doesn't change NCERT chat's
existing behavior (still grounded-only-in-context, still has the
NCERT/general-knowledge distinction) — this is a structural refactor, not
a behavior change.

---

## Part B: Schema additions

All new tables go in the same Supabase Postgres instance already in use.
Use `CREATE TABLE IF NOT EXISTS` for all of these. Print the full list of
newly created tables at the end for review.

### B1. `personal_chat_messages`
| Column | Type | Notes |
|---|---|---|
| `id` | bigserial primary key | |
| `role` | text, not null | `"user"` or `"assistant"` |
| `content` | text, not null | |
| `created_at` | timestamptz, default now() | |

### B2. `personal_chat_memory`
| Column | Type | Notes |
|---|---|---|
| `id` | bigserial primary key | |
| `summary_text` | text, not null | short (2–4 sentence) memory summary |
| `embedding` | vector(768) | same embedding model as NCERT chunks — confirm dimension matches |
| `created_at` | timestamptz, default now() | |

**Critical isolation rule:** this table is completely separate from
`neet_chunks`. Personal Chat memory retrieval must ONLY query this table.
NCERT chat retrieval must ONLY query `neet_chunks`. Do not write a shared
retrieval function that queries both — write two separate, clearly named
functions (e.g. `retrieve_ncert_context()` and
`retrieve_personal_memory()`) even though the underlying vector-similarity
logic is similar, so there is no code path where the two could ever be
accidentally merged.

### B3. `chapter_confidence`
| Column | Type | Notes |
|---|---|---|
| `id` | bigserial primary key | |
| `chapter_name` | text, not null | must match `syllabus_config.chapter_name` |
| `subject` | text, not null | |
| `status` | text, not null, default `'not_started'` | one of: `not_started`, `learning`, `revised`, `comfortable`, `confident` — enforce via a CHECK constraint |
| `updated_at` | timestamptz, default now() | |

This is updated ONLY by explicit user action (a button tap changing
status). Never set or change this automatically based on test scores or
any other signal — that would violate the "student controls everything"
principle.

### B4. `reflection_journal`
| Column | Type | Notes |
|---|---|---|
| `id` | bigserial primary key | |
| `entry_date` | date, not null, unique | one entry per day |
| `mood` | text, not null | one of: `great`, `good`, `neutral`, `low` (map to emoji in frontend, not stored as emoji) |
| `one_line_reflection` | text, nullable | the "one small thing you're proud of today" answer |
| `created_at` | timestamptz, default now() | |

### B5. `reflection_summaries`
| Column | Type | Notes |
|---|---|---|
| `id` | bigserial primary key | |
| `period_type` | text, not null | `"weekly"` or `"monthly"` |
| `period_start` | date, not null | |
| `period_end` | date, not null | |
| `summary_text` | text, not null | AI-generated |
| `created_at` | timestamptz, default now() | |

### B6. `streak_state`
| Column | Type | Notes |
|---|---|---|
| `id` | bigserial primary key | single row table — only ever one record |
| `current_streak` | integer, not null, default 0 | |
| `last_active_date` | date, nullable | |
| `pending_reset_ritual` | boolean, not null, default false | true when a day was missed and the gentle reset hasn't been completed yet |

### B7. `saved_items`
| Column | Type | Notes |
|---|---|---|
| `id` | bigserial primary key | |
| `item_type` | text, not null | `"message"`, `"diagram"`, `"answer"`, `"image"` |
| `source_reference` | text, not null | ID or path pointing to the original item |
| `category` | text, not null | `"notes"`, `"revision"`, `"favorites"`, `"read_later"` |
| `created_at` | timestamptz, default now() | |

### B8. `tests`, `test_questions`, `test_attempts`, `question_attempts`
Design these to support: chapter tests, subject tests, custom tests, mock
tests, negative marking, timer, mark-for-review, time-per-question, and
mistake-type tagging. Specifically ensure `question_attempts` (or
equivalent) has fields for:
- `is_correct` (boolean)
- `time_taken_seconds` (integer)
- `marked_for_review` (boolean)
- `mistake_type` (text, nullable — one of `silly_mistake`, `concept_gap`,
  `didnt_know`, set only when the answer was wrong)

Base the exact schema on whatever test-related tables (if any) already
exist from earlier phases — extend rather than duplicate if something
already exists. If nothing exists yet, design these fresh but keep them
in their own module/file per the modular architecture rule.

### B9. `small_wins_shown`
| Column | Type | Notes |
|---|---|---|
| `id` | bigserial primary key | |
| `milestone_key` | text, not null, unique | e.g. `"first_chapter"`, `"first_mock"`, `"first_week_streak"` |
| `shown_at` | timestamptz, default now() | |

Purpose: prevents celebrating the same milestone twice. Milestones
themselves are computed on-demand from existing data (daily logs, test
attempts, streak state) — this table only tracks which have already been
shown to the user.

---

## Part C: Personal Chat backend logic

### C1. Message handling
- Save every user and assistant message to `personal_chat_messages`.
- Before generating a response, retrieve the top 3 most relevant entries
  from `personal_chat_memory` (via embedding similarity on the new user
  message) and include them in the prompt passed to `call_llm()` as
  context, for conversational continuity.

### C2. Memory generation (when to create a new memory entry)
- After every 20 new messages in Personal Chat (10 user + 10 assistant,
  or however you count — just pick a consistent definition and log it),
  OR once every 24 hours if there has been any Personal Chat activity
  since the last memory was generated (whichever comes first):
  1. Gather the recent messages since the last memory entry.
  2. Call `call_llm()` with a system prompt like: "Summarize the key
     ongoing facts, goals, or emotional context from this conversation
     in 2-4 sentences, written for future reference. Do not include
     marks, scores, or comparisons. Focus on what matters for continuity
     of care and conversation."
  3. Embed the resulting summary and store it in `personal_chat_memory`.

### C3. System prompt for Personal Chat responses
Use a system prompt along these lines (adapt as needed, but preserve the
intent): "You are a warm, supportive companion for a student preparing
for an exam. This is a space for general conversation, motivation,
planning, and emotional support — not academic doubt-solving (that
happens in a separate chat). Never compare the student to others, never
say they are behind, never use guilt or pressure. Be genuinely warm and
specific, not generic."

---

## Part D: Reflection journal backend

### D1. Daily entry
- Simple upsert into `reflection_journal` keyed on `entry_date` — one
  entry per day, editable if the student updates it same-day.

### D2. Weekly/monthly summary generation
- Triggered either on a schedule (e.g. a cron-style check: if today is
  the start of a new week/month and last week's/month's entries haven't
  been summarized yet) or on-demand when the student views the summary
  screen and one doesn't exist yet for the completed period.
- Gather all `reflection_journal` entries in that period.
- Call `call_llm()` with a system prompt like: "Write a short (3-5
  sentence), warm summary of this student's week/month based on their
  daily mood and reflections. Focus on effort, consistency, and personal
  growth. Never mention marks, scores, or rankings. Never say they fell
  behind or should try harder. This is about who they're becoming, not
  what they've achieved."
- Store result in `reflection_summaries`.

---

## Part E: Streak → gentle reset logic

### E1. On each day the student has any logged activity (daily log entry,
test attempt, or chat use — pick whichever signal(s) already exist and
are simplest to check)
- If `last_active_date` is yesterday or today: increment/maintain
  `current_streak` normally, update `last_active_date`.
- If `last_active_date` is more than 1 day ago (a day was missed): do
  NOT reset `current_streak` to 0 immediately. Instead, set
  `pending_reset_ritual = true`. The streak count stays as-is until the
  ritual is addressed.

### E2. Reset ritual flow
- When `pending_reset_ritual` is true, the next time the student opens
  the app, the frontend (Phase 5) will show a small "welcome back" moment
  with one tiny action to choose (drink water / stretch / smile / take a
  deep breath / read one NCERT page). This phase only needs to provide:
  - An endpoint to fetch `pending_reset_ritual` status.
  - An endpoint to mark it complete: sets `pending_reset_ritual = false`
    and updates `last_active_date` to today, WITHOUT resetting
    `current_streak` to 0. (Continuity is the goal, not punishing the
    gap — per the design principles in Part 0.)

---

## Part F: Confidence tracking backend
- Simple CRUD endpoint: update `chapter_confidence.status` for a given
  chapter, only in response to an explicit frontend action (a user
  tapping a status button). No automatic status changes from any other
  part of the system.

---

## Part G: Suggestion engine

### G1. Logic (no LLM required for the core ranking — keep this simple
and deterministic, not another AI call, unless you have a specific
reason an LLM pass adds value here)
Combine these signals into a ranked list of suggested topics/chapters:
1. Chapters with `chapter_confidence.status` of `not_started` or
   `learning` — weighted toward the top.
2. Chapters with higher `syllabus_config.weightage_marks` where
   available (fall back to subject-level weighting — Biology 50%,
   Physics 25%, Chemistry 25% — if per-chapter weightage isn't set).
3. Topics with recent wrong answers (from `question_attempts` /
   flashcard data) — weighted toward the top as "needs revision."
4. PYQ frequency for a topic, if that data is available from Phase 2's
   PYQ ingestion.

### G2. Output
- Return a short ranked list (e.g. top 3-5 suggestions) via an API
  endpoint. This is a suggestion only — do not build any mechanism that
  forces or auto-schedules the student into these topics.

---

## Part H: Save/Favorites backend
- Simple CRUD for `saved_items`: create (save an item with a category),
  list (filtered by category), delete.

---

## Part I: Test generator backend
- Endpoints to: generate a test (chapter/subject/custom/mock, pulling
  from NCERT+PYQ bank per existing content tables, respecting
  `syllabus_excluded` filtering from Phase 2), submit answers, compute
  score with negative marking, record time-per-question, record
  mark-for-review flags, and accept a mistake-type tag per wrong answer
  after the test is reviewed.
- Negative marking: use standard NEET scoring (+4 correct, -1 incorrect,
  0 unattempted) unless a different scheme is specified elsewhere in the
  project's config — check `syllabus_config` or any existing scoring
  config before hardcoding, and if none exists, use the standard NEET
  scheme and log that this was the default assumption.

---

## Explicitly NOT in scope for Phase 4
- Any frontend/UI code (Phase 5)
- B.Sc Exam Mode
- Multi-provider AI abstraction
- Letters to future/past self
- Growth timeline
- "Memory moments" recall feature
- Mood-aware adjustment of suggestions (Part G stays signal-based only,
  not mood-adjusted, for now)

## Definition of done
- All schema additions created and confirmed via a printed list.
- `call_llm()` wrapper built and existing NCERT chat refactored to use it.
- All Part C–I endpoints implemented and individually testable (e.g. via
  simple script calls or a test harness, no UI needed yet).
- `AGENTS.md` updated with the Part 0 section.
- `PROJECT_STATUS.md` regenerated reflecting everything built in this
  phase, per the AGENTS.md rule.

## Things to stop and ask me about
1. If existing test-related tables already exist from an earlier phase
   that weren't covered in this spec, confirm before creating
   potentially duplicate tables.
2. If the "activity signal" for streak tracking (Part E1) isn't obvious
   from existing code, ask rather than picking one arbitrarily.
3. Any place where NCERT and Personal Chat memory retrieval logic would
   need to share code — flag this before merging them, since isolation
   between the two is a hard requirement, not a preference.
