-- ============================================================
-- Migration 0003: Attachment Links & Thumbnails
-- ============================================================

ALTER TABLE attachments ADD COLUMN is_link INTEGER NOT NULL DEFAULT 0;
ALTER TABLE attachments ADD COLUMN thumbnail_path TEXT;
