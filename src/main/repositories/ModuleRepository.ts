import { BaseRepository } from './base-repository.js';
import type { Module } from '@shared/types/index.js';

export class ModuleRepository extends BaseRepository {
  public getAll(): Module[] {
    const stmt = this.db.prepare<[], Module>(`
      SELECT module_name, is_enabled
      FROM modules
      ORDER BY module_name ASC
    `);
    return stmt.all();
  }

  public isEnabled(moduleName: string): boolean {
    const stmt = this.db.prepare<[string], { is_enabled: number }>(`
      SELECT is_enabled
      FROM modules
      WHERE module_name = ?
    `);
    const row = stmt.get(moduleName);
    return row ? row.is_enabled === 1 : false;
  }

  public toggle(moduleName: string, enabled: boolean): void {
    const stmt = this.db.prepare(`
      INSERT INTO modules (module_name, is_enabled)
      VALUES (?, ?)
      ON CONFLICT(module_name) DO UPDATE SET is_enabled = excluded.is_enabled
    `);
    stmt.run(moduleName, enabled ? 1 : 0);
  }

  public applyPreset(preset: 'minimalist' | 'gtd' | 'focus' | 'custom'): Module[] {
    if (preset === 'custom') {
      return this.getAll();
    }

    const allModules = this.getAll().map((m) => m.module_name);
    let enabledList: string[] = [];

    if (preset === 'minimalist') {
      enabledList = ['my_day'];
    } else if (preset === 'gtd') {
      enabledList = ['my_day', 'project_management', 'agenda', 'goals_habits'];
    } else if (preset === 'focus') {
      enabledList = ['my_day', 'pomodoro', 'agenda'];
    }

    const stmt = this.db.prepare(`
      INSERT INTO modules (module_name, is_enabled)
      VALUES (?, ?)
      ON CONFLICT(module_name) DO UPDATE SET is_enabled = excluded.is_enabled
    `);

    const updateMany = this.db.transaction(() => {
      for (const mod of allModules) {
        stmt.run(mod, enabledList.includes(mod) ? 1 : 0);
      }
    });

    updateMany();
    return this.getAll();
  }
}

