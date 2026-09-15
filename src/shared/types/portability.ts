import type { Task } from './task.js';
import type { List } from './List.js';
import type { Project } from './Project.js';
import type { Tag } from './Tag.js';
import type { Goal } from './Goal.js';
import type { PomodoroSession } from './PomodoroSession.js';

export interface OS11ExportData {
  version: number;
  exportedAt: string;
  tasks: Task[];
  lists: List[];
  projects: Project[];
  tags: Tag[];
  goals: Goal[];
  pomodoroSessions: PomodoroSession[];
  settings: Record<string, unknown>;
  taskTags?: Array<{ task_id: string; tag_id: string }>;
}

export type ExportFormat = 'json' | 'csv' | 'markdown' | 'attachments_zip' | 'print_pdf';

export interface ExportOptions {
  format: ExportFormat;
  listId?: string;
  projectId?: string;
  includeCompleted?: boolean;
  destinationPath?: string;
}

export interface ExportResult {
  success: boolean;
  filePath?: string;
  data?: string;
  count?: number;
  error?: string;
}

export type ImportFormat = 'os11_json' | 'todoist_json' | 'ms_todo_csv' | 'notion_csv';

export interface ImportOptions {
  format: ImportFormat;
  filePath?: string;
  content?: string;
  targetListId?: string;
}

export interface ImportProgress {
  current: number;
  total: number;
  message: string;
}

export interface ImportResult {
  success: boolean;
  importedTasks: number;
  importedLists: number;
  importedProjects: number;
  importedTags: number;
  skippedCount?: number;
  error?: string;
}

export interface BackupInfo {
  fileName: string;
  filePath: string;
  sizeBytes: number;
  createdAt: string;
}

export interface BackupSettings {
  autoBackupEnabled: boolean;
  backupFolder: string;
  retentionCount: number;
  lastBackupAt?: string;
}

export interface RestoreResult {
  success: boolean;
  message?: string;
  error?: string;
}
