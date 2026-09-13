import { useEffect } from 'react';
import { useTaskStore } from '../stores/taskStore.js';
import { useListStore } from '../stores/listStore.js';
import { useAppStore } from '../stores/app-store.js';
import { useSearchStore } from '../stores/searchStore.js';
import { useUndoRedo } from './useUndoRedo.js';
import { ipc } from '../services/ipc.js';
import { IPC } from '@shared/ipc-channels.js';
import type { Task } from '@shared/types/task.js';

interface UseKeyboardShortcutsOptions {
  activeTasks: Task[];
  selectedTaskId: string | null;
  onSelectTask?: (task: Task | null) => void;
  onToggleDetail?: () => void;
  onToggleFocusMode?: () => void;
  onOpenCommandPalette?: () => void;
  onDeleteTask?: (taskId: string) => void;
}

export function useKeyboardShortcuts({
  activeTasks,
  selectedTaskId,
  onSelectTask,
  onToggleDetail,
  onToggleFocusMode,
  onOpenCommandPalette,
  onDeleteTask,
}: UseKeyboardShortcutsOptions): void {
  const { toggleComplete, toggleStar, duplicateTask, updateTask, makeSubtask, promoteSubtask } =
    useTaskStore();
  const { orderedIds, listsById, setActiveList } = useListStore();
  const { setActiveListId } = useAppStore();
  const { toggleSearch, openSearch } = useSearchStore();
  const { undo, redo, pushAction } = useUndoRedo();

  useEffect(() => {
    const handleKeyDown = async (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isInput =
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable;

      const isMac = typeof navigator !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.platform);
      const modKey = isMac ? e.metaKey : e.ctrlKey;

      // Global hotkeys (work even inside inputs)
      // 1. Ctrl+K -> Command Palette
      if (modKey && e.key.toLowerCase() === 'k' && !e.shiftKey) {
        e.preventDefault();
        onOpenCommandPalette?.();
        return;
      }

      // 2. Ctrl+Shift+F -> Toggle Focus Mode
      if (modKey && e.shiftKey && e.key.toLowerCase() === 'f') {
        e.preventDefault();
        onToggleFocusMode?.();
        return;
      }

      // 3. Ctrl+F -> Search tasks
      if (modKey && e.key.toLowerCase() === 'f' && !e.shiftKey) {
        e.preventDefault();
        openSearch();
        return;
      }

      // 4. Ctrl+Shift+T -> Toggle Theme
      if (modKey && e.shiftKey && e.key.toLowerCase() === 't') {
        e.preventDefault();
        const root = document.documentElement;
        const currentTheme = root.getAttribute('data-theme') || 'dark';
        const nextTheme = currentTheme === 'dark' ? 'light' : 'dark';
        root.setAttribute('data-theme', nextTheme);
        ipc.invoke(IPC.SETTINGS.SET, { key: 'theme', value: nextTheme }).catch(() => {});
        return;
      }

      // 5. Ctrl+Z -> Undo
      if (modKey && e.key.toLowerCase() === 'z' && !e.shiftKey) {
        if (!isInput) {
          e.preventDefault();
          await undo();
          return;
        }
      }

      // 6. Ctrl+Y (or Ctrl+Shift+Z) -> Redo
      if ((modKey && e.key.toLowerCase() === 'y') || (modKey && e.shiftKey && e.key.toLowerCase() === 'z')) {
        if (!isInput) {
          e.preventDefault();
          await redo();
          return;
        }
      }

      // 7. Ctrl+1..9 -> Jump to list 1..9
      if (modKey && !e.shiftKey && !e.altKey && /^[1-9]$/.test(e.key)) {
        const index = parseInt(e.key, 10) - 1;
        const listKeys = Object.keys(listsById);
        if (index < listKeys.length) {
          e.preventDefault();
          const targetListId = listKeys[index];
          setActiveListId(targetListId);
          setActiveList(targetListId);
          return;
        }
      }

      // 8. Ctrl+Shift+L -> Quick list switcher (focus first list or cycle)
      if (modKey && e.shiftKey && e.key.toLowerCase() === 'l') {
        e.preventDefault();
        onOpenCommandPalette?.();
        return;
      }

      // The remaining shortcuts ONLY execute when focus is NOT inside an editable input/textarea
      if (isInput) return;

      const currentIdx = activeTasks.findIndex((t) => t.id === selectedTaskId);
      const selectedTask = currentIdx >= 0 ? activeTasks[currentIdx] : null;

      // Navigation: ↑ / ↓
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (activeTasks.length === 0) return;
        const nextIdx = currentIdx < activeTasks.length - 1 ? currentIdx + 1 : 0;
        onSelectTask?.(activeTasks[nextIdx]);
        return;
      }

      if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (activeTasks.length === 0) return;
        const prevIdx = currentIdx > 0 ? currentIdx - 1 : activeTasks.length - 1;
        onSelectTask?.(activeTasks[prevIdx]);
        return;
      }

      // Space -> Toggle complete
      if (e.key === ' ' && selectedTaskId) {
        e.preventDefault();
        toggleComplete(selectedTaskId);
        return;
      }

      // Enter or F2 -> Edit title / open detail
      if ((e.key === 'Enter' || e.key === 'F2') && selectedTask) {
        e.preventDefault();
        onSelectTask?.(selectedTask);
        // Focus title input inside detail pane if available
        setTimeout(() => {
          const detailTitle = document.querySelector('input[aria-label="Task title"]') as HTMLInputElement;
          detailTitle?.focus();
          detailTitle?.select();
        }, 50);
        return;
      }

      // Delete or Backspace -> Delete selected task
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedTaskId) {
        e.preventDefault();
        onDeleteTask?.(selectedTaskId);
        return;
      }

      // Ctrl+I / Cmd+I -> Toggle detail panel
      if (modKey && e.key.toLowerCase() === 'i') {
        e.preventDefault();
        onToggleDetail?.();
        return;
      }

      // Tab -> Indent subtask (make child of task above it)
      if (e.key === 'Tab' && !e.shiftKey && selectedTaskId && currentIdx > 0) {
        e.preventDefault();
        const parentTask = activeTasks[currentIdx - 1];
        if (parentTask) {
          makeSubtask(selectedTaskId, parentTask.id);
        }
        return;
      }

      // Shift+Tab -> Outdent subtask
      if (e.key === 'Tab' && e.shiftKey && selectedTaskId && selectedTask?.parent_task_id) {
        e.preventDefault();
        promoteSubtask(selectedTaskId);
        return;
      }

      // Ctrl+Shift+M -> Toggle My Day
      if (modKey && e.shiftKey && e.key.toLowerCase() === 'm' && selectedTask) {
        e.preventDefault();
        const today = new Date().toISOString().split('T')[0];
        const nextDate = selectedTask.my_day_date ? null : today;
        updateTask({ id: selectedTask.id, my_day_date: nextDate });
        return;
      }

      // Ctrl+Shift+D -> Duplicate task
      if (modKey && e.shiftKey && e.key.toLowerCase() === 'd' && selectedTaskId) {
        e.preventDefault();
        duplicateTask(selectedTaskId);
        return;
      }

      // Ctrl+P -> Priority cycle (0 -> 1 -> 2 -> 3 -> 4 -> 0)
      if (modKey && e.key.toLowerCase() === 'p' && selectedTask) {
        e.preventDefault();
        const nextPriority = ((selectedTask.priority || 0) + 1) % 5;
        updateTask({ id: selectedTask.id, priority: nextPriority });
        return;
      }

      // Ctrl+D -> Due date (toggle tomorrow / today)
      if (modKey && e.key.toLowerCase() === 'd' && !e.shiftKey && selectedTask) {
        e.preventDefault();
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        const tomorrowStr = tomorrow.toISOString().split('T')[0];
        const nextDue = selectedTask.due_date ? null : tomorrowStr;
        updateTask({ id: selectedTask.id, due_date: nextDue });
        return;
      }

      // Slash '/' -> Focus search
      if (e.key === '/' && !modKey) {
        e.preventDefault();
        openSearch();
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    activeTasks,
    selectedTaskId,
    onSelectTask,
    onToggleDetail,
    onToggleFocusMode,
    onOpenCommandPalette,
    onDeleteTask,
    toggleComplete,
    toggleStar,
    duplicateTask,
    updateTask,
    makeSubtask,
    promoteSubtask,
    orderedIds,
    listsById,
    setActiveListId,
    setActiveList,
    toggleSearch,
    openSearch,
    undo,
    redo,
    pushAction,
  ]);
}

export default useKeyboardShortcuts;
