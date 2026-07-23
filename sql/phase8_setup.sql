-- =============================================================================
-- phase8_setup.sql — Jules NEET Prep, Phase 8 schema additions (Concept Map)
-- Run this in the Supabase SQL editor (project: zikypzaaqlcifhqzptow)
-- =============================================================================

CREATE TABLE IF NOT EXISTS concept_edges (
    id                bigserial PRIMARY KEY,
    topic_a           text        NOT NULL,
    topic_b           text        NOT NULL,
    relationship_note text,
    reviewed          boolean     NOT NULL DEFAULT false,
    created_at        timestamptz NOT NULL DEFAULT now(),
    UNIQUE (topic_a, topic_b)
);

-- Index for faster lookups when querying edges for a specific topic
CREATE INDEX IF NOT EXISTS idx_concept_edges_topic_a ON concept_edges(topic_a);
CREATE INDEX IF NOT EXISTS idx_concept_edges_topic_b ON concept_edges(topic_b);

-- Summary print (run this SELECT to confirm all tables exist after setup)
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name = 'concept_edges'
ORDER BY table_name;
