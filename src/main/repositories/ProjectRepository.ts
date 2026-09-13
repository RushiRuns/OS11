import { BaseRepository } from './base-repository.js';
import type { Project, CreateProjectPayload, UpdateProjectPayload } from '../../shared/types/Project.js';
import { v4 as uuidv4 } from 'uuid';

export class ProjectRepository extends BaseRepository {
  public getAll(): Project[] {
    const stmt = this.db.prepare(`
      SELECT * FROM projects
      ORDER BY sort_order ASC, created_at ASC
    `);
    return stmt.all() as Project[];
  }

  public getById(id: string): Project | null {
    const stmt = this.db.prepare(`
      SELECT * FROM projects WHERE id = ?
    `);
    const res = stmt.get(id) as Project | undefined;
    return res ?? null;
  }

  public create(payload: CreateProjectPayload): Project {
    const id = uuidv4();
    const now = new Date().toISOString();

    const record: Project = {
      id,
      name: payload.name,
      description: payload.description ?? null,
      color: payload.color ?? null,
      icon: payload.icon ?? null,
      status: payload.status ?? 'active',
      due_date: payload.due_date ?? null,
      default_view: payload.default_view ?? 'list',
      sort_order: payload.sort_order ?? Date.now(),
      created_at: now,
      updated_at: now,
    };

    const stmt = this.db.prepare(`
      INSERT INTO projects (
        id, name, description, color, icon, status,
        due_date, default_view, sort_order, created_at, updated_at
      ) VALUES (
        @id, @name, @description, @color, @icon, @status,
        @due_date, @default_view, @sort_order, @created_at, @updated_at
      )
    `);

    stmt.run(record);
    return record;
  }

  public update(id: string, fields: UpdateProjectPayload): Project {
    const current = this.getById(id);
    if (!current) {
      throw new Error(`Project not found: ${id}`);
    }

    const updated: Project = {
      ...current,
      ...fields,
      id,
      updated_at: new Date().toISOString(),
    };

    const stmt = this.db.prepare(`
      UPDATE projects SET
        name = @name,
        description = @description,
        color = @color,
        icon = @icon,
        status = @status,
        due_date = @due_date,
        default_view = @default_view,
        sort_order = @sort_order,
        updated_at = @updated_at
      WHERE id = @id
    `);

    stmt.run(updated);
    return updated;
  }

  public archive(id: string): void {
    const now = new Date().toISOString();
    const stmt = this.db.prepare(`
      UPDATE projects SET status = 'archived', updated_at = ? WHERE id = ?
    `);
    stmt.run(now, id);
  }

  public delete(id: string): void {
    const stmt = this.db.prepare(`DELETE FROM projects WHERE id = ?`);
    stmt.run(id);
  }
}

export default ProjectRepository;
