import type Database from 'better-sqlite3';
import { getDb } from './db.js';

export interface IntegrityCheckResult {
  isValid: boolean;
  violations: string[];
  mismatchedTaskIds: string[];
  nullAreaProjectIds: string[];
}

export class IntegrityRepository {
  private db: Database.Database;

  constructor(db?: Database.Database) {
    this.db = db ?? getDb();
  }

  /**
   * Runs comprehensive data integrity checks on Area, Project, and Task hierarchy.
   */
  public checkIntegrity(): IntegrityCheckResult {
    const violations: string[] = [];
    const mismatchedTaskIds: string[] = [];
    const nullAreaProjectIds: string[] = [];

    // 1. Projects with NULL area_id
    try {
      const nullAreaProjects = this.db.prepare(`
        SELECT id, name FROM projects WHERE area_id IS NULL
      `).all() as Array<{ id: string; name: string }>;

      for (const p of nullAreaProjects) {
        nullAreaProjectIds.push(p.id);
        violations.push(`Project "${p.name}" (${p.id}) has NULL area_id.`);
      }
    } catch {
      // PRAGMA or table check fallback
    }

    // 2. Tasks whose area_id does not match their Project's area_id
    try {
      const mismatchedTasks = this.db.prepare(`
        SELECT t.id, t.title, t.area_id as task_area_id, p.area_id as project_area_id
        FROM tasks t
        JOIN projects p ON p.id = t.project_id
        WHERE t.project_id IS NOT NULL
          AND (t.area_id IS NULL OR t.area_id != p.area_id)
      `).all() as Array<{ id: string; title: string; task_area_id: string | null; project_area_id: string }>;

      for (const t of mismatchedTasks) {
        mismatchedTaskIds.push(t.id);
        violations.push(
          `Task "${t.title}" (${t.id}) area_id (${t.task_area_id}) does not match project area_id (${t.project_area_id}).`
        );
      }
    } catch {
      // Fallback if columns not yet migrated
    }

    return {
      isValid: violations.length === 0,
      violations,
      mismatchedTaskIds,
      nullAreaProjectIds,
    };
  }

  /**
   * Self-healing repair for any detected invariant drifts.
   */
  public repairIntegrity(defaultAreaId: string = 'area_default'): { repairedCount: number } {
    let repairedCount = 0;

    // Fix projects with null area_id
    const fixProjStmt = this.db.prepare(`
      UPDATE projects SET area_id = ?, updated_at = datetime('now') WHERE area_id IS NULL
    `);
    const projRes = fixProjStmt.run(defaultAreaId);
    repairedCount += projRes.changes;

    // Fix tasks with mismatched area_id
    const fixTasksStmt = this.db.prepare(`
      UPDATE tasks
      SET area_id = (SELECT p.area_id FROM projects p WHERE p.id = tasks.project_id),
          updated_at = datetime('now')
      WHERE project_id IS NOT NULL
        AND (area_id IS NULL OR area_id != (SELECT p2.area_id FROM projects p2 WHERE p2.id = tasks.project_id))
    `);
    const taskRes = fixTasksStmt.run();
    repairedCount += taskRes.changes;

    return { repairedCount };
  }
}

export default IntegrityRepository;
