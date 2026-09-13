import { BaseRepository } from './base-repository.js';
import type { Section, CreateSectionPayload, UpdateSectionPayload } from '../../shared/types/Section.js';
import { v4 as uuidv4 } from 'uuid';

export class SectionRepository extends BaseRepository {
  public getByProjectId(projectId: string): Section[] {
    const stmt = this.db.prepare(`
      SELECT * FROM sections
      WHERE project_id = ?
      ORDER BY sort_order ASC, created_at ASC
    `);
    return stmt.all(projectId) as Section[];
  }

  public getById(id: string): Section | null {
    const stmt = this.db.prepare(`SELECT * FROM sections WHERE id = ?`);
    const res = stmt.get(id) as Section | undefined;
    return res ?? null;
  }

  public create(payload: CreateSectionPayload): Section {
    const id = uuidv4();
    const now = new Date().toISOString();

    const record: Section = {
      id,
      project_id: payload.project_id,
      name: payload.name,
      sort_order: payload.sort_order ?? Date.now(),
      is_collapsed: payload.is_collapsed ? 1 : 0,
      created_at: now,
    };

    const stmt = this.db.prepare(`
      INSERT INTO sections (id, project_id, name, sort_order, is_collapsed, created_at)
      VALUES (@id, @project_id, @name, @sort_order, @is_collapsed, @created_at)
    `);

    stmt.run(record);
    return record;
  }

  public update(id: string, fields: UpdateSectionPayload): Section {
    const current = this.getById(id);
    if (!current) {
      throw new Error(`Section not found: ${id}`);
    }

    const updated: Section = {
      ...current,
      ...fields,
      id,
      is_collapsed:
        fields.is_collapsed !== undefined
          ? typeof fields.is_collapsed === 'boolean'
            ? fields.is_collapsed ? 1 : 0
            : fields.is_collapsed
          : current.is_collapsed,
    };

    const stmt = this.db.prepare(`
      UPDATE sections SET
        name = @name,
        sort_order = @sort_order,
        is_collapsed = @is_collapsed
      WHERE id = @id
    `);

    stmt.run(updated);
    return updated;
  }

  public delete(id: string): void {
    const stmt = this.db.prepare(`DELETE FROM sections WHERE id = ?`);
    stmt.run(id);
  }
}

export default SectionRepository;
