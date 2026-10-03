import { BaseRepository } from './base-repository.js';
import type { Task, CreateTaskPayload, UpdateTaskPayload } from '../../shared/types/task.js';
import { v4 as uuidv4 } from 'uuid';

export class TaskRepository extends BaseRepository {
  public getAll(): Task[] {
    const stmt = this.db.prepare(`
      SELECT * FROM tasks
      WHERE is_trashed = 0
      ORDER BY sort_order ASC, created_at DESC
    `);
    return stmt.all() as Task[];
  }

  public getByListId(listId: string, offset = 0, limit = 50): Task[] {
    const stmt = this.db.prepare(`
      SELECT * FROM tasks
      WHERE list_id = ? AND is_trashed = 0
      ORDER BY sort_order ASC, created_at DESC
      LIMIT ? OFFSET ?
    `);
    return stmt.all(listId, limit, offset) as Task[];
  }

  public getFirst50(listId?: string): Task[] {
    if (listId) {
      return this.getByListId(listId, 0, 50);
    }
    const stmt = this.db.prepare(`
      SELECT * FROM tasks
      WHERE is_trashed = 0 AND parent_task_id IS NULL
      ORDER BY sort_order ASC, created_at DESC
      LIMIT 50
    `);
    return stmt.all() as Task[];
  }

  public getByProjectId(projectId: string): Task[] {
    const stmt = this.db.prepare(`
      SELECT * FROM tasks
      WHERE project_id = ? AND is_trashed = 0
      ORDER BY sort_order ASC, created_at DESC
    `);
    return stmt.all(projectId) as Task[];
  }

  public getByAreaId(areaId: string): Task[] {
    const stmt = this.db.prepare(`
      SELECT * FROM tasks
      WHERE area_id = ? AND project_id IS NULL AND is_trashed = 0 AND parent_task_id IS NULL
      ORDER BY sort_order ASC, created_at DESC
    `);
    return stmt.all(areaId) as Task[];
  }

  public countLooseByAreaId(areaId: string, options?: { includeTrashed?: boolean }): number {
    const sql = options?.includeTrashed
      ? `SELECT COUNT(*) as count FROM tasks WHERE area_id = ? AND project_id IS NULL`
      : `SELECT COUNT(*) as count FROM tasks WHERE area_id = ? AND project_id IS NULL AND is_trashed = 0 AND parent_task_id IS NULL`;
    const stmt = this.db.prepare(sql);
    const res = stmt.get(areaId) as { count: number };
    return res?.count ?? 0;
  }

  public countAllByAreaId(areaId: string): number {
    const stmt = this.db.prepare(`
      SELECT COUNT(*) as count FROM tasks WHERE area_id = ?
    `);
    const res = stmt.get(areaId) as { count: number };
    return res?.count ?? 0;
  }

  public getInbox(): Task[] {
    const stmt = this.db.prepare(`
      SELECT * FROM tasks
      WHERE area_id IS NULL AND project_id IS NULL AND is_trashed = 0 AND parent_task_id IS NULL
      ORDER BY sort_order ASC, created_at DESC
    `);
    return stmt.all() as Task[];
  }

  public getById(id: string): Task | null {
    const stmt = this.db.prepare(`
      SELECT * FROM tasks
      WHERE id = ?
    `);
    const result = stmt.get(id) as Task | undefined;
    return result ?? null;
  }

  public getSubtasks(parentId: string): Task[] {
    const stmt = this.db.prepare(`
      SELECT * FROM tasks
      WHERE parent_task_id = ? AND is_trashed = 0
      ORDER BY sort_order ASC, created_at ASC
    `);
    return stmt.all(parentId) as Task[];
  }

  public getMyDay(date: string): Task[] {
    const stmt = this.db.prepare(`
      SELECT * FROM tasks
      WHERE my_day_date = ? AND is_trashed = 0
      ORDER BY sort_order ASC, created_at DESC
    `);
    return stmt.all(date) as Task[];
  }

  public getImportant(): Task[] {
    const stmt = this.db.prepare(`
      SELECT * FROM tasks
      WHERE is_starred = 1 AND is_trashed = 0
      ORDER BY sort_order ASC, created_at DESC
    `);
    return stmt.all() as Task[];
  }

  public getPlanned(): Task[] {
    const stmt = this.db.prepare(`
      SELECT * FROM tasks
      WHERE due_date IS NOT NULL AND is_trashed = 0 AND is_completed = 0
      ORDER BY due_date ASC, due_time ASC, sort_order ASC
    `);
    return stmt.all() as Task[];
  }

  public getAllTasks(): Task[] {
    const stmt = this.db.prepare(`
      SELECT * FROM tasks
      WHERE is_trashed = 0 AND parent_task_id IS NULL
      ORDER BY sort_order ASC, created_at DESC
    `);
    return stmt.all() as Task[];
  }

  public getCompleted(): Task[] {
    const stmt = this.db.prepare(`
      SELECT * FROM tasks
      WHERE is_completed = 1 AND is_trashed = 0
      ORDER BY completed_at DESC
    `);
    return stmt.all() as Task[];
  }

  public getTrashed(): Task[] {
    const stmt = this.db.prepare(`
      SELECT * FROM tasks
      WHERE is_trashed = 1
      ORDER BY trashed_at DESC
    `);
    return stmt.all() as Task[];
  }

  private hasAreaIdCol: boolean | null = null;
  private hasAreaId(): boolean {
    if (this.hasAreaIdCol === null) {
      try {
        const cols = this.db.pragma('table_info(tasks)') as Array<{ name: string }>;
        this.hasAreaIdCol = cols.some((c) => c.name === 'area_id');
      } catch {
        this.hasAreaIdCol = false;
      }
    }
    return this.hasAreaIdCol;
  }

  private isListIdNotNullState: boolean | null = null;
  private isListIdNotNull(): boolean {
    if (this.isListIdNotNullState === null) {
      try {
        const cols = this.db.pragma('table_info(tasks)') as Array<{ name: string; notnull: number }>;
        const col = cols.find((c) => c.name === 'list_id');
        this.isListIdNotNullState = col ? col.notnull === 1 : false;
      } catch {
        this.isListIdNotNullState = false;
      }
    }
    return this.isListIdNotNullState;
  }

  public create(payload: CreateTaskPayload | (Partial<Task> & { title: string })): Task {
    const id = ('id' in payload && payload.id) ? payload.id : uuidv4();
    const now = new Date().toISOString();

    let listId = payload.list_id ?? null;
    if (listId) {
      try {
        const checkStmt = this.db.prepare<[string], { id: string }>('SELECT id FROM lists WHERE id = ?');
        if (!checkStmt.get(listId)) {
          const inbox = checkStmt.get('list_inbox');
          if (inbox) {
            listId = 'list_inbox';
          } else {
            const fallback = this.db.prepare<[], { id: string }>('SELECT id FROM lists ORDER BY sort_order ASC LIMIT 1').get();
            listId = fallback ? fallback.id : null;
          }
        }
      } catch {
        // table might not exist
      }
    } else if (this.isListIdNotNull()) {
      try {
        const inbox = this.db.prepare<[string], { id: string }>('SELECT id FROM lists WHERE id = ?').get('list_inbox');
        if (inbox) {
          listId = 'list_inbox';
        } else {
          const fallback = this.db.prepare<[], { id: string }>('SELECT id FROM lists ORDER BY sort_order ASC LIMIT 1').get();
          listId = fallback ? fallback.id : null;
        }
      } catch {
        listId = 'list_inbox';
      }
    }

    let areaId = payload.area_id ?? null;
    if (payload.project_id && !areaId) {
      try {
        const proj = this.db.prepare<[string], { area_id: string }>('SELECT area_id FROM projects WHERE id = ?').get(payload.project_id);
        if (proj?.area_id) {
          areaId = proj.area_id;
        }
      } catch {
        // fallback
      }
    }

    const record: Task = {
      id,
      title: payload.title,
      notes: payload.notes ?? null,
      list_id: listId,
      project_id: payload.project_id ?? null,
      area_id: areaId,
      section_id: payload.section_id ?? null,
      parent_task_id: payload.parent_task_id ?? null,
      due_date: payload.due_date ?? null,
      due_time: payload.due_time ?? null,
      all_day: typeof payload.all_day === 'boolean' ? (payload.all_day ? 1 : 0) : (payload.all_day ?? 1),
      recurrence_rule: payload.recurrence_rule ?? null,
      recurrence_basis: payload.recurrence_basis ?? null,
      priority: payload.priority ?? 0,
      is_starred: typeof payload.is_starred === 'boolean' ? (payload.is_starred ? 1 : 0) : (payload.is_starred ?? 0),
      is_completed: 0,
      completed_at: null,
      estimated_minutes: payload.estimated_minutes ?? null,
      assignee_device_id: null,
      created_by_device: 'local',
      sort_order: payload.sort_order ?? Date.now(),
      my_day_date: payload.my_day_date ?? null,
      pomodoro_count: 0,
      is_habit: typeof payload.is_habit === 'boolean' ? (payload.is_habit ? 1 : 0) : (payload.is_habit ?? 0),
      is_trashed: 0,
      trashed_at: null,
      created_at: now,
      updated_at: now,
    };

    let sqlCols = `
      id, title, notes, list_id, project_id, section_id,
      parent_task_id, due_date, due_time, all_day,
      recurrence_rule, recurrence_basis, priority,
      is_starred, is_completed, completed_at, estimated_minutes,
      assignee_device_id, created_by_device, sort_order,
      my_day_date, pomodoro_count, is_habit, is_trashed, trashed_at,
      created_at, updated_at
    `;
    let sqlVals = `
      @id, @title, @notes, @list_id, @project_id, @section_id,
      @parent_task_id, @due_date, @due_time, @all_day,
      @recurrence_rule, @recurrence_basis, @priority,
      @is_starred, @is_completed, @completed_at, @estimated_minutes,
      @assignee_device_id, @created_by_device, @sort_order,
      @my_day_date, @pomodoro_count, @is_habit, @is_trashed, @trashed_at,
      @created_at, @updated_at
    `;

    if (this.hasAreaId()) {
      sqlCols += ', area_id';
      sqlVals += ', @area_id';
    }

    const stmt = this.db.prepare(`
      INSERT INTO tasks (${sqlCols}) VALUES (${sqlVals})
    `);

    stmt.run(record);
    return record;
  }

  public update(idOrPayload: string | (UpdateTaskPayload & { id: string }), fields?: Partial<Task> | UpdateTaskPayload): Task {
    const id = typeof idOrPayload === 'string' ? idOrPayload : idOrPayload.id;
    const actualFields = (typeof idOrPayload === 'string' ? fields : idOrPayload) ?? {};
    const current = this.getById(id);
    if (!current) {
      throw new Error(`Task not found: ${id}`);
    }

    if (actualFields.project_id !== undefined && actualFields.project_id !== null && actualFields.area_id === undefined) {
      try {
        const proj = this.db.prepare<[string], { area_id: string }>('SELECT area_id FROM projects WHERE id = ?').get(actualFields.project_id);
        if (proj?.area_id) {
          actualFields.area_id = proj.area_id;
        }
      } catch {
        // fallback
      }
    }

    const isCompleted = actualFields.is_completed !== undefined
      ? (typeof actualFields.is_completed === 'boolean' ? (actualFields.is_completed ? 1 : 0) : actualFields.is_completed)
      : current.is_completed;

    let completedAt = current.completed_at;
    if (actualFields.is_completed !== undefined) {
      if (isCompleted === 1 && !completedAt) {
        completedAt = new Date().toISOString();
      } else if (isCompleted === 0) {
        completedAt = null;
      }
    }

    const updated: Task = {
      ...current,
      ...actualFields,
      id, // Preserve id
      area_id: actualFields.area_id !== undefined ? actualFields.area_id : current.area_id,
      all_day: actualFields.all_day !== undefined
        ? (typeof actualFields.all_day === 'boolean' ? (actualFields.all_day ? 1 : 0) : actualFields.all_day)
        : current.all_day,
      is_starred: actualFields.is_starred !== undefined
        ? (typeof actualFields.is_starred === 'boolean' ? (actualFields.is_starred ? 1 : 0) : actualFields.is_starred)
        : current.is_starred,
      is_completed: isCompleted,
      completed_at: completedAt,
      is_habit: actualFields.is_habit !== undefined
        ? (typeof actualFields.is_habit === 'boolean' ? (actualFields.is_habit ? 1 : 0) : actualFields.is_habit)
        : (current.is_habit ?? 0),
      updated_at: new Date().toISOString(),
    };

    let setClauses = `
      title = @title,
      notes = @notes,
      list_id = @list_id,
      project_id = @project_id,
      section_id = @section_id,
      parent_task_id = @parent_task_id,
      due_date = @due_date,
      due_time = @due_time,
      all_day = @all_day,
      recurrence_rule = @recurrence_rule,
      recurrence_basis = @recurrence_basis,
      priority = @priority,
      is_starred = @is_starred,
      is_completed = @is_completed,
      completed_at = @completed_at,
      estimated_minutes = @estimated_minutes,
      sort_order = @sort_order,
      my_day_date = @my_day_date,
      pomodoro_count = @pomodoro_count,
      is_habit = @is_habit,
      is_trashed = @is_trashed,
      trashed_at = @trashed_at,
      updated_at = @updated_at
    `;

    if (this.hasAreaId()) {
      setClauses += ', area_id = @area_id';
    }

    const stmt = this.db.prepare(`
      UPDATE tasks SET ${setClauses} WHERE id = @id
    `);

    stmt.run(updated);
    return updated;
  }

  public complete(id: string, completedAt?: string): void {
    const timestamp = completedAt ?? new Date().toISOString();
    const stmt = this.db.prepare(`
      UPDATE tasks SET
        is_completed = 1,
        completed_at = ?,
        updated_at = ?
      WHERE id = ?
    `);
    stmt.run(timestamp, timestamp, id);
  }

  public uncomplete(id: string): void {
    const now = new Date().toISOString();
    const stmt = this.db.prepare(`
      UPDATE tasks SET
        is_completed = 0,
        completed_at = NULL,
        updated_at = ?
      WHERE id = ?
    `);
    stmt.run(now, id);
  }

  public toggleComplete(id: string): Task {
    const task = this.getById(id);
    if (!task) {
      throw new Error(`Task with id ${id} not found`);
    }

    if (task.is_completed === 1) {
      this.uncomplete(id);
    } else {
      this.complete(id);
    }

    return this.getById(id)!;
  }

  public star(id: string): void {
    const now = new Date().toISOString();
    const stmt = this.db.prepare(`
      UPDATE tasks SET is_starred = 1, updated_at = ? WHERE id = ?
    `);
    stmt.run(now, id);
  }

  public unstar(id: string): void {
    const now = new Date().toISOString();
    const stmt = this.db.prepare(`
      UPDATE tasks SET is_starred = 0, updated_at = ? WHERE id = ?
    `);
    stmt.run(now, id);
  }

  public trash(id: string, trashedAt?: string): void {
    const timestamp = trashedAt ?? new Date().toISOString();
    const stmt = this.db.prepare(`
      UPDATE tasks SET is_trashed = 1, trashed_at = ?, updated_at = ? WHERE id = ?
    `);
    stmt.run(timestamp, timestamp, id);
  }

  public restore(id: string): void {
    const hasArea = this.hasAreaId();
    const now = new Date().toISOString();

    if (!hasArea) {
      const stmt = this.db.prepare(`
        UPDATE tasks
        SET is_trashed = 0,
            trashed_at = NULL,
            updated_at = ?
        WHERE id = ?
      `);
      stmt.run(now, id);
      return;
    }

    const task = this.getById(id);
    let targetProjectId = task?.project_id ?? null;
    let targetAreaId = task?.area_id ?? null;

    if (targetProjectId) {
      try {
        const proj = this.db.prepare(`SELECT id, area_id FROM projects WHERE id = ?`).get(targetProjectId) as
          | { id: string; area_id: string | null }
          | undefined;
        if (!proj) {
          targetProjectId = null;
          targetAreaId = null;
        } else {
          targetAreaId = proj.area_id ?? targetAreaId;
        }
      } catch {
        targetProjectId = null;
        targetAreaId = null;
      }
    }

    if (targetAreaId) {
      try {
        const area = this.db.prepare(`SELECT id FROM areas WHERE id = ?`).get(targetAreaId);
        if (!area) {
          targetAreaId = null;
          targetProjectId = null;
        }
      } catch {
        targetAreaId = null;
        targetProjectId = null;
      }
    }

    const stmt = this.db.prepare(`
      UPDATE tasks
      SET is_trashed = 0,
          trashed_at = NULL,
          project_id = ?,
          area_id = ?,
          updated_at = ?
      WHERE id = ?
    `);
    stmt.run(targetProjectId, targetAreaId, now, id);
  }

  public delete(id: string): boolean {
    this.trash(id);
    return true;
  }

  public permanentDelete(id: string): void {
    const stmt = this.db.prepare(`DELETE FROM tasks WHERE id = ?`);
    stmt.run(id);
  }

  public updateAreaByProjectId(projectId: string, areaId: string): void {
    const now = new Date().toISOString();
    const stmt = this.db.prepare(`
      UPDATE tasks SET area_id = ?, updated_at = ? WHERE project_id = ?
    `);
    stmt.run(areaId, now, projectId);
  }

  public addToMyDay(id: string, date: string): void {
    const now = new Date().toISOString();
    const stmt = this.db.prepare(`
      UPDATE tasks SET my_day_date = ?, updated_at = ? WHERE id = ?
    `);
    stmt.run(date, now, id);
  }

  public removeFromMyDay(id: string): void {
    const now = new Date().toISOString();
    const stmt = this.db.prepare(`
      UPDATE tasks SET my_day_date = NULL, updated_at = ? WHERE id = ?
    `);
    stmt.run(now, id);
  }

  public updateSortOrder(id: string, sortOrder: number): void {
    const now = new Date().toISOString();
    const stmt = this.db.prepare(`
      UPDATE tasks SET sort_order = ?, updated_at = ? WHERE id = ?
    `);
    stmt.run(sortOrder, now, id);
  }

  public incrementPomodoro(id: string): Task {
    const now = new Date().toISOString();
    const stmt = this.db.prepare(`
      UPDATE tasks
      SET pomodoro_count = pomodoro_count + 1,
          updated_at = ?
      WHERE id = ?
    `);
    stmt.run(now, id);
    return this.getById(id)!;
  }
}

export default TaskRepository;
