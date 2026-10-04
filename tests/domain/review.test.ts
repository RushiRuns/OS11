import { describe, it, expect } from 'vitest';
import { pickSomedayReviewBatch } from '../../src/main/domain/review.js';

describe('Domain: Someday Review Batching (pickSomedayReviewBatch)', () => {
  const now = new Date('2026-10-15T12:00:00.000Z');
  const intervalDays = 14; // 14 days ago was 2026-10-01

  it('selects items with reviewed_at null or older than interval', () => {
    const items = [
      { id: '1', created_at: '2026-09-01T00:00:00.000Z', reviewed_at: null }, // never reviewed -> due
      { id: '2', created_at: '2026-09-02T00:00:00.000Z', reviewed_at: '2026-09-25T00:00:00.000Z' }, // 20 days ago -> due
      { id: '3', created_at: '2026-09-03T00:00:00.000Z', reviewed_at: '2026-10-10T00:00:00.000Z' }, // 5 days ago -> NOT due
      { id: '4', created_at: '2026-08-15T00:00:00.000Z', reviewed_at: null }, // never reviewed -> due
    ];

    const batch = pickSomedayReviewBatch(items, intervalDays, now);
    const batchIds = batch.map((b) => b.id);

    expect(batchIds).toContain('1');
    expect(batchIds).toContain('2');
    expect(batchIds).toContain('4');
    expect(batchIds).not.toContain('3');
  });

  it('orders unreviewed items first by creation date, then oldest reviewed', () => {
    const items = [
      { id: 'newer_unreviewed', created_at: '2026-09-10T00:00:00.000Z', reviewed_at: null },
      { id: 'older_unreviewed', created_at: '2026-08-01T00:00:00.000Z', reviewed_at: null },
      { id: 'reviewed_long_ago', created_at: '2026-07-01T00:00:00.000Z', reviewed_at: '2026-09-01T00:00:00.000Z' },
      { id: 'reviewed_recently_due', created_at: '2026-07-01T00:00:00.000Z', reviewed_at: '2026-09-30T00:00:00.000Z' },
    ];

    const batch = pickSomedayReviewBatch(items, intervalDays, now);
    expect(batch.map((b) => b.id)).toEqual([
      'older_unreviewed',
      'newer_unreviewed',
      'reviewed_long_ago',
      'reviewed_recently_due',
    ]);
  });
});
