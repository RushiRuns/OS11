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
      WHERE due_date IS NOT NULL AND is_trashed = 0
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

  public create(payload: CreateTaskPayload | (Partial<Task> & { title: string })): Task {
    const id = ('id' in payload && payload.id) ? payload.id : uuidv4();
    const now = new Date().toISOString();

    const record: Task = {
      id,
      title: payload.title,
      notes: payload.notes ?? null,
      list_id: payload.list_id ?? 'list_inbox',
      project_id: payload.project_id ?? null,
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

    const stmt = this.db.prepare(`
      INSERT INTO tasks (
        id, title, notes, list_id, project_id, section_id,
        parent_task_id, due_date, due_time, all_day,
        recurrence_rule, recurrence_basis, priority,
        is_starred, is_completed, completed_at, estimated_minutes,
        assignee_device_id, created_by_device, sort_order,
        my_day_date, pomodoro_count, is_habit, is_trashed, trashed_at,
        created_at, updated_at
      ) VALUES (
        @id, @title, @notes, @list_id, @project_id, @section_id,
        @parent_task_id, @due_date, @due_time, @all_day,
        @recurrence_rule, @recurrence_basis, @priority,
        @is_starred, @is_completed, @completed_at, @estimated_minutes,
        @assignee_device_id, @created_by_device, @sort_order,
        @my_day_date, @pomodoro_count, @is_habit, @is_trashed, @trashed_at,
        @created_at, @updated_at
      )
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

    const stmt = this.db.prepare(`
      UPDATE tasks SET
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
      WHERE id = @id
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
    const now = new Date().toISOString();
    const stmt = this.db.prepare(`
      UPDATE tasks SET is_trashed = 0, trashed_at = NULL, updated_at = ? WHERE id = ?
    `);
    stmt.run(now, id);
  }

  public delete(id: string): boolean {
    this.trash(id);
    return true;
  }

  public permanentDelete(id: string): void {
    const stmt = this.db.prepare(`DELETE FROM tasks WHERE id = ?`);
    stmt.run(id);
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
