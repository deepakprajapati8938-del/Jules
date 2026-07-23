# NEET Prep — Phase 2 Build Spec: Full Syllabus Ingestion + Syllabus Config + PYQ Bank

**Audience note: this spec is written in maximum explicit detail on purpose,
because the coding agent executing it runs on a Gemini model, which needs
concrete, unambiguous, step-by-step instructions rather than high-level
intent. Do not skip steps. Do not infer requirements not stated here — if
something is ambiguous, stop and ask rather than guessing.**

**Prerequisite: Phase 1 must already be complete and validated (one NCERT
chapter successfully ingested into Supabase pgvector, test queries passed,
retrieval + fallback behavior confirmed correct by the human reviewer).
Do not start Phase 2 if Phase 1 has not been explicitly confirmed done.**

---

## Goal of Phase 2
Take the exact same pipeline validated in Phase 1 and:
1. Run it across ALL NCERT chapters (Class 11 + Class 12, Physics +
   Chemistry + Biology) instead of just one chapter.
2. Build the NEET 2027 syllabus config table (a separate, decoupled
   config — not part of content ingestion).
3. Ingest NEET PYQs (2000–2026) using the same chunk/tag/embed pipeline,
   with PYQ-specific metadata.
4. Cross-check PYQ and NCERT chunks against the syllabus config table so
   that content from excluded chapters is flagged/excluded at query time.

Do NOT build: UI, dashboard, diagrams extraction, test generator, or any
of the other 14 features. This phase is content-layer only.

---

## Part A: Scale NCERT ingestion to full syllabus

### A1. Input
- I will provide one PDF per NCERT chapter (Class 11 + 12, Physics +
  Chemistry + Biology). Expect roughly 79 chapters total, but do not
  hardcode this number — read whatever files I actually provide.
- Each PDF filename will indicate subject and chapter (I'll confirm exact
  naming convention before you start, or infer subject/chapter from
  filename in the most obvious way and log your guess for me to check).

### A2. Reuse Phase 1 pipeline exactly, per chapter, in this order:
For EACH chapter PDF, repeat all of these steps in sequence. Do not batch
differently than this unless a step explicitly says to batch:
1. Detect text-based vs scanned (same method as Phase 1).
2. OCR if scanned.
3. Convert to Markdown, preserving heading hierarchy.
4. Save the .md file to a predictable path, e.g.
   `output/ncert_md/{subject}/{chapter_name}.md`
   so I can inspect any chapter's conversion quality individually.
5. Chunk along heading boundaries (topic/subtopic level — same rule as
   Phase 1: not arbitrary token windows).
6. Tag each chunk with metadata:
   - `source_type`: "NCERT"
   - `subject`: Physics / Chemistry / Biology
   - `chapter`: chapter name (exact, consistent naming — this will be
     used later to join against the syllabus config table, so it MUST
     match the `chapter_name` values used in Part B exactly, character
     for character)
   - `topic`: from heading hierarchy
   - `year`: null
7. Embed each chunk via Gemini embedding API.
8. Insert into the same Supabase pgvector table used in Phase 1 (do not
   create a second table — append to the existing one).

### A3. Logging requirement (important)
- After each chapter is processed, log: chapter name, number of chunks
  created, whether OCR was used, and any warnings (e.g. heading
  structure looked ambiguous).
- At the end, print a summary table: one row per chapter, with chunk
  count. I will use this to spot-check for chapters that produced
  suspiciously few or many chunks.

### A4. Failure handling
- If a single chapter's PDF fails to process (corrupt file, OCR
  failure, etc.), log the failure clearly with the chapter name and
  the error, SKIP that chapter, and continue processing the rest.
  Do not let one bad file stop the whole batch.
- At the end, print a list of any chapters that failed, so I can fix
  and re-run just those.

---

## Part B: Syllabus config table

### B1. Where it lives
- Create a new table in the SAME Supabase Postgres instance (not a
  separate database), named `syllabus_config`.
- This table is fully independent of the content chunks table — it
  does NOT get populated by the ingestion pipeline above. It is
  populated once, manually seeded by you (the agent) from the values I
  give below, and then editable later via a settings screen (settings
  screen is a LATER phase, not this one — for now, just get the table
  seeded correctly).

### B2. Exact schema
| Column | Type | Notes |
|---|---|---|
| `id` | serial primary key | auto |
| `chapter_name` | text, not null | MUST exactly match the `chapter` value used in Part A's metadata tagging, so joins work |
| `subject` | text, not null | "Physics" / "Chemistry" / "Biology" |
| `included` | boolean, not null, default true | whether this chapter is in the current NEET 2027 syllabus |
| `weightage_marks` | integer, nullable | marks weightage if known, else null for now |

### B3. Seed data — exact values to use
- Total chapters: 79 (Biology ~35, Chemistry ~30, Physics ~20). Use the
  actual chapter list you generated from the PDFs in Part A to populate
  `chapter_name` and `subject` — do not invent chapter names separately.
- Total marks weightage: Biology 360/720 (50%), Physics 180/720 (25%),
  Chemistry 180/720 (25%). Do NOT try to compute a per-chapter
  `weightage_marks` split algorithmically — leave `weightage_marks` as
  null for individual chapters unless I explicitly give you per-chapter
  numbers later. The 360/180/180 split is a SUBJECT-level total, not a
  per-chapter value — do not divide it evenly across chapters, since
  that would misrepresent actual exam weightage.
- Three Class 11 Biology chapters and three Class 12 Biology chapters
  have already been removed from the NEET 2027 syllabus. I will tell
  you the exact six chapter names before you seed this table — do NOT
  guess which ones they are. If I haven't given you the names yet,
  stop and ask me before seeding, rather than seeding all Biology
  chapters as `included: true`.
- For all chapters other than those six, set `included: true`.

### B4. Validation
- After seeding, print the full contents of `syllabus_config` so I can
  review it before moving to Part C.

---

## Part C: PYQ ingestion

### C1. Input
- I will provide NEET PYQ source material (2000–2026). This may be
  organized differently from NCERT chapters (e.g. by year, not by
  chapter) — do not assume PYQ PDFs are structured like NCERT chapters.
- Detect text-based vs scanned per file, same as Part A.

### C2. Processing
- Convert each PYQ source to Markdown.
- Chunk PYQs at the level of individual questions (one question + its
  answer/explanation, if present, = one chunk). Do not chunk PYQs by
  heading hierarchy the way NCERT chapters are chunked — questions are
  the natural unit here, not topics.
- Tag each PYQ chunk with:
  - `source_type`: "PYQ"
  - `subject`: Physics / Chemistry / Biology (infer from question
    content or source labeling — flag any you're unsure about rather
    than guessing silently)
  - `chapter`: best-guess mapping to an NCERT chapter name from Part
    A's chapter list (this mapping will not be perfect — flag
    low-confidence mappings in a separate log rather than silently
    assigning them)
  - `topic`: if determinable, else null
  - `year`: the year this PYQ is from (required field for PYQs,
    unlike NCERT chunks where it's null)
- Embed and insert into the same content table as NCERT chunks (same
  table, `source_type` column distinguishes them).

### C3. Cross-check against syllabus config (important logic)
- After all PYQs are ingested, run a pass that joins each PYQ chunk's
  `chapter` value against `syllabus_config.chapter_name`.
- For any PYQ chunk whose mapped chapter has `included: false` in
  `syllabus_config`, do ONE of the following (I'll decide which when
  you report back — for now, do the safer option):
  - Add a column `syllabus_excluded` (boolean) to the content chunks
    table if it doesn't already exist, and set it to `true` for these
    rows, rather than deleting them. This way nothing is destroyed,
    and the RAG retrieval step (built in Phase 1) can be updated later
    to filter `WHERE syllabus_excluded = false`.
- Log how many PYQ chunks were flagged as excluded, and from which
  chapters, so I can sanity check this list.

### C4. Retrieval filter (small addition to Phase 1 logic)
- Update the retrieval function from Phase 1 so that it filters out any
  chunk where `syllabus_excluded = true`, for both NCERT and PYQ
  content. Confirm this filter is applied before top-k retrieval, not
  after (i.e. don't retrieve top-5 and then filter down to fewer —
  filter first, then retrieve top-k from what remains).

---

## Explicitly NOT in scope for Phase 2
- Diagram/image extraction (still deferred)
- Any UI or settings screen (deferred — Part B's table just needs to
  exist and be seeded correctly for now)
- Test generator, flashcards, dashboard, or any other feature from the
  main 14-feature list
- Automatic weightage_marks computation per chapter

## Definition of done for Phase 2
- All provided NCERT chapter PDFs ingested, with a summary log of
  chunk counts and any failures.
- `syllabus_config` table created and seeded, contents printed for my
  review.
- All provided PYQ PDFs ingested, tagged, and cross-checked against
  syllabus config, with a log of how many were flagged excluded.
- Retrieval function updated to respect `syllabus_excluded`.
- I run a fresh round of test queries (mix of included-chapter and
  excluded-chapter questions) to confirm excluded content never
  surfaces before we move to Phase 3.

## Things to stop and ask me about (do not guess on these)
1. Exact filenames/naming convention of the PDFs I provide.
2. The exact six Biology chapter names that are excluded from NEET 2027.
3. Any PYQ-to-chapter mapping you're low-confidence on (log these,
   don't silently assign).
