-- =============================================================================
-- phase6_facts.sql — Jules NEET Prep, Phase 6 additions (NCERT Facts & Flashcards)
-- Run this in the Supabase SQL editor (project: zikypzaaqlcifhqzptow)
-- =============================================================================

CREATE TABLE IF NOT EXISTS ncert_facts (
    id            bigserial PRIMARY KEY,
    subject       text        NOT NULL,
    chapter_name  text        NOT NULL,
    fact_text     text        NOT NULL,
    fact_type     text        NOT NULL CHECK (fact_type IN ('did_you_know', 'flashcard_concept', 'summary')),
    created_at    timestamptz NOT NULL DEFAULT now()
);

-- Index for fast chapter lookup
CREATE INDEX IF NOT EXISTS ncert_facts_chapter_idx ON ncert_facts (chapter_name);
