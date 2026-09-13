import Database from 'better-sqlite3';
import { app } from 'electron';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { runMigrations } from './migrations/runner.js';

let dbInstance: Database.Database | null = null;

export function getDatabase(): Database.Database {
  if (!dbInstance) {
    throw new Error('Database not initialized. Call initDatabase() first.');
  }
  return dbInstance;
}

export function initDatabase(): Database.Database {
  if (dbInstance) {
    return dbInstance;
  }

  const userDataPath = app.getPath('userData');
  if (!fs.existsSync(userDataPath)) {
    fs.mkdirSync(userDataPath, { recursive: true });
  }

  const dbPath = path.join(userDataPath, 'os11.db');
  console.log(`[OS11 Database] Opening SQLite database at: ${dbPath}`);

  const db = new Database(dbPath);

  // Mandatory Performance & Integrity Pragmas per ARCHITECTURE.md & PERFORMANCE.md
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.pragma('busy_timeout = 5000');
  db.pragma('synchronous = NORMAL');

  // Locate migrations folder
  let migrationsDir: string;
  if (app.isPackaged) {
    migrationsDir = path.join(process.resourcesPath, 'migrations');
  } else {
    // In dev, resolve relative to current file or project root
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    const candidateDirs = [
      path.join(__dirname, 'migrations'),
      path.join(__dirname, '../src/main/migrations'),
      path.join(process.cwd(), 'src/main/migrations'),
    ];
    migrationsDir = candidateDirs.find((d) => fs.existsSync(d)) || path.join(__dirname, 'migrations');
  }

  console.log(`[OS11 Database] Running migrations from: ${migrationsDir}`);
  runMigrations(db, migrationsDir);

  dbInstance = db;
  return db;
}

export function closeDatabase(): void {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
  }
}
