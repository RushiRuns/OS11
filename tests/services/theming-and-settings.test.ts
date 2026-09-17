import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import os from 'os';

import { SettingsRepository } from '../../src/main/repositories/SettingsRepository.js';
import { SettingsService } from '../../src/main/services/settings/SettingsService.js';
import { ThemeService } from '../../src/main/services/settings/ThemeService.js';
import { AppLockService, constantTimeEqual } from '../../src/main/services/security/AppLockService.js';
import { ModuleRepository } from '../../src/main/repositories/ModuleRepository.js';
import { TaskRepository } from '../../src/main/repositories/TaskRepository.js';
import { ListRepository } from '../../src/main/repositories/ListRepository.js';

describe('Phase 16: Theming, Settings & Module System', () => {
  let db: Database.Database;
  let settingsRepo: SettingsRepository;
  let settingsService: SettingsService;
  let themeService: ThemeService;
  let appLockService: AppLockService;
  let moduleRepo: ModuleRepository;
  let taskRepo: TaskRepository;
  let listRepo: ListRepository;
  let tempDir: string;

  beforeEach(() => {
    vi.clearAllMocks();
    db = new Database(':memory:');
    db.pragma('foreign_keys = ON');

    const schemaPath = path.resolve(__dirname, '../../src/main/migrations/0001_initial_schema.sql');
    const schemaSql = fs.readFileSync(schemaPath, 'utf8');
    db.exec(schemaSql);

    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'os11-settings-test-'));

    settingsRepo = new SettingsRepository(db);
    settingsService = new SettingsService(settingsRepo);
    themeService = new ThemeService(settingsRepo);
    appLockService = new AppLockService(settingsRepo);
    moduleRepo = new ModuleRepository(db);
    taskRepo = new TaskRepository(db);
    listRepo = new ListRepository(db);
  });

  afterEach(() => {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore
    }
  });

  describe('ThemeService', () => {
    it('applies theme and stores in repository', () => {
      const resLight = themeService.applyTheme('light');
      expect(resLight.theme).toBe('light');
      expect(resLight.effectiveTheme).toBe('light');
      expect(settingsRepo.get('theme')).toBe('light');

      const resDark = themeService.applyTheme('dark');
      expect(resDark.theme).toBe('dark');
      expect(resDark.effectiveTheme).toBe('dark');
      expect(settingsRepo.get('theme')).toBe('dark');
    });

    it('applies accent color and stores hex', () => {
      const hex = '#27AE60';
      const applied = themeService.applyAccentColor(hex);
      expect(applied).toBe(hex);
      expect(settingsRepo.get('accent_color')).toBe(hex);
    });
  });

  describe('AppLockService', () => {
    it('performs constant-time string comparison', () => {
      expect(constantTimeEqual('1234', '1234')).toBe(true);
      expect(constantTimeEqual('1234', '1235')).toBe(false);
      expect(constantTimeEqual('1234', '12345')).toBe(false);
      expect(constantTimeEqual('abcd', 'abce')).toBe(false);
    });

    it('sets and verifies PIN correctly', async () => {
      await expect(appLockService.setPin('12')).rejects.toThrow('at least 4 digits');

      const ok = await appLockService.setPin('1234');
      expect(ok).toBe(true);
      expect(appLockService.isEnabled()).toBe(true);

      const isCorrect = await appLockService.verifyPin('1234');
      expect(isCorrect).toBe(true);

      const isWrong = await appLockService.verifyPin('9999');
      expect(isWrong).toBe(false);
    });

    it('locks and unlocks the session', async () => {
      await appLockService.setPin('4321');
      expect(appLockService.isLocked()).toBe(false);

      appLockService.lock();
      expect(appLockService.isLocked()).toBe(true);

      const verified = await appLockService.verifyPin('4321');
      expect(verified).toBe(true);
      expect(appLockService.isLocked()).toBe(false);
    });

    it('disables lock when correct PIN is supplied', async () => {
      await appLockService.setPin('5555');
      expect(appLockService.isEnabled()).toBe(true);

      // Fails with wrong PIN
      await expect(appLockService.setEnabled(false, '0000')).rejects.toThrow('Incorrect PIN');

      // Succeeds with correct PIN
      const res = await appLockService.setEnabled(false, '5555');
      expect(res).toBe(true);
      expect(appLockService.isEnabled()).toBe(false);
    });
  });

  describe('SettingsService & Trash Management', () => {
    it('resets settings to factory defaults', () => {
      settingsService.set('theme', 'light');
      settingsService.set('accent_color', '#E74C3C');

      const resetData = settingsService.reset();
      expect(resetData.theme).toBe('auto');
      expect(resetData.accent_color).toBe('#1B88FF');
      expect(resetData.font_size).toBe('md');
      expect(resetData.density).toBe('comfortable');
    });

    it('empties trash by removing all tasks with is_trashed = 1', () => {
      // Create active list
      const list = listRepo.create({
        name: 'Test List',
        color: '#1B88FF',
        icon: '📁',
      });

      // Create trashed and untrashed tasks
      taskRepo.create({
        title: 'Active Task',
        list_id: list.id,
      });

      const trashed1 = taskRepo.create({
        title: 'Trashed Task 1',
        list_id: list.id,
      });
      const trashed2 = taskRepo.create({
        title: 'Trashed Task 2',
        list_id: list.id,
      });

      taskRepo.trash(trashed1.id);
      taskRepo.trash(trashed2.id);

      const deletedCount = settingsService.emptyTrash();
      expect(deletedCount).toBe(2);

      const remaining = taskRepo.getAll();
      expect(remaining.length).toBe(1);
      expect(remaining[0].title).toBe('Active Task');
    });
  });

  describe('ModuleRepository & Profile Presets', () => {
    it('toggles individual modules', () => {
      moduleRepo.toggle('vim_keybindings', true);
      expect(moduleRepo.isEnabled('vim_keybindings')).toBe(true);

      moduleRepo.toggle('vim_keybindings', false);
      expect(moduleRepo.isEnabled('vim_keybindings')).toBe(false);
    });

    it('applies Minimalist preset', () => {
      moduleRepo.applyPreset('minimalist');
      expect(moduleRepo.isEnabled('my_day')).toBe(true);
      expect(moduleRepo.isEnabled('project_management')).toBe(false);
      expect(moduleRepo.isEnabled('pomodoro')).toBe(false);
      expect(moduleRepo.isEnabled('agenda')).toBe(false);
      expect(moduleRepo.isEnabled('goals_habits')).toBe(false);
    });

    it('applies GTD Mode preset', () => {
      moduleRepo.applyPreset('gtd');
      expect(moduleRepo.isEnabled('my_day')).toBe(true);
      expect(moduleRepo.isEnabled('project_management')).toBe(true);
      expect(moduleRepo.isEnabled('agenda')).toBe(true);
      expect(moduleRepo.isEnabled('goals_habits')).toBe(true);
      expect(moduleRepo.isEnabled('pomodoro')).toBe(false);
    });

    it('applies Focus Mode preset', () => {
      moduleRepo.applyPreset('focus');
      expect(moduleRepo.isEnabled('my_day')).toBe(true);
      expect(moduleRepo.isEnabled('pomodoro')).toBe(true);
      expect(moduleRepo.isEnabled('agenda')).toBe(true);
      expect(moduleRepo.isEnabled('project_management')).toBe(false);
    });
  });
});
