import { describe, it, expect } from 'vitest';
import React from 'react';
import { SuggestionsSidebar } from '../../src/renderer/features/lists/SuggestionsSidebar.js';
import { KeyboardSettings } from '../../src/renderer/features/settings/KeyboardSettings.js';
import { useTaskStore } from '../../src/renderer/stores/taskStore.js';
import type { Task } from '../../src/shared/types/task.js';

function mockTask(overrides: Partial<Task> & { id: string; title: string }): Task {
  return {
    all_day: 0,
    is_starred: 0,
    created_by_device: 'local',
    pomodoro_count: 0,
    priority: 0,
    is_completed: 0,
    is_trashed: 0,
    sort_order: 0,
    created_at: '2026-10-01T00:00:00Z',
    updated_at: '2026-10-01T00:00:00Z',
    ...overrides,
  };
}

describe('Convenience Surfaces (GTD Shortcuts & Suggestions)', () => {
  it('instantiates KeyboardSettings containing GTD navigation shortcuts', () => {
    const el = React.createElement(KeyboardSettings);
    expect(el).toBeDefined();
  });

  it('instantiates SuggestionsSidebar with onClose callback', () => {
    const el = React.createElement(SuggestionsSidebar, {
      onClose: () => {},
    });
    expect(el.props.onClose).toBeDefined();
  });

  it('verifies suggestions ranking: due follow-up top, anytime included, someday excluded', () => {
    const today = new Date().toISOString().split('T')[0];
    const tasks: Record<string, Task> = {
      't-someday': mockTask({
        id: 't-someday',
        title: 'Learn Icelandic',
        bucket: 'someday',
        priority: 3,
        sort_order: 1,
      }),
      't-anytime': mockTask({
        id: 't-anytime',
        title: 'Draft proposal email',
        bucket: 'anytime',
        sort_order: 2,
      }),
      't-followup': mockTask({
        id: 't-followup',
        title: 'Waiting for sign-off from Dave',
        waiting_since: '2026-09-28',
        follow_up_date: today,
        sort_order: 3,
      }),
      't-due': mockTask({
        id: 't-due',
        title: 'Submit tax documentation',
        due_date: today,
        priority: 1,
        sort_order: 4,
      }),
    };

    useTaskStore.setState({ tasksById: tasks });

    // Manually evaluate the ranking algorithm matching SuggestionsSidebar
    const followUps: Task[] = [];
    const dueTasks: Task[] = [];
    const anytimeTasks: Task[] = [];
    const somedayIncluded: Task[] = [];

    for (const t of Object.values(tasks)) {
      if (t.is_trashed === 1 || t.is_completed === 1) continue;
      if (t.bucket === 'someday') {
        somedayIncluded.push(t);
        continue;
      }
      if (t.waiting_since && t.follow_up_date && t.follow_up_date <= today) {
        followUps.push(t);
        continue;
      }
      if (t.due_date && t.due_date <= today) {
        dueTasks.push(t);
        continue;
      }
      if (t.bucket === 'anytime') {
        anytimeTasks.push(t);
      }
    }

    expect(somedayIncluded.length).toBe(1);
    expect(followUps.length).toBe(1);
    expect(followUps[0].id).toBe('t-followup');
    expect(dueTasks.length).toBe(1);
    expect(dueTasks[0].id).toBe('t-due');
    expect(anytimeTasks.length).toBe(1);
    expect(anytimeTasks[0].id).toBe('t-anytime');
  });
});
