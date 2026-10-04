export interface ReviewableItem {
  id: string;
  reviewed_at?: string | null;
  created_at: string;
}

/**
 * Filters and sorts Someday items (tasks or projects) that are due for review.
 * An item is due if:
 * 1. It has never been reviewed (reviewed_at is null/empty).
 * 2. Or the elapsed time since reviewed_at is >= intervalDays.
 *
 * Ordered by:
 * - Never reviewed first (oldest created_at first)
 * - Then oldest reviewed_at first
 */
export function pickSomedayReviewBatch<T extends ReviewableItem>(
  items: T[],
  intervalDays: number,
  now: Date = new Date()
): T[] {
  const thresholdMs = intervalDays * 24 * 60 * 60 * 1000;
  const nowMs = now.getTime();

  const dueItems = items.filter((item) => {
    if (!item.reviewed_at) {
      return true;
    }
    const reviewedMs = new Date(item.reviewed_at).getTime();
    if (isNaN(reviewedMs)) {
      return true;
    }
    return nowMs - reviewedMs >= thresholdMs;
  });

  return dueItems.sort((a, b) => {
    // Unreviewed items come first
    if (!a.reviewed_at && !b.reviewed_at) {
      return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    }
    if (!a.reviewed_at) return -1;
    if (!b.reviewed_at) return 1;

    // Both have reviewed_at: oldest reviewed first
    return new Date(a.reviewed_at).getTime() - new Date(b.reviewed_at).getTime();
  });
}
