-- ============================================================
-- NEET Phase 1 — Supabase pgvector Setup
-- Run this entire file in the Supabase SQL Editor ONCE.
-- ============================================================

-- Step 1: Enable the pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Step 2: Create the chunks table
-- embedding vector is 768-dim (gemini-embedding-2 with output_dimensionality=768)
CREATE TABLE IF NOT EXISTS neet_chunks (
    id          BIGSERIAL PRIMARY KEY,
    content     TEXT        NOT NULL,
    metadata    JSONB       NOT NULL DEFAULT '{}',
    embedding   VECTOR(768),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Step 3: Create an HNSW index for fast cosine-similarity search
-- HNSW is preferred over IVFFlat for small datasets (no minimum row requirement)
CREATE INDEX IF NOT EXISTS neet_chunks_embedding_idx
    ON neet_chunks
    USING hnsw (embedding vector_cosine_ops);

-- Step 4: Disable Row-Level Security (single-user tool using service_role key)
ALTER TABLE neet_chunks DISABLE ROW LEVEL SECURITY;

-- Step 5: Create the similarity-search RPC function
-- Called from Python via supabase.rpc("match_neet_chunks", {...})
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
    WHERE 1 - (nc.embedding <=> query_embedding) > match_threshold
    ORDER BY nc.embedding <=> query_embedding
    LIMIT match_count;
$$;

-- Verification query (run after ingest to confirm rows):
-- SELECT COUNT(*), MIN(created_at), MAX(created_at) FROM neet_chunks;
