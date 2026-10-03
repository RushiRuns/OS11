import type Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';

function hasTable(db: Database.Database, tableName: string): boolean {
  const row = db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?").get(tableName);
  return Boolean(row);
}

function hasColumn(db: Database.Database, tableName: string, columnName: string): boolean {
  if (!hasTable(db, tableName)) return false;
  const cols = db.pragma(`table_info(${tableName})`) as Array<{ name: string }>;
  return cols.some((c) => c.name === columnName);
}

function reconcileSchemaVersion(db: Database.Database, recordedVersion: number): number {
  if (recordedVersion <= 0) return 0;

  let verifiedVersion = recordedVersion;

  if (
    verifiedVersion >= 11 &&
    (!hasColumn(db, 'tasks', 'scheduled_start_min') || !hasColumn(db, 'tasks', 'scheduled_duration_min'))
  ) {
    verifiedVersion = 10;
  }
  if (verifiedVersion >= 10 && !hasColumn(db, 'projects', 'views')) {
    verifiedVersion = 9;
  }
  if (verifiedVersion >= 9 && !hasColumn(db, 'areas', 'is_default')) {
    verifiedVersion = 8;
  }
  if (verifiedVersion >= 8 && !hasTable(db, 'areas')) {
    verifiedVersion = 7;
  }
  if (verifiedVersion >= 7 && !hasTable(db, 'lists')) {
    verifiedVersion = 6;
  }
  if (verifiedVersion >= 6 && !hasColumn(db, 'lists', 'is_pinned')) {
    verifiedVersion = 5;
  }
  if (verifiedVersion >= 5 && !hasColumn(db, 'projects', 'group_id')) {
    verifiedVersion = 4;
  }
  if (verifiedVersion >= 4 && !hasTable(db, 'task_history')) {
    verifiedVersion = 3;
  }
  if (verifiedVersion >= 3 && !hasColumn(db, 'attachments', 'is_link')) {
    verifiedVersion = 2;
  }
  if (verifiedVersion >= 2 && !hasColumn(db, 'tasks', 'is_habit')) {
    verifiedVersion = 1;
  }
  if (verifiedVersion >= 1 && !hasTable(db, 'tasks')) {
    verifiedVersion = 0;
  }

  if (verifiedVersion !== recordedVersion) {
    console.warn(
      `[OS11 Migration] Schema desynchronization detected: recorded user_version is ${recordedVersion}, but physical schema is at v${verifiedVersion}. Re-aligning version.`
    );
    db.pragma(`user_version = ${verifiedVersion}`);
  }

  return verifiedVersion;
}

export function runMigrations(db: Database.Database, migrationsDir: string): void {
  const recordedVersion = (db.pragma('user_version', { simple: true }) as number) ?? 0;
  const currentVersion = reconcileSchemaVersion(db, recordedVersion);

  if (!fs.existsSync(migrationsDir)) {
    return;
  }

  const files = fs
    .readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  for (const file of files) {
    const versionMatch = file.match(/^(\d+)_/);
    if (!versionMatch) continue;

    const fileVersion = parseInt(versionMatch[1], 10);
    if (fileVersion > currentVersion) {
      // Create backup before applying migration on real database files
      if (db.name && db.name !== ':memory:' && fs.existsSync(db.name)) {
        try {
          const backupPath = `${db.name}.pre-v${fileVersion}.bak`;
          fs.copyFileSync(db.name, backupPath);
          console.log(`[OS11 Migration] Backed up database to ${backupPath}`);
        } catch (backupErr) {
          console.warn('[OS11 Migration] Database backup failed, proceeding with caution:', backupErr);
        }
      }

      console.log(`[OS11 Migration] Applying ${file} (target v${fileVersion})...`);
      const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf-8');
      
      const applyMigration = db.transaction(() => {
        try {
          db.exec(sql);
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err);
          if (!msg.includes('duplicate column')) {
            throw err;
          }
        }
        db.pragma(`user_version = ${fileVersion}`);
      });
      
      applyMigration();
      console.log(`[OS11 Migration] Successfully applied ${file}. Current version: ${fileVersion}`);
    }
  }
}

