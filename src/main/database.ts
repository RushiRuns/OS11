import type Database from 'better-sqlite3';
import { getDb, initDb, closeDb } from './repositories/db.js';

export function getDatabase(): Database.Database {
  return getDb();
}

export function initDatabase(customPath?: string): Database.Database {
  return initDb(customPath);
}

export function closeDatabase(): void {
  closeDb();
}

export default getDatabase;
