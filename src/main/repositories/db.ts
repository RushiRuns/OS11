import Database from 'better-sqlite3';
import { app } from 'electron';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { runMigrations } from '../migrations/runner.js';

let dbInstance: Database.Database | null = null;

export function resolveMigrationsDir(): string {
  if (app?.isPackaged) {
    return path.join(process.resourcesPath, 'migrations');
  }

  // Handle ESM directory resolution in dev & test environments
  try {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    const candidateDirs = [
      path.join(__dirname, '../migrations'),
      path.join(__dirname, '../../migrations'),
      path.join(process.cwd(), 'src/main/migrations'),
    ];
    return candidateDirs.find(d => fs.existsSync(d)) || path.join(process.cwd(), 'src/main/migrations');
  } catch {
    return path.join(process.cwd(), 'src/main/migrations');
  }
}

export function initDb(customDbPath?: string): Database.Database {
  if (dbInstance) {
    return dbInstance;
  }

  let dbPath = customDbPath || process.env.OS11_DB_PATH;

  if (!dbPath) {
    const userDataPath = app?.getPath ? app.getPath('userData') : path.join(process.cwd(), '.os11-dev');
    if (!fs.existsSync(userDataPath)) {
      fs.mkdirSync(userDataPath, { recursive: true });
    }
    dbPath = path.join(userDataPath, 'os11.db');
  } else if (dbPath !== ':memory:') {
    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  const db = new Database(dbPath);

  // Apply all pragmas from PERFORMANCE.md §14 before any query runs
  db.pragma('journal_mode = WAL');
  db.pragma('synchronous = NORMAL');
  db.pragma('foreign_keys = ON');
  db.pragma('cache_size = -32000');
  db.pragma('temp_store = MEMORY');
  db.pragma('mmap_size = 268435456');

  // Run initial schema & migrations
  const migrationsDir = resolveMigrationsDir();
  runMigrations(db, migrationsDir);

  dbInstance = db;
  return db;
}

export function getDb(): Database.Database {
  if (!dbInstance) {
    return initDb();
  }
  return dbInstance;
}

export function closeDb(): void {
  if (dbInstance) {
    try {
      dbInstance.close();
    } catch {
      // Ignore already closed
    }
    dbInstance = null;
  }
}

// Default export of the singleton db accessor
export const db = {
  get instance(): Database.Database {
    return getDb();
  },
  prepare(source: string) {
    return getDb().prepare(source);
  },
  transaction<F extends (...args: any[]) => unknown>(fn: F) {
    return getDb().transaction(fn);
  },
  pragma(pragma: string, options?: Database.PragmaOptions) {
    return getDb().pragma(pragma, options);
  },
};

export default db;
