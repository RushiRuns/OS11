-- ============================================================
-- Migration 0009: Area Model Hardening & Data Integrity
-- ============================================================

-- 1. Add is_default column to areas table
ALTER TABLE areas ADD COLUMN is_default INTEGER NOT NULL DEFAULT 0;

-- 2. Mark the default area with is_default = 1
UPDATE areas
SET is_default = 1
WHERE id = 'area_default'
   OR id = (SELECT id FROM areas ORDER BY sort_order ASC, created_at ASC LIMIT 1);

-- 3. Database Trigger: Cascade project area_id changes to all tasks within the project
CREATE TRIGGER IF NOT EXISTS trg_cascade_project_area_update
AFTER UPDATE OF area_id ON projects
FOR EACH ROW
WHEN NEW.area_id IS NOT NULL AND (OLD.area_id IS NULL OR NEW.area_id != OLD.area_id)
BEGIN
  UPDATE tasks
  SET area_id = NEW.area_id,
      updated_at = datetime('now')
  WHERE project_id = OLD.id;
END;

-- 4. Database Trigger: Sync task area_id on INSERT when project_id is set but area_id is null
CREATE TRIGGER IF NOT EXISTS trg_sync_task_project_area_insert
AFTER INSERT ON tasks
FOR EACH ROW
WHEN NEW.project_id IS NOT NULL AND NEW.area_id IS NULL
BEGIN
  UPDATE tasks
  SET area_id = (SELECT area_id FROM projects WHERE id = NEW.project_id)
  WHERE id = NEW.id;
END;

-- 5. Database Trigger: Sync task area_id on UPDATE when project_id changes
CREATE TRIGGER IF NOT EXISTS trg_sync_task_project_area_update
AFTER UPDATE OF project_id ON tasks
FOR EACH ROW
WHEN NEW.project_id IS NOT NULL AND (OLD.project_id IS NULL OR NEW.project_id != OLD.project_id)
BEGIN
  UPDATE tasks
  SET area_id = (SELECT area_id FROM projects WHERE id = NEW.project_id)
  WHERE id = NEW.id;
END;

