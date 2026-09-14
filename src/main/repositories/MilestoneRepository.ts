import { v4 as uuidv4 } from 'uuid';
import { BaseRepository } from './base-repository.js';
import type { Milestone, CreateMilestonePayload, UpdateMilestonePayload } from '@shared/types/index.js';

export class MilestoneRepository extends BaseRepository {
  public getByProjectId(projectId: string): Milestone[] {
    const stmt = this.db.prepare(`
      SELECT * FROM milestones
      WHERE project_id = ?
      ORDER BY due_date ASC, sort_order ASC
    `);
    return stmt.all(projectId) as Milestone[];
  }

  public getById(id: string): Milestone | null {
    const stmt = this.db.prepare(`SELECT * FROM milestones WHERE id = ?`);
    const res = stmt.get(id) as Milestone | undefined;
    return res ?? null;
  }

  public create(payload: CreateMilestonePayload): Milestone {
    const id = uuidv4();
    const now = new Date().toISOString();

    const record: Milestone = {
      id,
      project_id: payload.project_id,
      title: payload.title,
      due_date: payload.due_date,
      is_completed: payload.is_completed ? 1 : 0,
      sort_order: payload.sort_order ?? Date.now(),
      created_at: now,
    };

    const stmt = this.db.prepare(`
      INSERT INTO milestones (id, project_id, title, due_date, is_completed, sort_order, created_at)
      VALUES (@id, @project_id, @title, @due_date, @is_completed, @sort_order, @created_at)
    `);

    stmt.run(record);
    return record;
  }

  public update(id: string, fields: UpdateMilestonePayload): Milestone {
    const current = this.getById(id);
    if (!current) {
      throw new Error(`Milestone not found: ${id}`);
    }

    const updated: Milestone = {
      ...current,
      title: fields.title !== undefined ? fields.title : current.title,
      due_date: fields.due_date !== undefined ? fields.due_date : current.due_date,
      sort_order: fields.sort_order !== undefined ? fields.sort_order : current.sort_order,
      is_completed:
        fields.is_completed !== undefined
          ? fields.is_completed
            ? 1
            : 0
          : current.is_completed,
    };

    const stmt = this.db.prepare(`
      UPDATE milestones SET
        title = @title,
        due_date = @due_date,
        is_completed = @is_completed,
        sort_order = @sort_order
      WHERE id = @id
    `);

    stmt.run(updated);
    return updated;
  }

  public delete(id: string): void {
    const stmt = this.db.prepare(`DELETE FROM milestones WHERE id = ?`);
    stmt.run(id);
  }
}

export default MilestoneRepository;
