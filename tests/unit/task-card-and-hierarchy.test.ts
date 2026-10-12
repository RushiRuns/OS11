import { describe, it, expect } from 'vitest';
import { stripHtmlNotes } from '../../src/renderer/features/tasks/TaskCard.js';
import { capitalizeFirstLetter } from '../../src/shared/utils/index.js';
import type { Task } from '../../src/shared/types/task.js';

describe('TaskCard — stripHtmlNotes helper', () => {
  it('strips simple paragraph tags and returns plain text', () => {
    expect(stripHtmlNotes('<p>asdasdasd</p>')).toBe('asdasdasd');
  });

  it('returns empty string for empty HTML tags', () => {
    expect(stripHtmlNotes('<p></p><p><br></p>')).toBe('');
    expect(stripHtmlNotes('<p>   </p>')).toBe('');
    expect(stripHtmlNotes('')).toBe('');
    expect(stripHtmlNotes(null)).toBe('');
    expect(stripHtmlNotes(undefined)).toBe('');
  });

  it('decodes common HTML entities', () => {
    expect(stripHtmlNotes('<p>Fix &amp; test &quot;sidebar&quot; &lt;3</p>')).toBe('Fix & test "sidebar" <3');
    expect(stripHtmlNotes('<p>Item&nbsp;1</p>')).toBe('Item 1');
  });

  it('converts linebreaks and paragraphs cleanly without excessive newlines', () => {
    const html = '<p>Line 1</p><p>Line 2</p>';
    const result = stripHtmlNotes(html);
    expect(result).toBe('Line 1\nLine 2');
  });
});

describe('Subtasks Tree Flattening Logic', () => {
  it('populates children under parent even when child is not in filtered active list', () => {
    const parentTask: Task = {
      id: 'parent-1',
      title: 'Parent Task',
      is_completed: 0,
      is_trashed: 0,
      parent_task_id: null,
      sort_order: 1000,
      my_day_date: '2026-10-12',
    } as any;

    const childTask1: Task = {
      id: 'child-1',
      title: 'Child Task 1',
      is_completed: 0,
      is_trashed: 0,
      parent_task_id: 'parent-1',
      sort_order: 100,
      my_day_date: null,
    } as any;

    const childTask2: Task = {
      id: 'child-2',
      title: 'Child Task 2',
      is_completed: 0,
      is_trashed: 0,
      parent_task_id: 'parent-1',
      sort_order: 200,
      my_day_date: null,
    } as any;

    const tasksById: Record<string, Task> = {
      'parent-1': parentTask,
      'child-1': childTask1,
      'child-2': childTask2,
    };

    // Simulate childrenByParentId extraction as updated in TaskList & ProjectListView
    const childrenByParentId = new Map<string, Task[]>();
    for (const t of Object.values(tasksById)) {
      if (t.is_trashed === 0 && t.is_completed === 0 && t.parent_task_id) {
        const list = childrenByParentId.get(t.parent_task_id) || [];
        list.push(t);
        childrenByParentId.set(t.parent_task_id, list);
      }
    }
    for (const [, childList] of childrenByParentId.entries()) {
      childList.sort((a, b) => a.sort_order - b.sort_order);
    }

    const children = childrenByParentId.get('parent-1');
    expect(children).toBeDefined();
    expect(children?.length).toBe(2);
    expect(children?.[0].id).toBe('child-1');
    expect(children?.[1].id).toBe('child-2');
  });
});

describe('capitalizeFirstLetter helper', () => {
  it('capitalizes the first character of a lowercase string', () => {
    expect(capitalizeFirstLetter('fix the issue with task sidebar')).toBe('Fix the issue with task sidebar');
    expect(capitalizeFirstLetter('sidebar')).toBe('Sidebar');
  });

  it('preserves already capitalized strings', () => {
    expect(capitalizeFirstLetter('Already capitalized')).toBe('Already capitalized');
    expect(capitalizeFirstLetter('NLP and OpenAI')).toBe('NLP and OpenAI');
  });

  it('handles strings with leading whitespace correctly', () => {
    expect(capitalizeFirstLetter('   spaced task')).toBe('   Spaced task');
  });

  it('handles empty or blank strings without throwing', () => {
    expect(capitalizeFirstLetter('')).toBe('');
    expect(capitalizeFirstLetter('   ')).toBe('   ');
  });
});
