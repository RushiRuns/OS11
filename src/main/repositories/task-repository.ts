import { BaseRepository } from './base-repository.js';
import type { Task } from '@shared/types/task.js';

export class TaskRepository extends BaseRepository {
  public getAll(): Task[] {
    const stmt = this.db.prepare<[], Task>(`
      SELECT * FROM tasks
      WHERE is_trashed = 0
      ORDER BY sort_order ASC, created_at DESC
    `);
    return stmt.all();
  }

  public getById(id: string): Task | undefined {
    const stmt = this.db.prepare<[string], Task>(`
      SELECT * FROM tasks
      WHERE id = ?
    `);
    return stmt.get(id);
  }

  public create(task: Task): Task {
    const stmt = this.db.prepare(`
      INSERT INTO tasks (
        id, title, notes, list_id, project_id, section_id,
        parent_task_id, due_date, due_time, all_day,
        recurrence_rule, recurrence_basis, priority,
        is_starred, is_completed, completed_at, estimated_minutes,
        assignee_device_id, created_by_device, sort_order,
        my_day_date, pomodoro_count, is_trashed, trashed_at,
        created_at, updated_at
      ) VALUES (
        @id, @title, @notes, @list_id, @project_id, @section_id,
        @parent_task_id, @due_date, @due_time, @all_day,
        @recurrence_rule, @recurrence_basis, @priority,
        @is_starred, @is_completed, @completed_at, @estimated_minutes,
        @assignee_device_id, @created_by_device, @sort_order,
        @my_day_date, @pomodoro_count, @is_trashed, @trashed_at,
        @created_at, @updated_at
      )
    `);

    stmt.run({
      id: task.id,
      title: task.title,
      notes: task.notes ?? null,
      list_id: task.list_id,
      project_id: task.project_id ?? null,
      section_id: task.section_id ?? null,
      parent_task_id: task.parent_task_id ?? null,
      due_date: task.due_date ?? null,
      due_time: task.due_time ?? null,
      all_day: task.all_day ?? 1,
      recurrence_rule: task.recurrence_rule ?? null,
      recurrence_basis: task.recurrence_basis ?? null,
      priority: task.priority ?? 0,
      is_starred: task.is_starred ?? 0,
      is_completed: task.is_completed ?? 0,
      completed_at: task.completed_at ?? null,
      estimated_minutes: task.estimated_minutes ?? null,
      assignee_device_id: task.assignee_device_id ?? null,
      created_by_device: task.created_by_device ?? 'local',
      sort_order: task.sort_order ?? 0,
      my_day_date: task.my_day_date ?? null,
      pomodoro_count: task.pomodoro_count ?? 0,
      is_trashed: task.is_trashed ?? 0,
      trashed_at: task.trashed_at ?? null,
      created_at: task.created_at,
      updated_at: task.updated_at,
    });

    return task;
  }

  public update(task: Partial<Task> & { id: string; updated_at: string }): Task | undefined {
    const existing = this.getById(task.id);
    if (!existing) return undefined;

    const merged = { ...existing, ...task };

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
        is_trashed = @is_trashed,
        trashed_at = @trashed_at,
        updated_at = @updated_at
      WHERE id = @id
    `);

    stmt.run({
      id: merged.id,
      title: merged.title,
      notes: merged.notes ?? null,
      list_id: merged.list_id,
      project_id: merged.project_id ?? null,
      section_id: merged.section_id ?? null,
      parent_task_id: merged.parent_task_id ?? null,
      due_date: merged.due_date ?? null,
      due_time: merged.due_time ?? null,
      all_day: merged.all_day,
      recurrence_rule: merged.recurrence_rule ?? null,
      recurrence_basis: merged.recurrence_basis ?? null,
      priority: merged.priority,
      is_starred: merged.is_starred,
      is_completed: merged.is_completed,
      completed_at: merged.completed_at ?? null,
      estimated_minutes: merged.estimated_minutes ?? null,
      sort_order: merged.sort_order,
      my_day_date: merged.my_day_date ?? null,
      is_trashed: merged.is_trashed,
      trashed_at: merged.trashed_at ?? null,
      updated_at: merged.updated_at,
    });

    return merged;
  }

  public delete(id: string): boolean {
    const stmt = this.db.prepare('DELETE FROM tasks WHERE id = ?');
    const result = stmt.run(id);
    return result.changes > 0;
  }
}
