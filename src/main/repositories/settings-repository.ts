import { BaseRepository } from './base-repository.js';

export class SettingsRepository extends BaseRepository {
  public get<T>(key: string, defaultValue: T): T {
    const stmt = this.db.prepare<[string], { value: string }>('SELECT value FROM settings WHERE key = ?');
    const row = stmt.get(key);
    if (!row) return defaultValue;
    try {
      return JSON.parse(row.value) as T;
    } catch {
      return defaultValue;
    }
  }

  public set<T>(key: string, value: T): void {
    const serialized = JSON.stringify(value);
    const stmt = this.db.prepare(`
      INSERT INTO settings (key, value)
      VALUES (?, ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value
    `);
    stmt.run(key, serialized);
  }

  public getAll(): Record<string, unknown> {
    const stmt = this.db.prepare<[], { key: string; value: string }>('SELECT key, value FROM settings');
    const rows = stmt.all();
    const result: Record<string, unknown> = {};
    for (const row of rows) {
      try {
        result[row.key] = JSON.parse(row.value);
      } catch {
        result[row.key] = row.value;
      }
    }
    return result;
  }
}
