/**
 * Pre-compiled SQL statements and query fragments for GTD scheduling and counts.
 * Uses exact column and index names from SCHEMA.md and Migration 0012.
 */

export const GTD_SQL = {
  INBOX_TASKS: `
    SELECT * FROM tasks
    WHERE area_id IS NULL
      AND project_id IS NULL
      AND parent_task_id IS NULL
      AND due_date IS NULL
      AND bucket IS NULL
      AND waiting_since IS NULL
      AND is_completed = 0
      AND is_trashed = 0
    ORDER BY sort_order ASC, created_at DESC
  `,

  ANYTIME_TASKS: `
    SELECT * FROM tasks
    WHERE bucket = 'anytime'
      AND is_completed = 0
      AND is_trashed = 0
    ORDER BY sort_order ASC, created_at DESC
  `,

  SOMEDAY_TASKS: `
    SELECT * FROM tasks
    WHERE bucket = 'someday'
      AND is_completed = 0
      AND is_trashed = 0
    ORDER BY sort_order ASC, created_at DESC
  `,

  WAITING_FOR_TASKS: `
    SELECT * FROM tasks
    WHERE waiting_since IS NOT NULL
      AND is_completed = 0
      AND is_trashed = 0
    ORDER BY
      CASE WHEN follow_up_date IS NULL THEN 1 ELSE 0 END,
      follow_up_date ASC,
      waiting_since ASC
  `,

  GTD_TASK_COUNTS: `
    SELECT
      COALESCE(SUM(CASE WHEN area_id IS NULL AND project_id IS NULL AND parent_task_id IS NULL AND due_date IS NULL AND bucket IS NULL AND waiting_since IS NULL AND is_completed = 0 AND is_trashed = 0 THEN 1 ELSE 0 END), 0) AS inbox,
      COALESCE(SUM(CASE WHEN bucket = 'anytime' AND is_completed = 0 AND is_trashed = 0 THEN 1 ELSE 0 END), 0) AS anytime,
      COALESCE(SUM(CASE WHEN bucket = 'someday' AND is_completed = 0 AND is_trashed = 0 THEN 1 ELSE 0 END), 0) AS someday,
      COALESCE(SUM(CASE WHEN waiting_since IS NOT NULL AND is_completed = 0 AND is_trashed = 0 THEN 1 ELSE 0 END), 0) AS waitingFor,
      COALESCE(SUM(CASE WHEN waiting_since IS NOT NULL AND follow_up_date IS NOT NULL AND follow_up_date < @today AND is_completed = 0 AND is_trashed = 0 THEN 1 ELSE 0 END), 0) AS waitingOverdue
    FROM tasks
  `,

  DUE_FOLLOW_UPS: `
    SELECT * FROM tasks
    WHERE waiting_since IS NOT NULL
      AND follow_up_date IS NOT NULL
      AND follow_up_date <= @today
      AND (follow_up_notified_on IS NULL OR follow_up_notified_on < @today)
      AND is_completed = 0
      AND is_trashed = 0
    ORDER BY follow_up_date ASC
  `,

  UPDATE_SCHEDULING_FIELDS: `
    UPDATE tasks
    SET bucket = @bucket,
        due_date = @due_date,
        due_time = @due_time,
        all_day = @all_day,
        recurrence_rule = @recurrence_rule,
        waiting_on = @waiting_on,
        waiting_since = @waiting_since,
        follow_up_date = @follow_up_date,
        follow_up_notified_on = @follow_up_notified_on,
        reviewed_at = @reviewed_at,
        updated_at = @updated_at
    WHERE id = @id
  `,
} as const;
