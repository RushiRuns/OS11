-- ============================================================
-- Migration 0007: Make Inbox Default Built-in Smart List
-- ============================================================

-- Shift current smart lists down by 1 to make room at position 0
UPDATE lists
SET sort_order = sort_order + 1,
    pinned_sort_order = pinned_sort_order + 1
WHERE is_smart = 1 AND id != 'list_inbox';

-- Promote list_inbox to a built-in smart list placed at top (sort_order = 0)
UPDATE lists
SET is_smart = 1,
    smart_type = 'inbox',
    sort_order = 0,
    is_pinned = 1,
    pinned_sort_order = 0
WHERE id = 'list_inbox';
