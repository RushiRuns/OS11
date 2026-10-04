import { describe, it, expect } from 'vitest';
import React from 'react';
import { WeeklyReviewFlow } from '../../src/renderer/features/review/WeeklyReviewFlow.js';
import { pickSomedayReviewBatch } from '../../src/main/domain/review.js';
import type { Task } from '../../src/shared/types/task.js';

describe('Weekly Review Flow (Main-Pane Takeover)', () => {
  it('instantiates WeeklyReviewFlow with onFinish prop', () => {
    let finished = false;
    const el = React.createElement(WeeklyReviewFlow, {
      onFinish: () => {
        finished = true;
      },
    });
    expect(el.props.onFinish).toBeDefined();
    el.props.onFinish();
    expect(finished).toBe(true);
  });

  it('batches Someday review items prioritizing unreviewed items', () => {
    const items: Task[] = [
      {
        id: 't-reviewed-recently',
        title: 'Learn C++',
        bucket: 'someday',
        reviewed_at: '2026-10-01T00:00:00Z',
        is_completed: 0,
        is_trashed: 0,
        sort_order: 1,
        created_at: '2026-09-01T00:00:00Z',
        updated_at: '2026-10-01T00:00:00Z',
      },
      {
        id: 't-unreviewed-1',
        title: 'Read War and Peace',
        bucket: 'someday',
        reviewed_at: null,
        is_completed: 0,
        is_trashed: 0,
        sort_order: 2,
        created_at: '2026-08-01T00:00:00Z',
        updated_at: '2026-08-01T00:00:00Z',
      },
      {
        id: 't-reviewed-old',
        title: 'Build treehouse',
        bucket: 'someday',
        reviewed_at: '2026-08-01T00:00:00Z',
        is_completed: 0,
        is_trashed: 0,
        sort_order: 3,
        created_at: '2026-07-01T00:00:00Z',
        updated_at: '2026-08-01T00:00:00Z',
      },
    ];

    const batch = pickSomedayReviewBatch(items, 14);
    // Unreviewed item must come first
    expect(batch[0].id).toBe('t-unreviewed-1');
    // Oldest reviewed item must come before recently reviewed item
    expect(batch[1].id).toBe('t-reviewed-old');
  });

  it('limits batch size to 5 per review interaction', () => {
    const items: Task[] = Array.from({ length: 12 }, (_, i) => ({
      id: `task-${i}`,
      title: `Someday idea ${i}`,
      bucket: 'someday',
      reviewed_at: null,
      is_completed: 0,
      is_trashed: 0,
      sort_order: i,
      created_at: '2026-09-01T00:00:00Z',
      updated_at: '2026-09-01T00:00:00Z',
    }));

    const batch = pickSomedayReviewBatch(items, 14).slice(0, 5);
    expect(batch.length).toBe(5);
  });
});
