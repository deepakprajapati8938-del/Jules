-- =============================================================================
-- phase7_setup.sql — Jules NEET Prep, Phase 7 schema additions (Chat Sessions)
-- Run this in the Supabase SQL editor (project: zikypzaaqlcifhqzptow)
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Create chat_sessions table
CREATE TABLE IF NOT EXISTS chat_sessions (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    chat_type text NOT NULL CHECK (chat_type IN ('ncert', 'personal')),
    title text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- 2. Create default sessions for existing messages
INSERT INTO chat_sessions (id, chat_type, title, created_at, updated_at) 
VALUES ('00000000-0000-0000-0000-000000000001', 'ncert', 'Previous NCERT Chat', now(), now()) 
ON CONFLICT DO NOTHING;

INSERT INTO chat_sessions (id, chat_type, title, created_at, updated_at) 
VALUES ('00000000-0000-0000-0000-000000000002', 'personal', 'Previous Personal Chat', now(), now()) 
ON CONFLICT DO NOTHING;

-- 3. Add session_id to existing tables (nullable first to allow update)
ALTER TABLE ncert_chat_messages ADD COLUMN IF NOT EXISTS session_id uuid REFERENCES chat_sessions(id) ON DELETE CASCADE;
ALTER TABLE personal_chat_messages ADD COLUMN IF NOT EXISTS session_id uuid REFERENCES chat_sessions(id) ON DELETE CASCADE;

-- 4. Update existing rows to point to default sessions
UPDATE ncert_chat_messages SET session_id = '00000000-0000-0000-0000-000000000001' WHERE session_id IS NULL;
UPDATE personal_chat_messages SET session_id = '00000000-0000-0000-0000-000000000002' WHERE session_id IS NULL;

-- 5. Make session_id NOT NULL now that all rows have it
ALTER TABLE ncert_chat_messages ALTER COLUMN session_id SET NOT NULL;
ALTER TABLE personal_chat_messages ALTER COLUMN session_id SET NOT NULL;
