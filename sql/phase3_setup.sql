-- ============================================================
-- NEET Phase 3 — Database Schema Update (Diagrams)
-- Run this file in the Supabase SQL Editor.
-- ============================================================

CREATE TABLE IF NOT EXISTS diagrams (
    id              SERIAL PRIMARY KEY,
    image_path      TEXT NOT NULL,
    caption         TEXT NOT NULL,
    subject         TEXT NOT NULL,
    chapter         TEXT NOT NULL,
    linked_topic    TEXT,
    confidence      TEXT, -- 'high' or 'low'
    page_number     INT
);

-- Ensure we don't insert duplicate images on script reruns
ALTER TABLE diagrams ADD CONSTRAINT unique_image_path UNIQUE (image_path);
