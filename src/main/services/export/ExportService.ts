import fs from 'node:fs';
import path from 'node:path';
import { app, dialog } from 'electron';
import type Database from 'better-sqlite3';

import { TaskRepository } from '../../repositories/TaskRepository.js';
import { ListRepository } from '../../repositories/ListRepository.js';
import { ProjectRepository } from '../../repositories/ProjectRepository.js';
import { TagRepository } from '../../repositories/TagRepository.js';
import { GoalRepository } from '../../repositories/GoalRepository.js';
import { PomodoroRepository } from '../../repositories/PomodoroRepository.js';
import { SettingsRepository } from '../../repositories/SettingsRepository.js';
import { createZipArchive, type ZipEntry } from '../../utils/zip-util.js';
import type {
  OS11ExportData,
  ExportFormat,
  ExportOptions,
  ExportResult,
  Task,
} from '../../../shared/types/index.js';

export class ExportService {
  private taskRepo: TaskRepository;
  private listRepo: ListRepository;
  private projectRepo: ProjectRepository;
  private tagRepo: TagRepository;
  private goalRepo: GoalRepository;
  private pomodoroRepo: PomodoroRepository;
  private settingsRepo: SettingsRepository;
  private attachmentsDir?: string;
  private db?: Database.Database;

  constructor(options?: {
    db?: Database.Database;
    taskRepo?: TaskRepository;
    listRepo?: ListRepository;
    projectRepo?: ProjectRepository;
    tagRepo?: TagRepository;
    goalRepo?: GoalRepository;
    pomodoroRepo?: PomodoroRepository;
    settingsRepo?: SettingsRepository;
    attachmentsDir?: string;
  }) {
    const db = options?.db;
    this.db = db;
    this.taskRepo = options?.taskRepo ?? new TaskRepository(db);
    this.listRepo = options?.listRepo ?? new ListRepository(db);
    this.projectRepo = options?.projectRepo ?? new ProjectRepository(db);
    this.tagRepo = options?.tagRepo ?? new TagRepository(db);
    this.goalRepo = options?.goalRepo ?? new GoalRepository(db);
    this.pomodoroRepo = options?.pomodoroRepo ?? new PomodoroRepository(db);
    this.settingsRepo = options?.settingsRepo ?? new SettingsRepository(db);
    this.attachmentsDir = options?.attachmentsDir;
  }

  public getAttachmentsDir(): string {
    if (this.attachmentsDir) {
      return this.attachmentsDir;
    }
    try {
      if (typeof app !== 'undefined' && app?.getPath) {
        return path.join(app.getPath('userData'), 'attachments');
      }
    } catch {
      // test fallback
    }
    return path.join(process.cwd(), '.os11-attachments');
  }

  /**
   * Full JSON export containing all entities
   */
  public exportJson(): OS11ExportData {
    const tasks = this.taskRepo.getAll();
    const lists = this.listRepo.getAll();
    const projects = this.projectRepo.getAll();
    const tags = this.tagRepo.getAll();
    const goals = this.goalRepo.getAll();
    const pomodoroSessions = this.pomodoroRepo.getAll();
    const settings = this.settingsRepo.getAll();

    let taskTags: Array<{ task_id: string; tag_id: string }> = [];
    if (this.db) {
      try {
        taskTags = this.db.prepare('SELECT task_id, tag_id FROM task_tags').all() as Array<{
          task_id: string;
          tag_id: string;
        }>;
      } catch {
        // ignore
      }
    }

    return {
      version: 1,
      exportedAt: new Date().toISOString(),
      tasks,
      lists,
      projects,
      tags,
      goals,
      pomodoroSessions,
      settings,
      taskTags,
    };
  }

  /**
   * CSV export: tasks as a flat RFC 4180 table
   */
  public exportCsv(options?: { listId?: string; projectId?: string; includeCompleted?: boolean }): string {
    let tasks = this.taskRepo.getAll();

    if (options?.listId) {
      tasks = tasks.filter((t) => t.list_id === options.listId);
    }
    if (options?.projectId) {
      tasks = tasks.filter((t) => t.project_id === options.projectId);
    }
    if (options?.includeCompleted === false) {
      tasks = tasks.filter((t) => t.is_completed === 0);
    }

    const lists = this.listRepo.getAll();
    const listMap = new Map<string, string>(lists.map((l) => [l.id, l.name]));

    const projects = this.projectRepo.getAll();
    const projectMap = new Map<string, string>(projects.map((p) => [p.id, p.name]));

    const headers = [
      'id',
      'title',
      'notes',
      'list',
      'project',
      'tags',
      'due_date',
      'due_time',
      'priority',
      'is_starred',
      'is_completed',
      'completed_at',
      'created_at',
    ];

    const escapeCsv = (val: unknown): string => {
      if (val === null || val === undefined) return '""';
      const str = String(val).replace(/"/g, '""');
      return `"${str}"`;
    };

    const rows: string[] = [headers.map((h) => `"${h}"`).join(',')];

    for (const t of tasks) {
      let taskTagsStr = '';
      try {
        const taskTags = this.tagRepo.getForTask(t.id);
        taskTagsStr = taskTags.map((tg) => tg.name).join('; ');
      } catch {
        taskTagsStr = '';
      }

      const listName = t.list_id ? (listMap.get(t.list_id) ?? t.list_id) : '';
      const projectName = t.project_id ? (projectMap.get(t.project_id) ?? t.project_id) : '';

      const line = [
        escapeCsv(t.id),
        escapeCsv(t.title),
        escapeCsv(t.notes ?? ''),
        escapeCsv(listName),
        escapeCsv(projectName),
        escapeCsv(taskTagsStr),
        escapeCsv(t.due_date ?? ''),
        escapeCsv(t.due_time ?? ''),
        escapeCsv(t.priority),
        escapeCsv(t.is_starred === 1 ? 'true' : 'false'),
        escapeCsv(t.is_completed === 1 ? 'true' : 'false'),
        escapeCsv(t.completed_at ?? ''),
        escapeCsv(t.created_at),
      ].join(',');

      rows.push(line);
    }

    return rows.join('\r\n');
  }

  /**
   * Markdown export: grouped by list with checkbox syntax
   */
  public exportMarkdown(options?: { listId?: string; projectId?: string; includeCompleted?: boolean }): string {
    let tasks = this.taskRepo.getAll();

    if (options?.listId) {
      tasks = tasks.filter((t) => t.list_id === options.listId);
    }
    if (options?.projectId) {
      tasks = tasks.filter((t) => t.project_id === options.projectId);
    }
    if (options?.includeCompleted === false) {
      tasks = tasks.filter((t) => t.is_completed === 0);
    }

    const lists = this.listRepo.getAll();
    const listMap = new Map<string, string>(lists.map((l) => [l.id, l.name]));

    // Group tasks by list_id
    const grouped = new Map<string, Task[]>();
    for (const t of tasks) {
      const lid = t.list_id || 'unassigned';
      if (!grouped.has(lid)) {
        grouped.set(lid, []);
      }
      grouped.get(lid)!.push(t);
    }

    const lines: string[] = [];
    lines.push(`# OS11 Task Export`);
    lines.push(`Exported on ${new Date().toLocaleDateString()}`);
    lines.push('');

    for (const [listId, listTasks] of grouped.entries()) {
      const listTitle = listId === 'unassigned' ? 'No List' : (listMap.get(listId) ?? 'List');
      lines.push(`## ${listTitle}`);
      lines.push('');

      // Top level tasks
      const topLevel = listTasks.filter((t) => !t.parent_task_id);
      const subtaskMap = new Map<string, Task[]>();
      for (const t of listTasks) {
        if (t.parent_task_id) {
          if (!subtaskMap.has(t.parent_task_id)) {
            subtaskMap.set(t.parent_task_id, []);
          }
          subtaskMap.get(t.parent_task_id)!.push(t);
        }
      }

      for (const t of topLevel) {
        const checkbox = t.is_completed === 1 ? '[x]' : '[ ]';
        const due = t.due_date ? ` (due: ${t.due_date})` : '';
        const priority = t.priority > 0 ? ` [P${t.priority}]` : '';
        lines.push(`- ${checkbox} ${t.title}${priority}${due}`);

        const subs = subtaskMap.get(t.id) ?? [];
        for (const sub of subs) {
          const subCheck = sub.is_completed === 1 ? '[x]' : '[ ]';
          const subDue = sub.due_date ? ` (due: ${sub.due_date})` : '';
          lines.push(`  - ${subCheck} ${sub.title}${subDue}`);
        }
      }

      lines.push('');
    }

    return lines.join('\n');
  }

  /**
   * HTML representation formatted for printing or PDF rendering
   */
  public generatePrintHtml(options?: { listId?: string; projectId?: string; title?: string }): string {
    let tasks = this.taskRepo.getAll();
    let title = options?.title ?? 'OS11 Task List';

    if (options?.listId) {
      tasks = tasks.filter((t) => t.list_id === options.listId);
      const list = this.listRepo.getById(options.listId);
      if (list) title = `${list.name} - OS11`;
    } else if (options?.projectId) {
      tasks = tasks.filter((t) => t.project_id === options.projectId);
      const proj = this.projectRepo.getById(options.projectId);
      if (proj) title = `${proj.name} - OS11`;
    }

    const activeTasks = tasks.filter((t) => t.is_completed === 0);
    const completedTasks = tasks.filter((t) => t.is_completed === 1);

    const renderTaskItem = (t: Task) => `
      <div class="task-row">
        <div class="checkbox ${t.is_completed === 1 ? 'checked' : ''}"></div>
        <div class="task-content">
          <div class="task-title ${t.is_completed === 1 ? 'completed-text' : ''}">${escapeHtml(t.title)}</div>
          ${t.due_date ? `<div class="task-due">Due: ${t.due_date}</div>` : ''}
          ${t.notes ? `<div class="task-notes">${escapeHtml(t.notes)}</div>` : ''}
        </div>
      </div>
    `;

    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${escapeHtml(title)}</title>
  <style>
    @media print {
      body { margin: 0; padding: 20px; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; color: #111; }
      .no-print { display: none; }
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      margin: 40px auto;
      max-width: 800px;
      color: #1a1a1a;
      line-height: 1.4;
    }
    h1 { font-size: 24px; margin-bottom: 4px; }
    .meta { font-size: 12px; color: #666; margin-bottom: 24px; }
    .section-title { font-size: 14px; text-transform: uppercase; letter-spacing: 0.5px; font-weight: bold; border-bottom: 1px solid #ccc; padding-bottom: 4px; margin-top: 24px; margin-bottom: 12px; color: #444; }
    .task-row { display: flex; align-items: flex-start; gap: 10px; margin-bottom: 10px; padding: 4px 0; }
    .checkbox { width: 14px; height: 14px; border: 1.5px solid #444; border-radius: 3px; margin-top: 2px; flex-shrink: 0; }
    .checkbox.checked { background-color: #444; position: relative; }
    .checkbox.checked::after { content: "✓"; color: #fff; font-size: 10px; position: absolute; top: -1px; left: 2px; }
    .task-title { font-size: 14px; font-weight: 500; }
    .completed-text { text-decoration: line-through; color: #777; }
    .task-due { font-size: 12px; color: #e67e22; margin-top: 2px; }
    .task-notes { font-size: 12px; color: #555; margin-top: 2px; white-space: pre-wrap; }
  </style>
</head>
<body>
  <h1>${escapeHtml(title)}</h1>
  <div class="meta">Printed on ${new Date().toLocaleString()} &bull; Total tasks: ${tasks.length}</div>

  <div class="section-title">Pending Tasks (${activeTasks.length})</div>
  ${activeTasks.length === 0 ? '<div style="color: #888; font-size: 13px;">No pending tasks</div>' : activeTasks.map(renderTaskItem).join('')}

  ${completedTasks.length > 0 ? `
    <div class="section-title" style="margin-top: 32px;">Completed Tasks (${completedTasks.length})</div>
    ${completedTasks.map(renderTaskItem).join('')}
  ` : ''}
</body>
</html>`;
  }

  /**
   * Attachment export: ZIP archive containing os11-export.json + all attachment files
   */
  public exportAttachmentsZip(outputFilePath?: string): Buffer {
    const jsonExport = this.exportJson();
    const jsonBuffer = Buffer.from(JSON.stringify(jsonExport, null, 2), 'utf-8');

    const entries: ZipEntry[] = [
      {
        name: 'os11-export.json',
        data: jsonBuffer,
      },
    ];

    const attachDir = this.getAttachmentsDir();
    if (fs.existsSync(attachDir)) {
      const walk = (dir: string, base: string) => {
        const items = fs.readdirSync(dir);
        for (const item of items) {
          const full = path.join(dir, item);
          const rel = path.join(base, item).replace(/\\/g, '/');
          const stat = fs.statSync(full);
          if (stat.isDirectory()) {
            walk(full, rel);
          } else if (stat.isFile()) {
            entries.push({
              name: path.join('attachments', rel).replace(/\\/g, '/'),
              data: fs.readFileSync(full),
            });
          }
        }
      };
      walk(attachDir, '');
    }

    const archive = createZipArchive(entries);

    if (outputFilePath) {
      const dir = path.dirname(outputFilePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(outputFilePath, archive);
    }

    return archive;
  }

  /**
   * Handles export to a specific file destination based on format
   */
  public async exportToFile(options: ExportOptions): Promise<ExportResult> {
    const { format, destinationPath } = options;

    if (!destinationPath) {
      return { success: false, error: 'Destination file path is required.' };
    }

    try {
      const outDir = path.dirname(destinationPath);
      if (!fs.existsSync(outDir)) {
        fs.mkdirSync(outDir, { recursive: true });
      }

      let count = 0;
      switch (format) {
        case 'json': {
          const data = this.exportJson();
          fs.writeFileSync(destinationPath, JSON.stringify(data, null, 2), 'utf-8');
          count = data.tasks.length;
          break;
        }
        case 'csv': {
          const csv = this.exportCsv(options);
          fs.writeFileSync(destinationPath, csv, 'utf-8');
          break;
        }
        case 'markdown': {
          const md = this.exportMarkdown(options);
          fs.writeFileSync(destinationPath, md, 'utf-8');
          break;
        }
        case 'attachments_zip': {
          this.exportAttachmentsZip(destinationPath);
          break;
        }
        case 'print_pdf': {
          const html = this.generatePrintHtml(options);
          fs.writeFileSync(destinationPath, html, 'utf-8');
          break;
        }
        default:
          return { success: false, error: `Unsupported export format: ${format}` };
      }

      return {
        success: true,
        filePath: destinationPath,
        count,
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return { success: false, error: msg };
    }
  }

  /**
   * Prompts user with native Save File Dialog
   */
  public async promptSaveDialog(format: ExportFormat, defaultName?: string): Promise<string | null> {
    if (typeof dialog === 'undefined' || !dialog.showSaveDialog) {
      return null;
    }

    const dateStr = new Date().toISOString().split('T')[0];
    let ext = 'json';
    let filterName = 'JSON Document';

    switch (format) {
      case 'json':
        ext = 'json';
        filterName = 'JSON Files';
        break;
      case 'csv':
        ext = 'csv';
        filterName = 'CSV Spreadsheets';
        break;
      case 'markdown':
        ext = 'md';
        filterName = 'Markdown Files';
        break;
      case 'attachments_zip':
        ext = 'zip';
        filterName = 'ZIP Archives';
        break;
      case 'print_pdf':
        ext = 'html';
        filterName = 'HTML Print Files';
        break;
    }

    const filename = defaultName ?? `os11-export-${dateStr}.${ext}`;

    const res = await dialog.showSaveDialog({
      title: 'Export OS11 Data',
      defaultPath: filename,
      filters: [{ name: filterName, extensions: [ext] }],
    });

    return res.canceled ? null : res.filePath;
  }
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export default ExportService;
