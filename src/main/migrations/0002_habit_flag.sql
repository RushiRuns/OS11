-- Migration 0002: Add habit flag to tasks
ALTER TABLE tasks ADD COLUMN is_habit INTEGER NOT NULL DEFAULT 0;
