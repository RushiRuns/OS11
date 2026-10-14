import { describe, it, expect } from 'vitest';
import {
  tokenize,
  titleMatches,
  matchTaskTree,
} from '../../src/renderer/features/search/matchTaskSearch.js';

describe('matchTaskSearch: tokenize', () => {
  it('returns empty array for whitespace-only query or empty string', () => {
    expect(tokenize('')).toEqual([]);
    expect(tokenize('   ')).toEqual([]);
    expect(tokenize('\t\n ')).toEqual([]);
  });

  it('splits on whitespace, lowercases, and deduplicates', () => {
    expect(tokenize('Milk buy MILK')).toEqual(['milk', 'buy']);
  });

  it('sorts tokens longest first, then alphabetically', () => {
    expect(tokenize('a bb ccc')).toEqual(['ccc', 'bb', 'a']);
    expect(tokenize('bb aa ccc')).toEqual(['ccc', 'aa', 'bb']);
  });
});

describe('matchTaskSearch: titleMatches', () => {
  it('matches unordered words in task title', () => {
    const tokens = tokenize('milk buy');
    expect(titleMatches('Buy milk', tokens)).toBe(true);
    expect(titleMatches('Milk to buy at store', tokens)).toBe(true);
    expect(titleMatches('BUY MILK TODAY', tokens)).toBe(true);
  });

  it('returns false if any token is missing from title', () => {
    const tokens = tokenize('milk buy bread');
    expect(titleMatches('Buy milk', tokens)).toBe(false);
  });

  it('is case-insensitive without folding diacritics', () => {
    const cafeTokens = tokenize('cafe');
    expect(titleMatches('Café in town', cafeTokens)).toBe(false);
    expect(titleMatches('Cafe in town', cafeTokens)).toBe(true);

    const cafeAccentTokens = tokenize('café');
    expect(titleMatches('Café in town', cafeAccentTokens)).toBe(true);
  });

  it('returns false if tokens list is empty', () => {
    expect(titleMatches('Any title', [])).toBe(false);
  });
});

describe('matchTaskSearch: matchTaskTree', () => {
  it('matches task by its own title', () => {
    const task = { id: 't1', title: 'Buy groceries' };
    const getChildren = () => [];
    const tokens = tokenize('groceries');

    const result = matchTaskTree(task, getChildren, tokens);
    expect(result.isMatch).toBe(true);
    expect(result.isTitleMatch).toBe(true);
    expect(result.matchingIds.size).toBe(0);
    expect(result.visibleIds.size).toBe(0);
  });

  it('matches task at depth 3 and makes ancestors visible but unhighlighted', () => {
    // Tree: Root (t1) -> Child 1 (t2) -> Subchild (t3) -> Deep Child (t4)
    const tree: Record<string, Array<{ id: string; title: string }>> = {
      t1: [
        { id: 't2', title: 'Work items' },
        { id: 'other', title: 'Unrelated child' },
      ],
      t2: [{ id: 't3', title: 'Project documentation' }],
      t3: [{ id: 't4', title: 'Architecture spec review' }],
      other: [{ id: 'other2', title: 'Clean room' }],
    };

    const task = { id: 't1', title: 'General plan' };
    const getChildren = (id: string) => tree[id] || [];
    const tokens = tokenize('spec review');

    const result = matchTaskTree(task, getChildren, tokens);

    // Root matches because descendant matches, but root title itself does NOT match
    expect(result.isMatch).toBe(true);
    expect(result.isTitleMatch).toBe(false);

    // matchingIds contains only the node whose own title matched
    expect(Array.from(result.matchingIds)).toEqual(['t4']);

    // visibleIds contains matching node plus its ancestors up to root
    expect(result.visibleIds.has('t4')).toBe(true);
    expect(result.visibleIds.has('t3')).toBe(true);
    expect(result.visibleIds.has('t2')).toBe(true);
    expect(result.visibleIds.has('other')).toBe(false);
    expect(result.visibleIds.has('other2')).toBe(false);
  });

  it('safely handles circular references without infinite looping', () => {
    // Malformed data: t1 -> t2 -> t1
    const tree: Record<string, Array<{ id: string; title: string }>> = {
      t1: [{ id: 't2', title: 'Child cycle' }],
      t2: [{ id: 't1', title: 'Root cycle' }],
    };

    const task = { id: 't1', title: 'Root' };
    const getChildren = (id: string) => tree[id] || [];
    const tokens = tokenize('nonexistent');

    const result = matchTaskTree(task, getChildren, tokens);
    expect(result.isMatch).toBe(false);
  });

  it('returns empty result when tokens are empty', () => {
    const task = { id: 't1', title: 'Sample' };
    const result = matchTaskTree(task, () => [], []);
    expect(result.isMatch).toBe(false);
    expect(result.isTitleMatch).toBe(false);
  });
});

describe('matchTaskSearch: performance benchmark', () => {
  it('filters 500 tasks with subtasks in well under 16ms', () => {
    interface BenchmarkTask {
      id: string;
      title: string;
      parent_task_id: string | null;
    }

    const tasks: BenchmarkTask[] = [];
    const childrenByParent = new Map<string, BenchmarkTask[]>();

    for (let i = 0; i < 400; i++) {
      const parentId = `task-${i}`;
      tasks.push({
        id: parentId,
        title: `Project Task ${i} — Complete deployment specification and review architecture`,
        parent_task_id: null,
      });

      if (i % 4 === 0) {
        const childId = `subtask-${i}`;
        const subtask: BenchmarkTask = {
          id: childId,
          title: `Subtask ${i}: Verify database migration and optimize query indices`,
          parent_task_id: parentId,
        };
        tasks.push(subtask);
        childrenByParent.set(parentId, [subtask]);
      }
    }

    const getChildren = (id: string) => childrenByParent.get(id) || [];
    const tokens = tokenize('deployment spec');

    const start = performance.now();
    let matchesCount = 0;
    for (let i = 0; i < tasks.length; i++) {
      const res = matchTaskTree(tasks[i], getChildren, tokens);
      if (res.isMatch) {
        matchesCount++;
      }
    }
    const duration = performance.now() - start;

    expect(matchesCount).toBeGreaterThan(0);
    expect(duration).toBeLessThan(16); // Must execute under one frame (16.6ms)
  });
});
