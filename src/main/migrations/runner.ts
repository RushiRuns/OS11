import type Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';

export function runMigrations(db: Database.Database, migrationsDir: string): void {
  const currentVersion = (db.pragma('user_version', { simple: true }) as number) ?? 0;

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
