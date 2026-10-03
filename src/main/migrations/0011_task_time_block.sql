-- 0011_task_time_block.sql
-- Add scheduled_start_min and scheduled_duration_min to tasks for My Day time-blocking scheduler

ALTER TABLE tasks ADD COLUMN scheduled_start_min INTEGER
  CHECK (scheduled_start_min IS NULL OR (scheduled_start_min >= 0 AND scheduled_start_min < 1440));

ALTER TABLE tasks ADD COLUMN scheduled_duration_min INTEGER
  CHECK (scheduled_duration_min IS NULL OR (scheduled_duration_min >= 15 AND scheduled_duration_min <= 480));
