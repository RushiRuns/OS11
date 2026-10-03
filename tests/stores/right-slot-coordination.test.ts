import { describe, it, expect, beforeEach } from 'vitest';
import { useTaskStore } from '../../src/renderer/stores/taskStore.js';
import { useAppStore } from '../../src/renderer/stores/app-store.js';
import { useSchedulerUiStore } from '../../src/renderer/stores/schedulerUiStore.js';

describe('Right Slot Coordination & SchedulerUiStore', () => {
  beforeEach(() => {
    useAppStore.setState({ activeListId: 'smart_my_day' });
    useTaskStore.setState({
      selectedTaskId: null,
      rightSlotActive: null,
      rightSlotPrevious: null,
    });
    useSchedulerUiStore.setState({
      panelWidth: 360,
      selectedBlockId: null,
      hoveredBlockId: null,
      isDragging: false,
      dragPreviewMinutes: null,
    });
  });

  describe('Peers: Scheduler and Suggestions', () => {
    it('opens scheduler on first toggle and closes on second toggle', () => {
      useTaskStore.getState().toggleScheduler();
      expect(useTaskStore.getState().rightSlotActive).toBe('scheduler');
      expect(useTaskStore.getState().rightSlotPrevious).toBeNull();

      useTaskStore.getState().toggleScheduler();
      expect(useTaskStore.getState().rightSlotActive).toBeNull();
      expect(useTaskStore.getState().rightSlotPrevious).toBeNull();
    });

    it('opens suggestions on first toggle and closes on second toggle', () => {
      useTaskStore.getState().toggleSuggestions();
      expect(useTaskStore.getState().rightSlotActive).toBe('suggestions');
      expect(useTaskStore.getState().rightSlotPrevious).toBeNull();

      useTaskStore.getState().toggleSuggestions();
      expect(useTaskStore.getState().rightSlotActive).toBeNull();
      expect(useTaskStore.getState().rightSlotPrevious).toBeNull();
    });

    it('switches between peers cleanly without restoring previous', () => {
      useTaskStore.getState().toggleScheduler();
      expect(useTaskStore.getState().rightSlotActive).toBe('scheduler');

      useTaskStore.getState().toggleSuggestions();
      expect(useTaskStore.getState().rightSlotActive).toBe('suggestions');
      expect(useTaskStore.getState().rightSlotPrevious).toBeNull();

      useTaskStore.getState().toggleScheduler();
      expect(useTaskStore.getState().rightSlotActive).toBe('scheduler');
      expect(useTaskStore.getState().rightSlotPrevious).toBeNull();
    });
  });

  describe('Transient Detail Panel', () => {
    it('saves scheduler into previous when detail opens and restores it when detail closes', () => {
      useTaskStore.getState().toggleScheduler();
      expect(useTaskStore.getState().rightSlotActive).toBe('scheduler');

      useTaskStore.getState().openDetail('task-1');
      expect(useTaskStore.getState().rightSlotActive).toBe('detail');
      expect(useTaskStore.getState().selectedTaskId).toBe('task-1');
      expect(useTaskStore.getState().rightSlotPrevious).toBe('scheduler');

      useTaskStore.getState().closeDetail();
      expect(useTaskStore.getState().rightSlotActive).toBe('scheduler');
      expect(useTaskStore.getState().selectedTaskId).toBeNull();
      expect(useTaskStore.getState().rightSlotPrevious).toBeNull();
    });

    it('saves suggestions into previous when detail opens and restores it when detail closes', () => {
      useTaskStore.getState().toggleSuggestions();
      expect(useTaskStore.getState().rightSlotActive).toBe('suggestions');

      useTaskStore.getState().openDetail('task-1');
      expect(useTaskStore.getState().rightSlotActive).toBe('detail');
      expect(useTaskStore.getState().rightSlotPrevious).toBe('suggestions');

      useTaskStore.getState().closeDetail();
      expect(useTaskStore.getState().rightSlotActive).toBe('suggestions');
      expect(useTaskStore.getState().rightSlotPrevious).toBeNull();
    });

    it('maintains original previous peer across multiple detail selections', () => {
      useTaskStore.getState().toggleScheduler();
      useTaskStore.getState().openDetail('task-1');
      expect(useTaskStore.getState().rightSlotPrevious).toBe('scheduler');

      // User selects another task while detail is already open
      useTaskStore.getState().openDetail('task-2');
      expect(useTaskStore.getState().rightSlotActive).toBe('detail');
      expect(useTaskStore.getState().rightSlotPrevious).toBe('scheduler');

      useTaskStore.getState().closeDetail();
      expect(useTaskStore.getState().rightSlotActive).toBe('scheduler');
      expect(useTaskStore.getState().rightSlotPrevious).toBeNull();
    });

    it('drops previous restore if navigated away from My Day', () => {
      useTaskStore.getState().toggleScheduler();
      useTaskStore.getState().openDetail('task-1');
      expect(useTaskStore.getState().rightSlotPrevious).toBe('scheduler');

      // Navigate to another list
      useAppStore.setState({ activeListId: 'list_inbox' });

      useTaskStore.getState().closeDetail();
      expect(useTaskStore.getState().rightSlotActive).toBeNull();
      expect(useTaskStore.getState().rightSlotPrevious).toBeNull();
    });

    it('replaces detail and clears previous when scheduler is explicitly toggled while detail is open', () => {
      useTaskStore.getState().toggleScheduler();
      useTaskStore.getState().openDetail('task-1');
      expect(useTaskStore.getState().rightSlotPrevious).toBe('scheduler');

      useTaskStore.getState().toggleScheduler();
      expect(useTaskStore.getState().rightSlotActive).toBe('scheduler');
      expect(useTaskStore.getState().rightSlotPrevious).toBeNull();
      expect(useTaskStore.getState().selectedTaskId).toBeNull();
    });
  });

  describe('SchedulerUiStore width clamping', () => {
    it('clamps width between 320px and 520px', () => {
      const store = useSchedulerUiStore.getState();

      store.setPanelWidth(250);
      expect(useSchedulerUiStore.getState().panelWidth).toBe(320);

      store.setPanelWidth(600);
      expect(useSchedulerUiStore.getState().panelWidth).toBe(520);

      store.setPanelWidth(420);
      expect(useSchedulerUiStore.getState().panelWidth).toBe(420);
    });
  });
});
