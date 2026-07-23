# NEET Prep — Phase 1 Build Spec: Single-Chapter RAG Pipeline

**Give this file to the coding agent as-is. Do not build UI, dashboard, or any
feature beyond what's listed here. This is Phase 1 only — a standalone,
testable pipeline proving the RAG approach works before scaling to the
full syllabus.**

## Context (read first, don't skip)
This is a personal, single-user study tool for one NEET UG 2027 aspirant.
Not a commercial product — optimize for correctness and low cost, not scale.
Full project brief is attached separately for reference; this file narrows
scope to exactly what to build right now.

## Goal of Phase 1
Take ONE NCERT chapter PDF, turn it into a queryable, strictly-grounded
knowledge base, and prove — with real test queries — that:
1. Retrieval pulls the right chunks for a given question.
2. Answers are grounded only in that chapter's content when the answer
   exists there.
3. When the answer does NOT exist in the chapter, the system behaves
   correctly per the fallback policy below (do not skip this — it's the
   most important behavior to validate).

Do not proceed to ingesting the rest of the syllabus, building diagrams
extraction, or any UI until this is validated end-to-end on one chapter.

## Tech constraints
- **Language:** Python
- **Vector store:** Use Supabase Postgres + pgvector (NOT a separate
  ChromaDB instance). Rationale: we already run Supabase for logs/config,
  so consolidating avoids syncing two stores and avoids local-only state
  that can't be inspected remotely. If Supabase pgvector setup is a genuine
  blocker (e.g. extension not enabled on free tier), fall back to ChromaDB
  local and flag it — don't silently switch.
- **Embeddings:** Gemini embedding API.
- **LLM for answering:** Gemini API (pick the current default text model;
  don't hardcode a deprecated model name — check what's current).
- **API key handling:** Single Gemini API key for this phase, with retry/
  backoff on rate-limit errors. Do NOT implement multi-account key
  rotation yet — that's an optimization for later once volume is real,
  and rotating across separate Google accounts on the free tier carries
  ToS risk worth deciding on deliberately later, not baking in now.

## Step-by-step pipeline

### 1. Input check
- Accept one NCERT chapter PDF as input (path provided by me).
- Detect whether it's text-based or scanned (try direct text extraction
  first; if extracted text is near-empty/garbled, treat as scanned).
- If scanned: run OCR first (flag which OCR library you used and why).
- Log which path was taken (text-based vs OCR) so I can verify.

### 2. PDF → Markdown
- Convert to Markdown preserving heading hierarchy: chapter > topic >
  subtopic, using whatever heading cues exist in the source (font size,
  numbering patterns, bold headers — whatever's detectable).
- Output the .md file to disk so I can visually inspect it before
  moving on. Do not proceed to chunking until this file exists and looks
  structurally sane (I'll eyeball it).

### 3. Chunking
- Chunk the Markdown along heading boundaries (topic/subtopic level, not
  arbitrary token windows), so each chunk is a coherent unit of content.
- Keep chunks reasonably sized for embedding (avoid single-sentence
  chunks and avoid multi-page mega-chunks — aim for a subtopic's worth
  of content per chunk).

### 4. Metadata tagging
Tag every chunk with:
- `source_type`: "NCERT" (fixed for this phase)
- `subject`: (Physics/Chemistry/Biology — from the chapter provided)
- `chapter`: chapter name
- `topic`: derived from heading hierarchy
- `year`: null (not applicable — PYQs come later)

### 5. Embed + store
- Generate embeddings via Gemini embedding API for each chunk.
- Store chunk text + metadata + embedding vector in Supabase pgvector.
- Confirm row count matches expected chunk count (log this).

### 6. Retrieval + answer generation
- Build a simple query function: given a question, embed it, retrieve
  top-k chunks (k configurable, default reasonable value like 5) from
  this chapter's data.
- Construct a system prompt that:
  - Answers ONLY from the retrieved context when the answer is present.
  - If the answer is NOT found in the retrieved context, generate the
    answer from general knowledge instead — but the response MUST be
    clearly prefixed/tagged as `[NOT FROM NCERT — GENERAL KNOWLEDGE]`
    (plain text tag is fine for this phase; real UI badge comes later).
  - Never blend the two silently — the model should not merge NCERT
    content and general knowledge into one answer without the fallback
    tag being applied to the general-knowledge portion.

### 7. Test harness
Write a small script (CLI is fine, no UI) that:
- Runs 5–8 test questions I'll provide after reading the chapter myself
  (mix of: answerable from the chapter, and deliberately out-of-scope
  questions to test the fallback behavior).
- Prints, for each question: the retrieved chunks (so I can sanity-check
  relevance), the final answer, and whether the fallback tag was
  correctly applied or withheld.

## Explicitly NOT in scope for this phase
- Diagram/image extraction and captioning
- Any UI (chat interface, dashboard, etc.)
- Syllabus config table
- PYQ ingestion
- Multi-key rotation
- Any of the 14 features from the full brief

## Definition of done for Phase 1
- One chapter fully ingested and queryable.
- Test harness run against my provided questions, output shared with me.
- I confirm retrieval quality and fallback behavior are acceptable before
  we scale to the rest of the syllabus.

## Open decision to flag back to me if hit
- If Supabase pgvector setup has any friction, stop and tell me rather
  than silently working around it.
