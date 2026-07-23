-- ============================================================
-- NEET Phase 2 — Database Schema Update
-- Run this file in the Supabase SQL Editor.
-- ============================================================

-- 1. Add syllabus exclusion column to existing neet_chunks table
ALTER TABLE neet_chunks
ADD COLUMN IF NOT EXISTS syllabus_excluded BOOLEAN NOT NULL DEFAULT false;

-- 2. Create the syllabus_config table
CREATE TABLE IF NOT EXISTS syllabus_config (
    id              SERIAL PRIMARY KEY,
    chapter_name    TEXT NOT NULL,
    subject         TEXT NOT NULL,
    included        BOOLEAN NOT NULL DEFAULT true,
    weightage_marks INTEGER
);

-- Ensure chapter_name is unique so we don't insert duplicates when seeding
ALTER TABLE syllabus_config ADD CONSTRAINT unique_chapter_name UNIQUE (chapter_name);

-- 3. Update the matching RPC function to enforce syllabus_excluded = false
-- This happens BEFORE the top-k match count limit.
CREATE OR REPLACE FUNCTION match_neet_chunks(
    query_embedding   VECTOR(768),
    match_threshold   FLOAT   DEFAULT 0.5,
    match_count       INT     DEFAULT 5
)
RETURNS TABLE (
    id          BIGINT,
    content     TEXT,
    metadata    JSONB,
    similarity  FLOAT
)
LANGUAGE sql
STABLE
AS $$
    SELECT
        nc.id,
        nc.content,
        nc.metadata,
        1 - (nc.embedding <=> query_embedding) AS similarity
    FROM neet_chunks nc
    WHERE 
        1 - (nc.embedding <=> query_embedding) > match_threshold
        AND nc.syllabus_excluded = false
    ORDER BY nc.embedding <=> query_embedding
    LIMIT match_count;
$$;
