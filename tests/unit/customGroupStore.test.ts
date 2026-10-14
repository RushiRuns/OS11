import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { CustomGroup, CustomGroupSection, MoveTasksResult } from '@shared/types/index.js';

// Mock ipc before importing customGroupStore
const mockIpc = {
  invoke: vi.fn(),
};

vi.mock('../../src/renderer/services/ipc.js', () => ({
  ipc: mockIpc,
}));

// Mock useUndoRedoStore
const mockUndoStack: any[] = [];
const mockPushAction = vi.fn((action) => {
  mockUndoStack.push(action);
});

vi.mock('../../src/renderer/hooks/useUndoRedo.js', () => ({
  useUndoRedoStore: {
    getState: () => ({
      pushAction: mockPushAction,
    }),
  },
}));

// Import store after mocks
const { useCustomGroupStore } = await import('../../src/renderer/stores/customGroupStore.js');

describe('customGroupStore', () => {
  beforeEach(() => {
    mockIpc.invoke.mockReset();
    mockPushAction.mockClear();
    mockUndoStack.length = 0;
    useCustomGroupStore.setState({
      groups: [],
      activeProjectId: null,
      activeGroupId: null,
      overrides: [],
      taskValues: {},
      isLoading: false,
    });
  });

  it('loadGroups populates the store groups', async () => {
    const dummyGroups: CustomGroup[] = [
      {
        id: 'g-1',
        name: 'Coding',
        sort_order: 1,
        last_used_at: null,
        created_at: '2026-01-01',
        updated_at: '2026-01-01',
        deleted_at: null,
        sections: [],
      },
    ];

    mockIpc.invoke.mockResolvedValueOnce(dummyGroups);

    await useCustomGroupStore.getState().loadGroups();

    expect(useCustomGroupStore.getState().groups).toHaveLength(1);
    expect(useCustomGroupStore.getState().groups[0].name).toBe('Coding');
  });

  it('createGroup adds a new group to the store', async () => {
    const created: CustomGroup = {
      id: 'g-new',
      name: 'Design',
      sort_order: 2,
      last_used_at: null,
      created_at: '2026-01-02',
      updated_at: '2026-01-02',
      deleted_at: null,
      sections: [],
    };

    mockIpc.invoke.mockResolvedValueOnce(created);

    const res = await useCustomGroupStore.getState().createGroup({ name: 'Design' });

    expect(res.name).toBe('Design');
    expect(useCustomGroupStore.getState().groups).toHaveLength(1);
    expect(useCustomGroupStore.getState().groups[0].id).toBe('g-new');
  });

  it('deleteGroup removes the group and pushes undo action that restores it', async () => {
    const existing: CustomGroup = {
      id: 'g-del',
      name: 'To Delete',
      sort_order: 1,
      last_used_at: null,
      created_at: '2026-01-01',
      updated_at: '2026-01-01',
      deleted_at: null,
      sections: [],
    };

    useCustomGroupStore.setState({ groups: [existing] });

    mockIpc.invoke.mockResolvedValueOnce(undefined); // for DELETE
    mockIpc.invoke.mockResolvedValueOnce(existing); // for RESTORE in undo

    await useCustomGroupStore.getState().deleteGroup('g-del');

    expect(useCustomGroupStore.getState().groups).toHaveLength(0);
    expect(mockPushAction).toHaveBeenCalledTimes(1);

    // Test undo function
    const undoAction = mockUndoStack[0];
    await undoAction.undoFn();

    expect(useCustomGroupStore.getState().groups).toHaveLength(1);
    expect(useCustomGroupStore.getState().groups[0].id).toBe('g-del');
  });

  it('deleteSection removes section, cleans up taskValues, and undo restores it', async () => {
    const section: CustomGroupSection = {
      id: 's-1',
      group_id: 'g-1',
      name: 'Bugs',
      sort_order: 1,
      created_at: '2026-01-01',
      updated_at: '2026-01-01',
      deleted_at: null,
    };

    const group: CustomGroup = {
      id: 'g-1',
      name: 'Coding',
      sort_order: 1,
      last_used_at: null,
      created_at: '2026-01-01',
      updated_at: '2026-01-01',
      deleted_at: null,
      sections: [section],
    };

    useCustomGroupStore.setState({
      groups: [group],
      taskValues: { 'task-1': 's-1', 'task-2': 'other-sec' },
    });

    mockIpc.invoke.mockResolvedValueOnce(undefined); // for DELETE section
    mockIpc.invoke.mockResolvedValueOnce(section); // for RESTORE section

    await useCustomGroupStore.getState().deleteSection('s-1');

    // Section removed from group
    let updatedGroup = useCustomGroupStore.getState().groups[0];
    expect(updatedGroup.sections).toHaveLength(0);

    // task-1 unassigned from deleted section (moves to unsorted)
    expect(useCustomGroupStore.getState().taskValues['task-1']).toBeUndefined();
    expect(useCustomGroupStore.getState().taskValues['task-2']).toBe('other-sec');

    // Undo action was pushed
    expect(mockPushAction).toHaveBeenCalledTimes(1);

    // Execute undo
    const undoAction = mockUndoStack[0];
    await undoAction.undoFn();

    updatedGroup = useCustomGroupStore.getState().groups[0];
    expect(updatedGroup.sections).toHaveLength(1);
    expect(updatedGroup.sections?.[0].id).toBe('s-1');
  });

  it('markGroupUsed updates last_used_at and places group at MRU top', async () => {
    const g1: CustomGroup = {
      id: 'g-1',
      name: 'Older',
      sort_order: 1,
      last_used_at: '2026-01-01T00:00:00.000Z',
      created_at: '2026-01-01',
      updated_at: '2026-01-01',
      deleted_at: null,
    };
    const g2: CustomGroup = {
      id: 'g-2',
      name: 'Newer',
      sort_order: 2,
      last_used_at: '2026-01-02T00:00:00.000Z',
      created_at: '2026-01-02',
      updated_at: '2026-01-02',
      deleted_at: null,
    };

    useCustomGroupStore.setState({ groups: [g2, g1] });
    mockIpc.invoke.mockResolvedValueOnce(undefined);

    await useCustomGroupStore.getState().markGroupUsed('g-1');

    const groups = useCustomGroupStore.getState().groups;
    expect(groups[0].id).toBe('g-1');
    expect(groups[0].last_used_at).toBeTruthy();
  });

  it('moveTasks optimistically updates taskValues, moves tasks atomically, and registers single undo', async () => {
    useCustomGroupStore.setState({
      activeGroupId: 'g-1',
      taskValues: {
        'task-1': 'sec-old',
        'task-2': 'sec-old',
      },
    });

    const moveResult: MoveTasksResult = {
      updatedCount: 2,
      groupId: 'g-1',
      targetSectionId: 'sec-new',
      previousLocations: [
        { taskId: 'task-1', previousSectionId: 'sec-old', previousSortOrder: 100 },
        { taskId: 'task-2', previousSectionId: 'sec-old', previousSortOrder: 200 },
      ],
    };

    mockIpc.invoke.mockResolvedValueOnce(moveResult);

    await useCustomGroupStore.getState().moveTasks(['task-1', 'task-2'], 'sec-new');

    // Optimistically updated
    expect(useCustomGroupStore.getState().taskValues['task-1']).toBe('sec-new');
    expect(useCustomGroupStore.getState().taskValues['task-2']).toBe('sec-new');

    // Single undo action registered for both tasks
    expect(mockPushAction).toHaveBeenCalledTimes(1);

    // Test undo execution restores previous sections
    mockIpc.invoke.mockResolvedValueOnce({
      updatedCount: 1,
      groupId: 'g-1',
      targetSectionId: 'sec-old',
      previousLocations: [],
    });
    mockIpc.invoke.mockResolvedValueOnce({
      updatedCount: 1,
      groupId: 'g-1',
      targetSectionId: 'sec-old',
      previousLocations: [],
    });

    const undoAction = mockUndoStack[0];
    await undoAction.undoFn();

    expect(useCustomGroupStore.getState().taskValues['task-1']).toBe('sec-old');
    expect(useCustomGroupStore.getState().taskValues['task-2']).toBe('sec-old');
  });
});
