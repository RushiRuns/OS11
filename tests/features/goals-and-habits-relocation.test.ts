import { describe, it, expect, beforeEach } from 'vitest';
import { useAppStore } from '../../src/renderer/stores/app-store.js';
import { useModuleStore } from '../../src/renderer/stores/moduleStore.js';

describe('Goals and Habits Relocation Feature Tests', () => {
  beforeEach(() => {
    useAppStore.setState({ activeListId: 'smart_my_day' });
  });

  it('maps legacy view_agenda navigation to smart_my_day fallback', () => {
    useAppStore.getState().setActiveListId('view_agenda');
    expect(useAppStore.getState().activeListId).toBe('smart_my_day');
  });

  it('allows navigation to view_goals as a primary top-level view', () => {
    useAppStore.getState().setActiveListId('view_goals');
    expect(useAppStore.getState().activeListId).toBe('view_goals');
  });

  it('gating check: habit_tracker is disabled by default and goals_habits is enabled by default', () => {
    const modules = useModuleStore.getState().modulesByName;
    expect(modules['goals_habits']).toBe(true);
    expect(modules['habit_tracker']).toBe(false);
  });
});
