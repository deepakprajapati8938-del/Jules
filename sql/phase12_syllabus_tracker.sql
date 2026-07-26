-- =============================================================================
-- phase12_syllabus_tracker.sql — Jules NEET Prep
-- Run this in the Supabase SQL editor to create the user_syllabus_progress table.
-- =============================================================================

CREATE TABLE IF NOT EXISTS user_syllabus_progress (
    id              bigserial PRIMARY KEY,
    chapter_name    text        NOT NULL,
    topic_name      text        NOT NULL DEFAULT '',
    is_completed    boolean     NOT NULL DEFAULT true,
    completed_at    timestamptz NOT NULL DEFAULT now(),
    UNIQUE(chapter_name, topic_name)
);

-- Index for querying progress efficiently
CREATE INDEX IF NOT EXISTS user_syllabus_progress_chapter_idx 
    ON user_syllabus_progress(chapter_name);
