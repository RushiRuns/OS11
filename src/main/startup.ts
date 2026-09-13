import { initDb } from './repositories/db.js';
import { ListRepository } from './repositories/ListRepository.js';
import { TaskRepository } from './repositories/TaskRepository.js';
import { SettingsRepository } from './repositories/SettingsRepository.js';
import { ModuleRepository } from './repositories/ModuleRepository.js';
import { IdentityRepository } from './repositories/IdentityRepository.js';
import { workerManager } from './services/worker-manager.js';
import { ReminderService } from './services/reminder/ReminderService.js';
import type { List, Task, LocalIdentity, Module } from '@shared/types/index.js';
import { app } from 'electron';
import path from 'node:path';

export interface StartupPayload {
  lists: List[];
  activeTasks: Task[];
  settings: Record<string, unknown>;
  modules: Module[];
  identity: LocalIdentity;
}

let cachedStartupData: StartupPayload | null = null;
let reminderServiceInstance: ReminderService | null = null;

export async function runStartupSequence(): Promise<StartupPayload> {
  // 1. Run migrations synchronously first (PERFORMANCE.md §3)
  initDb();

  const listRepo = new ListRepository();
  const taskRepo = new TaskRepository();
  const settingsRepo = new SettingsRepository();
  const moduleRepo = new ModuleRepository();
  const identityRepo = new IdentityRepository();

  const dbPath = path.join(
    typeof app !== 'undefined' && app.getPath ? app.getPath('userData') : process.cwd(),
    'os11.db'
  );

  // 2. Parallel startup operations via Promise.all (PERFORMANCE.md §3)
  const [lists, settings, modules, identity] = await Promise.all([
    Promise.resolve(listRepo.getAll()),
    Promise.resolve(settingsRepo.getAll()),
    Promise.resolve(moduleRepo.getAll()),
    Promise.resolve(identityRepo.get()),
    Promise.resolve(workerManager.init(dbPath)),
  ]);

  // Load first 50 active tasks for instant display
  const defaultListId = lists[0]?.id || 'smart_my_day';
  const activeTasks = taskRepo.getFirst50(defaultListId);

  // Start background reminder processing
  reminderServiceInstance = new ReminderService();
  reminderServiceInstance.processOverdueAtStartup();

  cachedStartupData = {
    lists,
    activeTasks,
    settings,
    modules,
    identity,
  };

  return cachedStartupData;
}

export async function getStartupData(): Promise<StartupPayload> {
  if (cachedStartupData) {
    return cachedStartupData;
  }
  return runStartupSequence();
}

export function getReminderService(): ReminderService | null {
  return reminderServiceInstance;
}
