-- =============================================================================
-- phase5_5_study_logs.sql — Jules NEET Prep
-- Run this in the Supabase SQL editor to create the study_sessions table.
-- =============================================================================

CREATE TABLE IF NOT EXISTS study_sessions (
    id              bigserial PRIMARY KEY,
    subject         text        NOT NULL,
    chapter_name    text        NOT NULL,
    time_spent_mins integer     NOT NULL DEFAULT 0,
    notes           text,
    created_at      timestamptz NOT NULL DEFAULT now()
);

-- Index for querying recent sessions efficiently
CREATE INDEX IF NOT EXISTS study_sessions_created_at_idx 
    ON study_sessions(created_at DESC);
