-- ============================================================
-- Migration 0007: Make Inbox Default Built-in Smart List
-- ============================================================

-- Shift current smart lists down by 1 to make room at position 0
UPDATE lists
SET sort_order = sort_order + 1,
    pinned_sort_order = pinned_sort_order + 1
WHERE is_smart = 1 AND id != 'list_inbox';

-- Ensure list_inbox exists as a built-in smart list placed at top (sort_order = 0)
INSERT INTO lists (id, name, icon, is_smart, smart_type, sort_order, is_pinned, pinned_sort_order, notification_enabled, created_at, updated_at)
VALUES (
  'list_inbox', 'Inbox', '📥', 1, 'inbox', 0, 1, 0, 1, datetime('now'), datetime('now')
)
ON CONFLICT(id) DO UPDATE SET
  name = 'Inbox',
  icon = '📥',
  is_smart = 1,
  smart_type = 'inbox',
  sort_order = 0,
  is_pinned = 1,
  pinned_sort_order = 0;
