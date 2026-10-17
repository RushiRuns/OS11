import type Database from 'better-sqlite3';

export class KeyResultNotFoundError extends Error {
  constructor(keyResultId: string) {
    super(`Key result not found: ${keyResultId}`);
    this.name = 'KeyResultNotFoundError';
  }
}

export function validateKeyResultExists(db: Database.Database, keyResultId?: string | null): void {
  if (!keyResultId) return;
  const row = db.prepare('SELECT 1 FROM key_results WHERE id = ?').get(keyResultId);
  if (!row) {
    throw new KeyResultNotFoundError(keyResultId);
  }
}
