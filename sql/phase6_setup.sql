-- =============================================================================
-- phase6_setup.sql — Jules NEET Prep, Phase 6 schema additions
-- Run this in the Supabase SQL editor
-- =============================================================================

-- ---------------------------------------------------------------------------
-- C1. ncert_chat_messages
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ncert_chat_messages (
    id          bigserial PRIMARY KEY,
    role        text        NOT NULL CHECK (role IN ('user', 'assistant')),
    content     text        NOT NULL,
    created_at  timestamptz NOT NULL DEFAULT now()
);
