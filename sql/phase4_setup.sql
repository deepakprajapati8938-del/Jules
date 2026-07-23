-- =============================================================================
-- phase4_setup.sql — Jules NEET Prep, Phase 4 schema additions
-- Run this in the Supabase SQL editor (project: zikypzaaqlcifhqzptow)
-- All tables use CREATE TABLE IF NOT EXISTS — safe to re-run.
-- Does NOT touch existing Phase 1-3 tables (neet_chunks, syllabus_config, diagrams).
-- =============================================================================

-- Enable pgvector if not already enabled (safe no-op if already on)
CREATE EXTENSION IF NOT EXISTS vector;


-- ---------------------------------------------------------------------------
-- B1. personal_chat_messages
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS personal_chat_messages (
    id          bigserial PRIMARY KEY,
    role        text        NOT NULL CHECK (role IN ('user', 'assistant')),
    content     text        NOT NULL,
    created_at  timestamptz NOT NULL DEFAULT now()
);


-- ---------------------------------------------------------------------------
-- B2. personal_chat_memory  (vector memory summaries)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS personal_chat_memory (
    id            bigserial PRIMARY KEY,
    summary_text  text        NOT NULL,
    embedding     vector(768),          -- same dim as neet_chunks
    created_at    timestamptz NOT NULL DEFAULT now()
);

-- Similarity-search index for memory retrieval
CREATE INDEX IF NOT EXISTS personal_chat_memory_embedding_idx
    ON personal_chat_memory
    USING ivfflat (embedding vector_cosine_ops)
    WITH (lists = 10);


-- ---------------------------------------------------------------------------
-- B3. chapter_confidence
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS chapter_confidence (
    id            bigserial PRIMARY KEY,
    chapter_name  text        NOT NULL,
    subject       text        NOT NULL,
    status        text        NOT NULL DEFAULT 'not_started'
                  CHECK (status IN ('not_started','learning','revised','comfortable','confident')),
    updated_at    timestamptz NOT NULL DEFAULT now(),
    UNIQUE (chapter_name, subject)
);


-- ---------------------------------------------------------------------------
-- B4. reflection_journal  (one row per day)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS reflection_journal (
    id                  bigserial PRIMARY KEY,
    entry_date          date        NOT NULL UNIQUE,
    mood                text        NOT NULL CHECK (mood IN ('great','good','neutral','low')),
    one_line_reflection text,
    created_at          timestamptz NOT NULL DEFAULT now()
);


-- ---------------------------------------------------------------------------
-- B5. reflection_summaries
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS reflection_summaries (
    id            bigserial PRIMARY KEY,
    period_type   text        NOT NULL CHECK (period_type IN ('weekly','monthly')),
    period_start  date        NOT NULL,
    period_end    date        NOT NULL,
    summary_text  text        NOT NULL,
    created_at    timestamptz NOT NULL DEFAULT now(),
    UNIQUE (period_type, period_start)
);


-- ---------------------------------------------------------------------------
-- B6. streak_state  (single-row table)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS streak_state (
    id                    bigserial PRIMARY KEY,
    current_streak        integer     NOT NULL DEFAULT 0,
    last_active_date      date,
    pending_reset_ritual  boolean     NOT NULL DEFAULT false
);

-- Seed the single row if not already present
INSERT INTO streak_state (current_streak, last_active_date, pending_reset_ritual)
SELECT 0, NULL, false
WHERE NOT EXISTS (SELECT 1 FROM streak_state);


-- ---------------------------------------------------------------------------
-- B7. saved_items
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS saved_items (
    id                bigserial PRIMARY KEY,
    item_type         text        NOT NULL CHECK (item_type IN ('message','diagram','answer','image')),
    source_reference  text        NOT NULL,
    category          text        NOT NULL CHECK (category IN ('notes','revision','favorites','read_later')),
    created_at        timestamptz NOT NULL DEFAULT now()
);


-- ---------------------------------------------------------------------------
-- B8. tests, test_questions, test_attempts, question_attempts
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS tests (
    id            bigserial PRIMARY KEY,
    test_type     text        NOT NULL CHECK (test_type IN ('chapter','subject','custom','mock')),
    subject       text,                           -- NULL for mock/custom
    chapter_name  text,                           -- NULL for subject/mock/custom
    total_marks   integer     NOT NULL DEFAULT 0,
    duration_mins integer     NOT NULL DEFAULT 60,
    created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS test_questions (
    id            bigserial PRIMARY KEY,
    test_id       bigint      NOT NULL REFERENCES tests(id) ON DELETE CASCADE,
    chunk_id      bigint,                         -- reference to neet_chunks.id (nullable for manual)
    question_text text        NOT NULL,
    option_a      text        NOT NULL,
    option_b      text        NOT NULL,
    option_c      text        NOT NULL,
    option_d      text        NOT NULL,
    correct_ans   text        NOT NULL CHECK (correct_ans IN ('A','B','C','D')),
    subject       text        NOT NULL,
    chapter_name  text,
    source_type   text        NOT NULL DEFAULT 'NCERT' CHECK (source_type IN ('NCERT','PYQ')),
    display_order integer     NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS test_attempts (
    id            bigserial PRIMARY KEY,
    test_id       bigint      NOT NULL REFERENCES tests(id) ON DELETE CASCADE,
    started_at    timestamptz NOT NULL DEFAULT now(),
    submitted_at  timestamptz,
    score         numeric(6,2),                   -- computed on submit
    total_marks   integer,
    is_completed  boolean     NOT NULL DEFAULT false
);

CREATE TABLE IF NOT EXISTS question_attempts (
    id                  bigserial PRIMARY KEY,
    test_attempt_id     bigint      NOT NULL REFERENCES test_attempts(id) ON DELETE CASCADE,
    test_question_id    bigint      NOT NULL REFERENCES test_questions(id) ON DELETE CASCADE,
    chosen_ans          text        CHECK (chosen_ans IN ('A','B','C','D')),  -- NULL = unattempted
    is_correct          boolean,
    time_taken_seconds  integer     NOT NULL DEFAULT 0,
    marked_for_review   boolean     NOT NULL DEFAULT false,
    mistake_type        text        CHECK (mistake_type IN ('silly_mistake','concept_gap','didnt_know')),
    UNIQUE (test_attempt_id, test_question_id)
);


-- ---------------------------------------------------------------------------
-- B9. small_wins_shown
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS small_wins_shown (
    id             bigserial PRIMARY KEY,
    milestone_key  text        NOT NULL UNIQUE,
    shown_at       timestamptz NOT NULL DEFAULT now()
);


-- ---------------------------------------------------------------------------
-- RPC: match_personal_memory  (for personal chat memory retrieval)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION match_personal_memory(
    query_embedding vector(768),
    match_count     int DEFAULT 3,
    match_threshold float DEFAULT 0.4
)
RETURNS TABLE (
    id            bigint,
    summary_text  text,
    similarity    float
)
LANGUAGE sql STABLE
AS $$
    SELECT
        pcm.id,
        pcm.summary_text,
        1 - (pcm.embedding <=> query_embedding) AS similarity
    FROM personal_chat_memory pcm
    WHERE pcm.embedding IS NOT NULL
      AND 1 - (pcm.embedding <=> query_embedding) > match_threshold
    ORDER BY pcm.embedding <=> query_embedding
    LIMIT match_count;
$$;


-- ---------------------------------------------------------------------------
-- Summary print (run this SELECT to confirm all tables exist after setup)
-- ---------------------------------------------------------------------------
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN (
    'personal_chat_messages','personal_chat_memory','chapter_confidence',
    'reflection_journal','reflection_summaries','streak_state',
    'saved_items','tests','test_questions','test_attempts',
    'question_attempts','small_wins_shown'
  )
ORDER BY table_name;
