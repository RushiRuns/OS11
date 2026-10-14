import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { Task } from '../../src/shared/types/task.js';

let stateIndex = 0;
let states: unknown[] = [];
let effects: (() => void | (() => void))[] = [];

let refIndex = 0;
let refs: { current: unknown }[] = [];

vi.mock('react', async () => {
  const actual = await vi.importActual<typeof import('react')>('react');
  return {
    ...actual,
    memo: (comp: any) => comp,
    useMemo: (fn: any) => fn(),
    useCallback: (fn: any) => fn,
    useState: (initial: unknown) => {
      const idx = stateIndex++;
      if (states[idx] === undefined) {
        states[idx] = typeof initial === 'function' ? (initial as () => unknown)() : initial;
      }
      const setter = (val: unknown) => {
        states[idx] = typeof val === 'function' ? (val as (prev: unknown) => unknown)(states[idx]) : val;
      };
      return [states[idx], setter];
    },
    useRef: (initial: unknown) => {
      const idx = refIndex++;
      if (!refs[idx]) {
        refs[idx] = { current: initial };
      }
      return refs[idx];
    },
    useEffect: (effect: () => void | (() => void)) => {
      effects.push(effect);
    },
  };
});

vi.mock('@dnd-kit/sortable', () => ({
  useSortable: () => ({
    attributes: {},
    listeners: {},
    setNodeRef: () => {},
    isDragging: false,
  }),
}));

vi.mock('../../src/renderer/stores/selectionStore.js', () => ({
  useSelectionStore: () => ({
    selectedIds: new Set(),
    isMultiSelectActive: false,
    toggleSelect: vi.fn(),
    selectRange: vi.fn(),
  }),
}));

vi.mock('../../src/renderer/stores/tagStore.js', () => ({
  useTagStore: (selector: any) =>
    selector({
      getTagsForTask: () => [],
      loadTagsForTask: vi.fn(),
    }),
}));

vi.mock('../../src/renderer/stores/attachmentStore.js', () => ({
  useAttachmentStore: (selector: any) =>
    selector({
      countsByTaskId: {},
      incrementCount: vi.fn(),
    }),
}));

vi.mock('../../src/renderer/stores/goalStore.js', () => ({
  useGoalStore: (selector: any) =>
    selector({
      getGoalForTask: () => null,
    }),
}));

vi.mock('../../src/renderer/stores/app-store.js', () => {
  const store = (selector: any) =>
    selector ? selector({ activeListId: 'default' }) : { activeListId: 'default' };
  store.getState = () => ({ activeListId: 'default' });
  return { useAppStore: store };
});

vi.mock('../../src/renderer/stores/projectStore.js', () => {
  const store = (selector: any) =>
    selector ? selector({ projectsById: {} }) : { projectsById: {} };
  store.getState = () => ({ projectsById: {} });
  return { useProjectStore: store };
});

vi.mock('../../src/renderer/stores/areaStore.js', () => {
  const store = (selector: any) =>
    selector ? selector({ areasById: {} }) : { areasById: {} };
  store.getState = () => ({ areasById: {} });
  return { useAreaStore: store };
});

vi.mock('../../src/renderer/stores/listStore.js', () => {
  const store = (selector: any) =>
    selector ? selector({ listsById: {} }) : { listsById: {} };
  store.getState = () => ({ listsById: {} });
  return { useListStore: store };
});

vi.mock('../../src/renderer/stores/taskStore.js', () => {
  const store = (selector: any) =>
    selector ? selector({ rightSlotActive: null }) : { rightSlotActive: null };
  store.getState = () => ({ rightSlotActive: null });
  return { useTaskStore: store };
});

vi.mock('../../src/renderer/stores/schedulerUiStore.js', () => {
  const store = (selector: any) =>
    selector ? selector({ hoveredBlockId: null }) : { hoveredBlockId: null };
  store.getState = () => ({ hoveredBlockId: null, setHoveredBlockId: vi.fn(), setSelectedBlockId: vi.fn() });
  return { useSchedulerUiStore: store };
});

vi.mock('../../src/renderer/hooks/useToday.js', () => ({
  useToday: () => '2026-10-13',
}));

vi.mock('../../src/renderer/services/ipc.js', () => ({
  ipc: {
    invoke: vi.fn(),
  },
}));

import { TaskCard } from '../../src/renderer/features/tasks/TaskCard.js';

function findElementBy(root: any, predicate: (el: any) => boolean): any | null {
  const queue = [root];
  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) continue;
    if (predicate(current)) return current;
    if (current.props?.children) {
      const children = Array.isArray(current.props.children)
        ? current.props.children
        : [current.props.children];
      for (const child of children) {
        if (child && typeof child === 'object') {
          queue.push(child);
        }
      }
    }
  }
  return null;
}

describe('TaskCard Inline Title Editing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    stateIndex = 0;
    states = [];
    effects = [];
    refIndex = 0;
    refs = [];
  });

  const baseTask: Task = {
    id: 'task-1',
    title: 'Initial Task Title',
    notes: '',
    is_completed: 0,
    is_starred: 0,
    priority: 0,
    due_date: null,
    due_time: null,
    all_day: 0,
    list_id: 'default',
    parent_task_id: null,
    sort_order: 1,
    pomodoro_count: 0,
    is_habit: 0,
    is_trashed: 0,
    created_at: '2026-10-13T12:00:00.000Z',
    updated_at: '2026-10-13T12:00:00.000Z',
    created_by_device: 'test',
    scheduled_start_min: null,
    scheduled_duration_min: null,
  };

  it('renders title text in display mode by default', () => {
    stateIndex = 0;
    states = [];
    const tree = (TaskCard as any)({ task: baseTask });
    const span = findElementBy(tree, (el) => el.type === 'span' && el.props?.onDoubleClick);
    expect(span).toBeTruthy();
    expect(span.props.children).toBe('Initial Task Title');

    const input = findElementBy(tree, (el) => el.type === 'input');
    expect(input).toBeNull();
  });

  it('enters editing mode on double click', () => {
    stateIndex = 0;
    states = [];
    const tree = (TaskCard as any)({ task: baseTask });
    const span = findElementBy(tree, (el) => el.type === 'span' && el.props?.onDoubleClick);
    expect(span).toBeTruthy();

    const stopPropagation = vi.fn();
    span.props.onDoubleClick({ stopPropagation });
    expect(stopPropagation).toHaveBeenCalled();
    // states[0] is isEditing
    expect(states[0]).toBe(true);
  });

  it('enters editing mode when card is focused/selected and F2 is pressed', () => {
    stateIndex = 0;
    states = [];
    const tree = (TaskCard as any)({ task: baseTask, isSelected: true });
    expect(tree.props.onKeyDown).toBeDefined();

    const preventDefault = vi.fn();
    tree.props.onKeyDown({ key: 'F2', preventDefault });
    expect(preventDefault).toHaveBeenCalled();
    expect(states[0]).toBe(true);
  });

  it('enters editing mode when card is focused/selected and Enter is pressed', () => {
    stateIndex = 0;
    states = [];
    const tree = (TaskCard as any)({ task: baseTask, isSelected: true });
    expect(tree.props.onKeyDown).toBeDefined();

    const preventDefault = vi.fn();
    tree.props.onKeyDown({ key: 'Enter', preventDefault });
    expect(preventDefault).toHaveBeenCalled();
    expect(states[0]).toBe(true);
  });

  it('saves trimmed updated title and exits editing mode on Enter', () => {
    const handleUpdate = vi.fn();
    stateIndex = 0;
    states = [true, '  Updated Task Title  ']; // isEditing=true, editTitle='  Updated Task Title  '

    const tree = (TaskCard as any)({ task: baseTask, onUpdateTitle: handleUpdate });
    const input = findElementBy(tree, (el) => el.type === 'input');
    expect(input).toBeTruthy();

    const preventDefault = vi.fn();
    const stopPropagation = vi.fn();
    input.props.onKeyDown({ key: 'Enter', preventDefault, stopPropagation });

    expect(handleUpdate).toHaveBeenCalledWith('task-1', 'Updated Task Title');
    expect(states[0]).toBe(false);
  });

  it('does not trigger onUpdateTitle if title is unchanged on Enter', () => {
    const handleUpdate = vi.fn();
    stateIndex = 0;
    states = [true, 'Initial Task Title']; // unchanged

    const tree = (TaskCard as any)({ task: baseTask, onUpdateTitle: handleUpdate });
    const input = findElementBy(tree, (el) => el.type === 'input');
    expect(input).toBeTruthy();

    const preventDefault = vi.fn();
    const stopPropagation = vi.fn();
    input.props.onKeyDown({ key: 'Enter', preventDefault, stopPropagation });

    expect(handleUpdate).not.toHaveBeenCalled();
    expect(states[0]).toBe(false);
  });

  it('cancels edits and reverts to original title on Escape', () => {
    const handleUpdate = vi.fn();
    stateIndex = 0;
    states = [true, 'Changed But Escaped'];

    const tree = (TaskCard as any)({ task: baseTask, onUpdateTitle: handleUpdate });
    const input = findElementBy(tree, (el) => el.type === 'input');
    expect(input).toBeTruthy();

    const preventDefault = vi.fn();
    const stopPropagation = vi.fn();
    input.props.onKeyDown({ key: 'Escape', preventDefault, stopPropagation });

    expect(handleUpdate).not.toHaveBeenCalled();
    expect(states[0]).toBe(false); // isEditing reverts to false
    expect(states[1]).toBe('Initial Task Title'); // editTitle reverts
  });

  it('saves and exits edit mode on blur (clicking outside)', () => {
    const handleUpdate = vi.fn();
    stateIndex = 0;
    states = [true, 'New Title On Blur'];

    const tree = (TaskCard as any)({ task: baseTask, onUpdateTitle: handleUpdate });
    const input = findElementBy(tree, (el) => el.type === 'input');
    expect(input).toBeTruthy();

    input.props.onBlur();

    expect(handleUpdate).toHaveBeenCalledWith('task-1', 'New Title On Blur');
    expect(states[0]).toBe(false);
  });

  it('reverts to original title if new title is empty whitespace on blur', () => {
    const handleUpdate = vi.fn();
    stateIndex = 0;
    states = [true, '   ']; // empty whitespace

    const tree = (TaskCard as any)({ task: baseTask, onUpdateTitle: handleUpdate });
    const input = findElementBy(tree, (el) => el.type === 'input');
    expect(input).toBeTruthy();

    input.props.onBlur();

    expect(handleUpdate).not.toHaveBeenCalled();
    expect(states[0]).toBe(false);
    expect(states[1]).toBe('Initial Task Title');
  });

  it('commits title if isSelected transitions from true to false', () => {
    const handleUpdate = vi.fn();
    stateIndex = 0;
    refIndex = 0;
    states = [true, 'Auto committed title'];

    // Mount with isSelected: true
    (TaskCard as any)({ task: baseTask, isSelected: true, onUpdateTitle: handleUpdate });

    // Run effects registered on mount
    for (const eff of effects) eff();
    effects = [];

    // Re-render with isSelected: false
    stateIndex = 0;
    refIndex = 0;
    states[1] = 'Auto committed title'; // keep typed edit title
    (TaskCard as any)({ task: baseTask, isSelected: false, onUpdateTitle: handleUpdate });

    // Run effects for transition
    for (const eff of effects) eff();

    expect(handleUpdate).toHaveBeenCalledWith('task-1', 'Auto committed title');
    expect(states[0]).toBe(false);
  });
});
