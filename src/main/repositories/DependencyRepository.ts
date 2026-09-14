import { BaseRepository } from './base-repository.js';
import type { TaskDependency } from '@shared/types/index.js';

export class DependencyRepository extends BaseRepository {
  public getAll(): TaskDependency[] {
    const stmt = this.db.prepare(`
      SELECT task_id, depends_on_id FROM task_dependencies
    `);
    return stmt.all() as TaskDependency[];
  }

  public getByTaskId(taskId: string): string[] {
    const stmt = this.db.prepare(`
      SELECT depends_on_id FROM task_dependencies
      WHERE task_id = ?
    `);
    const rows = stmt.all(taskId) as { depends_on_id: string }[];
    return rows.map((r) => r.depends_on_id);
  }

  public getDependents(taskId: string): string[] {
    const stmt = this.db.prepare(`
      SELECT task_id FROM task_dependencies
      WHERE depends_on_id = ?
    `);
    const rows = stmt.all(taskId) as { task_id: string }[];
    return rows.map((r) => r.task_id);
  }

  public getByProjectId(projectId: string): TaskDependency[] {
    const stmt = this.db.prepare(`
      SELECT td.task_id, td.depends_on_id
      FROM task_dependencies td
      JOIN tasks t ON td.task_id = t.id
      WHERE t.project_id = ?
    `);
    return stmt.all(projectId) as TaskDependency[];
  }

  public add(taskId: string, dependsOnId: string): void {
    const stmt = this.db.prepare(`
      INSERT OR IGNORE INTO task_dependencies (task_id, depends_on_id)
      VALUES (?, ?)
    `);
    stmt.run(taskId, dependsOnId);
  }

  public remove(taskId: string, dependsOnId: string): void {
    const stmt = this.db.prepare(`
      DELETE FROM task_dependencies
      WHERE task_id = ? AND depends_on_id = ?
    `);
    stmt.run(taskId, dependsOnId);
  }
}

export default DependencyRepository;
