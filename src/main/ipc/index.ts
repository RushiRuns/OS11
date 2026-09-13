import { ipcMain, BrowserWindow } from 'electron';
import { IPC } from '@shared/ipc-channels.js';
import { TaskService } from '../services/task/task-service.js';
import { SettingsService } from '../services/settings/settings-service.js';
import type { CreateTaskPayload, UpdateTaskPayload } from '@shared/types/task.js';

export function registerIpcHandlers(): void {
  const taskService = new TaskService();
  const settingsService = new SettingsService();

  // Tasks: Get All
  ipcMain.handle(IPC.TASKS.GET_ALL, async () => {
    try {
      const tasks = taskService.getAll();
      return { ok: true, data: tasks };
    } catch (err: any) {
      return { ok: false, error: err.message || 'Failed to fetch tasks.' };
    }
  });

  // Tasks: Get By ID
  ipcMain.handle(IPC.TASKS.GET_BY_ID, async (_event, id: string) => {
    try {
      const task = taskService.getById(id);
      return { ok: true, data: task };
    } catch (err: any) {
      return { ok: false, error: err.message || 'Failed to fetch task.' };
    }
  });

  // Tasks: Create
  ipcMain.handle(IPC.TASKS.CREATE, async (_event, payload: CreateTaskPayload) => {
    try {
      const task = taskService.create(payload);
      return { ok: true, data: task };
    } catch (err: any) {
      return { ok: false, error: err.message || 'Failed to create task.' };
    }
  });

  // Tasks: Update
  ipcMain.handle(IPC.TASKS.UPDATE, async (_event, payload: UpdateTaskPayload) => {
    try {
      const task = taskService.update(payload);
      return { ok: true, data: task };
    } catch (err: any) {
      return { ok: false, error: err.message || 'Failed to update task.' };
    }
  });

  // Tasks: Toggle Complete
  ipcMain.handle(IPC.TASKS.TOGGLE_COMPLETE, async (_event, id: string) => {
    try {
      const task = taskService.toggleComplete(id);
      return { ok: true, data: task };
    } catch (err: any) {
      return { ok: false, error: err.message || 'Failed to toggle task.' };
    }
  });

  // Tasks: Delete
  ipcMain.handle(IPC.TASKS.DELETE, async (_event, id: string) => {
    try {
      const success = taskService.delete(id);
      return { ok: true, data: success };
    } catch (err: any) {
      return { ok: false, error: err.message || 'Failed to delete task.' };
    }
  });

  // Settings & System
  ipcMain.handle(IPC.SETTINGS.GET_ALL, async () => {
    try {
      const all = settingsService.getAll();
      return { ok: true, data: all };
    } catch (err: any) {
      return { ok: false, error: err.message || 'Failed to get settings.' };
    }
  });

  ipcMain.handle(IPC.SETTINGS.GET, async (_event, { key, defaultValue }: { key: string; defaultValue: unknown }) => {
    try {
      const val = settingsService.get(key, defaultValue);
      return { ok: true, data: val };
    } catch (err: any) {
      return { ok: false, error: err.message || 'Failed to get setting.' };
    }
  });

  ipcMain.handle(IPC.SETTINGS.SET, async (_event, { key, value }: { key: string; value: unknown }) => {
    try {
      settingsService.set(key, value);
      return { ok: true, data: true };
    } catch (err: any) {
      return { ok: false, error: err.message || 'Failed to set setting.' };
    }
  });

  ipcMain.handle(IPC.SYSTEM.GET_INFO, async () => {
    try {
      const info = settingsService.getSystemInfo();
      return { ok: true, data: info };
    } catch (err: any) {
      return { ok: false, error: err.message || 'Failed to get system info.' };
    }
  });

  // Window Controls
  ipcMain.handle(IPC.SYSTEM.MINIMIZE, async (event) => {
    try {
      const win = BrowserWindow.fromWebContents(event.sender);
      win?.minimize();
      return { ok: true, data: true };
    } catch (err: any) {
      return { ok: false, error: err.message };
    }
  });

  ipcMain.handle(IPC.SYSTEM.MAXIMIZE, async (event) => {
    try {
      const win = BrowserWindow.fromWebContents(event.sender);
      if (win?.isMaximized()) {
        win.unmaximize();
      } else {
        win?.maximize();
      }
      return { ok: true, data: true };
    } catch (err: any) {
      return { ok: false, error: err.message };
    }
  });

  ipcMain.handle(IPC.SYSTEM.CLOSE, async (event) => {
    try {
      const win = BrowserWindow.fromWebContents(event.sender);
      win?.close();
      return { ok: true, data: true };
    } catch (err: any) {
      return { ok: false, error: err.message };
    }
  });
}
