import type Database from 'better-sqlite3';
import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../../repositories/db.js';
import type {
  ImportOptions,
  ImportProgress,
  ImportResult,
  OS11ExportData,
} from '../../../shared/types/index.js';

export class ImportService {
  private db: Database.Database;

  constructor(customDb?: Database.Database) {
    this.db = customDb ?? getDb();
  }

  /**
   * Main import dispatcher running within an atomic SQLite transaction
   */
  public async importData(
    options: ImportOptions,
    onProgress?: (progress: ImportProgress) => void
  ): Promise<ImportResult> {
    const { format, content } = options;

    if (!content || !content.trim()) {
      return {
        success: false,
        importedTasks: 0,
        importedLists: 0,
        importedProjects: 0,
        importedTags: 0,
        error: 'Import content is empty.',
      };
    }

    try {
      // Wrap entire ingestion in a single SQLite transaction
      const runTransaction = this.db.transaction(() => {
        switch (format) {
          case 'os11_json':
            return this.importOs11Json(content, onProgress);
          case 'todoist_json':
            return this.importTodoistJson(content, options.targetListId, onProgress);
          case 'ms_todo_csv':
            return this.importMsTodoCsv(content, options.targetListId, onProgress);
          case 'notion_csv':
            return this.importNotionCsv(content, options.targetListId, onProgress);
          default:
            throw new Error(`Unsupported import format: ${format}`);
        }
      });

      const result = runTransaction();
      return result;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return {
        success: false,
        importedTasks: 0,
        importedLists: 0,
        importedProjects: 0,
        importedTags: 0,
        error: msg,
      };
    }
  }

  private hasTable(name: string): boolean {
    try {
      const row = this.db.prepare(
        "SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?"
      ).get(name);
      return !!row;
    } catch {
      return false;
    }
  }

  private hasColumn(table: string, column: string): boolean {
    try {
      const cols = this.db.pragma(`table_info(${table})`) as Array<{ name: string }>;
      return cols.some((c) => c.name === column);
    } catch {
      return false;
    }
  }

  /**
   * Full round-trip OS11 JSON importer (idempotent: skips existing IDs)
   */
  private importOs11Json(
    content: string,
    onProgress?: (progress: ImportProgress) => void
  ): ImportResult {
    const data = JSON.parse(content) as OS11ExportData;

    let importedTasks = 0;
    let importedLists = 0;
    let importedProjects = 0;
    let importedTags = 0;
    let skippedCount = 0;

    const totalItems =
      (data.lists?.length ?? 0) +
      (data.objectives?.length ?? 0) +
      (data.keyResults?.length ?? 0) +
      (data.projects?.length ?? 0) +
      (data.tags?.length ?? 0) +
      (data.tasks?.length ?? 0);

    let processed = 0;

    // 1. Lists
    if (Array.isArray(data.lists)) {
      const listStmt = this.db.prepare(`
        INSERT OR IGNORE INTO lists (id, name, icon, color, background_type, background_value, sort_order, is_smart, smart_type, group_id, notification_enabled, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      for (const l of data.lists) {
        const info = listStmt.run(
          l.id,
          l.name,
          l.icon ?? '📋',
          l.color ?? null,
          l.background_type ?? 'none',
          l.background_value ?? null,
          l.sort_order ?? 0,
          l.is_smart ?? 0,
          l.smart_type ?? null,
          l.group_id ?? null,
          l.notification_enabled ?? 1,
          l.created_at ?? new Date().toISOString(),
          l.updated_at ?? new Date().toISOString()
        );
        if (info.changes > 0) importedLists++;
        else skippedCount++;
        processed++;
        onProgress?.({ current: processed, total: totalItems, message: `Importing lists: ${l.name}` });
      }
    }

    // 2. Objectives (if present and table exists)
    if (Array.isArray(data.objectives) && this.hasTable('objectives')) {
      const objStmt = this.db.prepare(`
        INSERT OR IGNORE INTO objectives (id, title, notes, area_id, period_kind, period_start, period_end, cadence, status, completed_at, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      for (const obj of data.objectives) {
        objStmt.run(
          obj.id,
          obj.title,
          obj.notes ?? null,
          obj.area_id ?? null,
          obj.period_kind ?? 'quarter',
          obj.period_start,
          obj.period_end,
          obj.cadence ?? 'weekly',
          obj.status ?? 'active',
          obj.completed_at ?? null,
          obj.created_at ?? new Date().toISOString(),
          obj.updated_at ?? new Date().toISOString()
        );
        processed++;
        onProgress?.({ current: processed, total: totalItems, message: `Importing goals: ${obj.title}` });
      }
    }

    // 3. Key Results (if present and table exists)
    if (Array.isArray(data.keyResults) && this.hasTable('key_results')) {
      const krStmt = this.db.prepare(`
        INSERT OR IGNORE INTO key_results (id, objective_id, title, kind, unit, start_value, target_value, sort_order, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      for (const kr of data.keyResults) {
        krStmt.run(
          kr.id,
          kr.objective_id,
          kr.title,
          kr.kind,
          kr.unit ?? null,
          kr.start_value ?? 0,
          kr.target_value ?? 100,
          kr.sort_order ?? 0,
          kr.created_at ?? new Date().toISOString(),
          kr.updated_at ?? new Date().toISOString()
        );
        processed++;
        onProgress?.({ current: processed, total: totalItems, message: `Importing key results: ${kr.title}` });
      }
    }

    // 4. KR Check-ins (if present and table exists)
    if (Array.isArray(data.krCheckIns) && this.hasTable('kr_check_ins')) {
      const checkInStmt = this.db.prepare(`
        INSERT OR IGNORE INTO kr_check_ins (id, key_result_id, value, status, note, checked_in_on, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);
      for (const ci of data.krCheckIns) {
        checkInStmt.run(
          ci.id,
          ci.key_result_id,
          ci.value,
          ci.status,
          ci.note ?? null,
          ci.checked_in_on,
          ci.created_at ?? new Date().toISOString()
        );
      }
    }

    // 5. KR Habit Logs (if present and table exists)
    if (Array.isArray(data.krHabitLogs) && this.hasTable('kr_habit_logs')) {
      const habitStmt = this.db.prepare(`
        INSERT OR IGNORE INTO kr_habit_logs (key_result_id, log_date, created_at)
        VALUES (?, ?, ?)
      `);
      for (const hl of data.krHabitLogs) {
        habitStmt.run(
          hl.key_result_id,
          hl.log_date,
          hl.created_at ?? new Date().toISOString()
        );
      }
    }

    // Gather existing key_result IDs to ensure FK validity
    const validKrIds = this.hasTable('key_results')
      ? new Set(
          (this.db.prepare('SELECT id FROM key_results').all() as Array<{ id: string }>).map((r) => r.id)
        )
      : new Set<string>();

    const hasProjectKrId = this.hasColumn('projects', 'key_result_id');
    const hasTaskKrId = this.hasColumn('tasks', 'key_result_id');

    // 6. Projects
    if (Array.isArray(data.projects)) {
      const projStmt = hasProjectKrId
        ? this.db.prepare(`
            INSERT OR IGNORE INTO projects (id, name, description, color, icon, status, due_date, default_view, sort_order, key_result_id, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `)
        : this.db.prepare(`
            INSERT OR IGNORE INTO projects (id, name, description, color, icon, status, due_date, default_view, sort_order, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `);

      for (const p of data.projects) {
        const krId = p.key_result_id && validKrIds.has(p.key_result_id) ? p.key_result_id : null;
        const params = [
          p.id,
          p.name,
          p.description ?? null,
          p.color ?? '#8B5CF6',
          p.icon ?? '📁',
          p.status ?? 'active',
          p.due_date ?? null,
          p.default_view ?? 'list',
          p.sort_order ?? 0,
        ];
        if (hasProjectKrId) {
          params.push(krId);
        }
        params.push(
          p.created_at ?? new Date().toISOString(),
          p.updated_at ?? new Date().toISOString()
        );
        const info = projStmt.run(...params);
        if (info.changes > 0) importedProjects++;
        else skippedCount++;
        processed++;
        onProgress?.({ current: processed, total: totalItems, message: `Importing projects: ${p.name}` });
      }
    }

    // 7. Tags
    if (Array.isArray(data.tags)) {
      const tagStmt = this.db.prepare(`
        INSERT OR IGNORE INTO tags (id, name, color, created_at)
        VALUES (?, ?, ?, ?)
      `);
      for (const tg of data.tags) {
        const info = tagStmt.run(
          tg.id,
          tg.name,
          tg.color ?? '#3B82F6',
          tg.created_at ?? new Date().toISOString()
        );
        if (info.changes > 0) importedTags++;
        else skippedCount++;
        processed++;
        onProgress?.({ current: processed, total: totalItems, message: `Importing tags: ${tg.name}` });
      }
    }

    // 8. Tasks
    if (Array.isArray(data.tasks)) {
      const taskStmt = hasTaskKrId
        ? this.db.prepare(`
            INSERT OR IGNORE INTO tasks (
              id, title, notes, list_id, project_id, section_id, parent_task_id,
              due_date, due_time, all_day, recurrence_rule, recurrence_basis,
              priority, is_starred, is_completed, completed_at, estimated_minutes,
              assignee_device_id, created_by_device, sort_order, my_day_date,
              pomodoro_count, is_habit, is_trashed, trashed_at, key_result_id, created_at, updated_at
            ) VALUES (
              ?, ?, ?, ?, ?, ?, ?,
              ?, ?, ?, ?, ?,
              ?, ?, ?, ?, ?,
              ?, ?, ?, ?,
              ?, ?, ?, ?, ?, ?, ?
            )
          `)
        : this.db.prepare(`
            INSERT OR IGNORE INTO tasks (
              id, title, notes, list_id, project_id, section_id, parent_task_id,
              due_date, due_time, all_day, recurrence_rule, recurrence_basis,
              priority, is_starred, is_completed, completed_at, estimated_minutes,
              assignee_device_id, created_by_device, sort_order, my_day_date,
              pomodoro_count, is_habit, is_trashed, trashed_at, created_at, updated_at
            ) VALUES (
              ?, ?, ?, ?, ?, ?, ?,
              ?, ?, ?, ?, ?,
              ?, ?, ?, ?, ?,
              ?, ?, ?, ?,
              ?, ?, ?, ?, ?, ?
            )
          `);

      for (const t of data.tasks) {
        const krId = !t.parent_task_id && t.key_result_id && validKrIds.has(t.key_result_id)
          ? t.key_result_id
          : null;
        const params = [
          t.id,
          t.title,
          t.notes ?? null,
          t.list_id ?? 'list_inbox',
          t.project_id ?? null,
          t.section_id ?? null,
          t.parent_task_id ?? null,
          t.due_date ?? null,
          t.due_time ?? null,
          t.all_day ?? 1,
          t.recurrence_rule ?? null,
          t.recurrence_basis ?? null,
          t.priority ?? 0,
          t.is_starred ?? 0,
          t.is_completed ?? 0,
          t.completed_at ?? null,
          t.estimated_minutes ?? null,
          t.assignee_device_id ?? null,
          t.created_by_device ?? 'device_local',
          t.sort_order ?? 0,
          t.my_day_date ?? null,
          t.pomodoro_count ?? 0,
          t.is_habit ?? 0,
          t.is_trashed ?? 0,
          t.trashed_at ?? null,
        ];
        if (hasTaskKrId) {
          params.push(krId);
        }
        params.push(
          t.created_at ?? new Date().toISOString(),
          t.updated_at ?? new Date().toISOString()
        );
        const info = taskStmt.run(...params);

        if (info.changes > 0) importedTasks++;
        else skippedCount++;
        processed++;
        onProgress?.({ current: processed, total: totalItems, message: `Importing tasks: ${t.title}` });
      }
    }

    // 9. Legacy Goals: skip and record
    if (Array.isArray(data.goals) && data.goals.length > 0) {
      skippedCount += data.goals.length;
    }

    // 6. Settings (if present)
    if (data.settings && typeof data.settings === 'object') {
      const setStmt = this.db.prepare(`
        INSERT INTO settings (key, value)
        VALUES (?, ?)
        ON CONFLICT(key) DO UPDATE SET value = excluded.value
      `);
      for (const [k, v] of Object.entries(data.settings)) {
        setStmt.run(k, JSON.stringify(v));
      }
    }

    // 7. Task Tags (if present)
    if (Array.isArray(data.taskTags)) {
      const taskTagStmt = this.db.prepare(`
        INSERT OR IGNORE INTO task_tags (task_id, tag_id) VALUES (?, ?)
      `);
      for (const tt of data.taskTags) {
        taskTagStmt.run(tt.task_id, tt.tag_id);
      }
    }

    return {
      success: true,
      importedTasks,
      importedLists,
      importedProjects,
      importedTags,
      skippedCount,
    };
  }

  /**
   * Importer for Todoist JSON export
   */
  private importTodoistJson(
    content: string,
    targetListId?: string,
    onProgress?: (progress: ImportProgress) => void
  ): ImportResult {
    const raw = JSON.parse(content);
    const items = (raw.items ?? raw.tasks ?? (Array.isArray(raw) ? raw : [])) as Array<Record<string, unknown>>;
    const projects = (raw.projects ?? []) as Array<Record<string, unknown>>;
    const labels = (raw.labels ?? []) as Array<Record<string, unknown>>;

    let importedTasks = 0;
    let importedProjects = 0;
    let importedTags = 0;

    const total = items.length + projects.length + labels.length;
    let processed = 0;

    // Map projects
    const projMap = new Map<string, string>();
    const projStmt = this.db.prepare(`
      INSERT OR IGNORE INTO projects (id, name, color, icon, created_at, updated_at)
      VALUES (?, ?, ?, '📁', datetime('now'), datetime('now'))
    `);
    for (const p of projects) {
      const name = String(p.name ?? 'Project');
      const pid = uuidv4();
      projMap.set(String(p.id), pid);
      projStmt.run(pid, name, String(p.color ?? '#1B88FF'));
      importedProjects++;
      processed++;
      onProgress?.({ current: processed, total, message: `Importing project: ${name}` });
    }

    // Map labels to tags
    const tagMap = new Map<string, string>();
    const tagStmt = this.db.prepare(`
      INSERT OR IGNORE INTO tags (id, name, color, created_at)
      VALUES (?, ?, ?, datetime('now'))
    `);
    for (const lb of labels) {
      const name = String(lb.name ?? 'label');
      const tid = uuidv4();
      tagMap.set(name, tid);
      tagMap.set(String(lb.id), tid);
      tagStmt.run(tid, name, String(lb.color ?? '#3B82F6'));
      importedTags++;
      processed++;
      onProgress?.({ current: processed, total, message: `Importing tag: ${name}` });
    }

    // Map items
    const taskStmt = this.db.prepare(`
      INSERT INTO tasks (
        id, title, notes, list_id, project_id, parent_task_id, due_date, due_time,
        priority, is_completed, completed_at, created_by_device, sort_order, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'device_local', ?, datetime('now'), datetime('now'))
    `);

    const defaultList = targetListId ?? 'list_inbox';

    for (const itm of items) {
      const title = String(itm.content ?? itm.title ?? 'Untitled Task');
      const notes = itm.description ? String(itm.description) : null;
      const tid = uuidv4();

      let dueDate: string | null = null;
      let dueTime: string | null = null;
      if (itm.due && typeof itm.due === 'object') {
        const dObj = itm.due as { date?: string };
        if (dObj.date) {
          if (dObj.date.includes('T')) {
            const parts = dObj.date.split('T');
            dueDate = parts[0];
            dueTime = parts[1].substring(0, 5);
          } else {
            dueDate = dObj.date;
          }
        }
      }

      // Todoist priorities: 4 = P1 (Urgent), 1 = Normal (P4)
      let priority = 0;
      if (typeof itm.priority === 'number') {
        if (itm.priority === 4) priority = 1;
        else if (itm.priority === 3) priority = 2;
        else if (itm.priority === 2) priority = 3;
        else priority = 0;
      }

      const isCompleted = itm.checked ? 1 : 0;
      const completedAt = isCompleted ? (itm.completed_at ? String(itm.completed_at) : new Date().toISOString()) : null;
      const projId = itm.project_id ? projMap.get(String(itm.project_id)) ?? null : null;

      taskStmt.run(
        tid,
        title,
        notes,
        defaultList,
        projId,
        null,
        dueDate,
        dueTime,
        priority,
        isCompleted,
        completedAt,
        importedTasks
      );

      importedTasks++;
      processed++;
      onProgress?.({ current: processed, total, message: `Importing task: ${title}` });
    }

    return {
      success: true,
      importedTasks,
      importedLists: 0,
      importedProjects,
      importedTags,
      skippedCount: 0,
    };
  }

  /**
   * Importer for Microsoft To Do CSV export
   */
  private importMsTodoCsv(
    csvContent: string,
    targetListId?: string,
    onProgress?: (progress: ImportProgress) => void
  ): ImportResult {
    const rows = parseCsvToObjects(csvContent);
    let importedTasks = 0;
    const total = rows.length;

    const taskStmt = this.db.prepare(`
      INSERT INTO tasks (
        id, title, notes, list_id, due_date, due_time, priority,
        is_completed, completed_at, created_by_device, sort_order, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'device_local', ?, datetime('now'), datetime('now'))
    `);

    const defaultList = targetListId ?? 'list_inbox';

    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      // Headers in MS To Do CSV: "Task Name", "Notes", "Due Date", "Importance", "Completed", etc.
      const title = r['task name'] || r['task'] || r['title'] || r['subject'] || 'Untitled Task';
      const notes = r['notes'] || r['note'] || null;
      const dueRaw = r['due date'] || r['due'] || null;
      const importance = (r['importance'] || r['priority'] || '').toLowerCase();
      const completedRaw = (r['completed'] || r['status'] || '').toLowerCase();

      let dueDate: string | null = null;
      if (dueRaw) {
        dueDate = normalizeDateString(dueRaw);
      }

      let priority = 0;
      if (importance === 'high' || importance === '1') priority = 1;
      else if (importance === 'medium' || importance === '2') priority = 2;
      else if (importance === 'low' || importance === '3') priority = 3;

      const isCompleted = completedRaw === 'completed' || completedRaw === 'true' || completedRaw === '1' ? 1 : 0;
      const completedAt = isCompleted ? new Date().toISOString() : null;

      const id = uuidv4();
      taskStmt.run(id, title, notes, defaultList, dueDate, null, priority, isCompleted, completedAt, i);
      importedTasks++;

      onProgress?.({ current: i + 1, total, message: `Importing MS To Do: ${title}` });
    }

    return {
      success: true,
      importedTasks,
      importedLists: 0,
      importedProjects: 0,
      importedTags: 0,
      skippedCount: 0,
    };
  }

  /**
   * Importer for Notion database CSV export
   */
  private importNotionCsv(
    csvContent: string,
    targetListId?: string,
    onProgress?: (progress: ImportProgress) => void
  ): ImportResult {
    const rows = parseCsvToObjects(csvContent);
    let importedTasks = 0;
    let importedTags = 0;
    const total = rows.length;

    const taskStmt = this.db.prepare(`
      INSERT INTO tasks (
        id, title, notes, list_id, due_date, due_time, priority,
        is_completed, completed_at, created_by_device, sort_order, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'device_local', ?, datetime('now'), datetime('now'))
    `);

    const tagStmt = this.db.prepare(`
      INSERT OR IGNORE INTO tags (id, name, color, created_at)
      VALUES (?, ?, '#3B82F6', datetime('now'))
    `);

    const taskTagStmt = this.db.prepare(`
      INSERT OR IGNORE INTO task_tags (task_id, tag_id) VALUES (?, ?)
    `);

    const defaultList = targetListId ?? 'list_inbox';
    const tagCache = new Map<string, string>();

    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      // Headers in Notion: "Name", "Due Date" or "Date", "Priority", "Status", "Tags", "Notes"
      const title = r['name'] || r['task name'] || r['task'] || r['title'] || 'Untitled Task';
      const notes = r['notes'] || r['description'] || null;
      const dueRaw = r['due date'] || r['date'] || r['due'] || null;
      const priorityRaw = (r['priority'] || '').toLowerCase();
      const statusRaw = (r['status'] || '').toLowerCase();
      const tagsRaw = r['tags'] || r['tag'] || '';

      let dueDate: string | null = null;
      if (dueRaw) {
        dueDate = normalizeDateString(dueRaw);
      }

      let priority = 0;
      if (priorityRaw.includes('high') || priorityRaw.includes('urgent') || priorityRaw === 'p1') priority = 1;
      else if (priorityRaw.includes('med') || priorityRaw === 'p2') priority = 2;
      else if (priorityRaw.includes('low') || priorityRaw === 'p3') priority = 3;

      const isCompleted =
        statusRaw === 'done' || statusRaw === 'completed' || statusRaw === 'closed' || statusRaw === 'true'
          ? 1
          : 0;
      const completedAt = isCompleted ? new Date().toISOString() : null;

      const id = uuidv4();
      taskStmt.run(id, title, notes, defaultList, dueDate, null, priority, isCompleted, completedAt, i);
      importedTasks++;

      // Process tags
      if (tagsRaw) {
        const tagNames = tagsRaw.split(',').map((s) => s.trim()).filter(Boolean);
        for (const tName of tagNames) {
          let tagId = tagCache.get(tName.toLowerCase());
          if (!tagId) {
            tagId = uuidv4();
            tagStmt.run(tagId, tName);
            tagCache.set(tName.toLowerCase(), tagId);
            importedTags++;
          }
          taskTagStmt.run(id, tagId);
        }
      }

      onProgress?.({ current: i + 1, total, message: `Importing Notion: ${title}` });
    }

    return {
      success: true,
      importedTasks,
      importedLists: 0,
      importedProjects: 0,
      importedTags,
      skippedCount: 0,
    };
  }
}

/**
 * Parses CSV text into array of object maps with lowercase header keys
 */
export function parseCsvToObjects(csvText: string): Array<Record<string, string>> {
  const clean = csvText.replace(/^\uFEFF/, '').trim(); // Remove BOM
  if (!clean) return [];

  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentField = '';
  let inQuotes = false;

  for (let i = 0; i < clean.length; i++) {
    const ch = clean[i];
    const next = clean[i + 1];

    if (inQuotes) {
      if (ch === '"') {
        if (next === '"') {
          currentField += '"';
          i++; // skip escaped quote
        } else {
          inQuotes = false;
        }
      } else {
        currentField += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ',') {
        currentRow.push(currentField.trim());
        currentField = '';
      } else if (ch === '\r') {
        if (next === '\n') i++;
        currentRow.push(currentField.trim());
        rows.push(currentRow);
        currentRow = [];
        currentField = '';
      } else if (ch === '\n') {
        currentRow.push(currentField.trim());
        rows.push(currentRow);
        currentRow = [];
        currentField = '';
      } else {
        currentField += ch;
      }
    }
  }

  if (currentField || currentRow.length > 0) {
    currentRow.push(currentField.trim());
    rows.push(currentRow);
  }

  if (rows.length === 0) return [];

  const headers = rows[0].map((h) => h.toLowerCase().trim());
  const results: Array<Record<string, string>> = [];

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (row.length === 1 && !row[0]) continue; // skip empty line
    const obj: Record<string, string> = {};
    for (let j = 0; j < headers.length; j++) {
      obj[headers[j]] = row[j] ?? '';
    }
    results.push(obj);
  }

  return results;
}

/**
 * Normalizes date string to YYYY-MM-DD format
 */
function normalizeDateString(dateStr: string): string | null {
  const trimmed = dateStr.trim();
  if (!trimmed) return null;

  // Check if already YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
    return trimmed.substring(0, 10);
  }

  const parsed = new Date(trimmed);
  if (!isNaN(parsed.getTime())) {
    return parsed.toISOString().split('T')[0];
  }

  return null;
}

export default ImportService;
