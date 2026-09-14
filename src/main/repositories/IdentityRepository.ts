import { v4 as uuidv4 } from 'uuid';
import { BaseRepository } from './base-repository.js';
import type { LocalIdentity } from '@shared/types/index.js';

export class IdentityRepository extends BaseRepository {
  public get(): LocalIdentity {
    const stmt = this.db.prepare<[], LocalIdentity>(`
      SELECT id, display_name, avatar_emoji, created_at
      FROM local_identity
      LIMIT 1
    `);
    const row = stmt.get();
    if (row) {
      return row;
    }
    return this.create();
  }

  public create(): LocalIdentity {
    const identity: LocalIdentity = {
      id: uuidv4(),
      display_name: 'Local User',
      avatar_emoji: null,
      created_at: new Date().toISOString(),
    };

    const stmt = this.db.prepare(`
      INSERT INTO local_identity (id, display_name, avatar_emoji, created_at)
      VALUES (?, ?, ?, ?)
    `);
    stmt.run(identity.id, identity.display_name, identity.avatar_emoji, identity.created_at);
    return identity;
  }

  public updateDisplayName(name: string): void {
    this.updateIdentity(name);
  }

  public updateIdentity(displayName?: string, avatarEmoji?: string | null): void {
    const identity = this.get();
    const fields: string[] = [];
    const params: (string | null)[] = [];

    if (displayName !== undefined) {
      fields.push('display_name = ?');
      params.push(displayName);
    }
    if (avatarEmoji !== undefined) {
      fields.push('avatar_emoji = ?');
      params.push(avatarEmoji);
    }

    if (fields.length === 0) return;

    params.push(identity.id);
    const stmt = this.db.prepare(`
      UPDATE local_identity
      SET ${fields.join(', ')}
      WHERE id = ?
    `);
    stmt.run(...params);
  }
}
