import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

import { createZipArchive, extractZipArchive, crc32 } from '../../src/main/utils/zip-util.js';
import { TaskHistoryRepository } from '../../src/main/repositories/TaskHistoryRepository.js';
import { TaskRepository } from '../../src/main/repositories/TaskRepository.js';
import { ListRepository } from '../../src/main/repositories/ListRepository.js';
import { ProjectRepository } from '../../src/main/repositories/ProjectRepository.js';
import { TagRepository } from '../../src/main/repositories/TagRepository.js';
import { SettingsRepository } from '../../src/main/repositories/SettingsRepository.js';
import { TaskService } from '../../src/main/services/task/TaskService.js';
import { ExportService } from '../../src/main/services/export/ExportService.js';
import { ImportService, parseCsvToObjects } from '../../src/main/services/import/ImportService.js';
import { BackupService } from '../../src/main/services/backup/BackupService.js';
import { IdentityRepository } from '../../src/main/repositories/IdentityRepository.js';
import { ReminderRepository } from '../../src/main/repositories/ReminderRepository.js';

describe('Phase 17: Data Portability, Backup & Import', () => {
  let db: Database.Database;
  let taskRepo: TaskRepository;
  let listRepo: ListRepository;
  let projectRepo: ProjectRepository;
  let tagRepo: TagRepository;
  let settingsRepo: SettingsRepository;
  let historyRepo: TaskHistoryRepository;
  let taskService: TaskService;
  let exportService: ExportService;
  let importService: ImportService;
  let backupService: BackupService;
  let tempDir: string;
  let attachmentsDir: string;
  let backupsDir: string;

  beforeEach(() => {
    db = new Database(':memory:');
    db.pragma('foreign_keys = ON');

    // Run schema
    const schemaPath = path.resolve(__dirname, '../../src/main/migrations/0001_initial_schema.sql');
    const schemaSql = fs.readFileSync(schemaPath, 'utf8');
    db.exec(schemaSql);

    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'os11-portability-test-'));
    attachmentsDir = path.join(tempDir, 'attachments');
    backupsDir = path.join(tempDir, 'backups');
    fs.mkdirSync(attachmentsDir, { recursive: true });
    fs.mkdirSync(backupsDir, { recursive: true });

    taskRepo = new TaskRepository(db);
    listRepo = new ListRepository(db);
    projectRepo = new ProjectRepository(db);
    tagRepo = new TagRepository(db);
    settingsRepo = new SettingsRepository(db);
    historyRepo = new TaskHistoryRepository(db);

    const identityRepo = new IdentityRepository(db);
    const reminderRepo = new ReminderRepository(db);

    taskService = new TaskService(
      taskRepo,
      identityRepo,
      reminderRepo,
      settingsRepo,
      tagRepo,
      historyRepo
    );

    exportService = new ExportService({
      db,
      taskRepo,
      listRepo,
      projectRepo,
      tagRepo,
      settingsRepo,
      attachmentsDir,
    });

    importService = new ImportService(db);

    backupService = new BackupService({
      db,
      settingsRepo,
      exportService,
      importService,
      backupDir: backupsDir,
    });
  });

  afterEach(() => {
    try {
      db.close();
    } catch {
      // ignore
    }
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  });

  // ============================================================
  // 1. ZIP Utility Tests
  // ============================================================
  describe('Zip Utility (zero-dependency)', () => {
    it('computes correct CRC32 and packages/extracts archives', () => {
      const data1 = Buffer.from('Hello OS11 Data Portability!', 'utf-8');
      const data2 = Buffer.from([0, 1, 2, 3, 254, 255]);

      expect(crc32(data1)).toBeGreaterThan(0);

      const entries = [
        { name: 'hello.txt', data: data1 },
        { name: 'binary/data.bin', data: data2 },
      ];

      const zipBuf = createZipArchive(entries);
      expect(zipBuf.length).toBeGreaterThan(0);

      const extracted = extractZipArchive(zipBuf);
      expect(extracted.length).toBe(2);

      const hello = extracted.find((e) => e.name === 'hello.txt');
      expect(hello).toBeDefined();
      expect(hello!.data.toString('utf-8')).toBe('Hello OS11 Data Portability!');

      const binary = extracted.find((e) => e.name === 'binary/data.bin');
      expect(binary).toBeDefined();
      expect(Buffer.compare(binary!.data, data2)).toBe(0);
    });
  });

  // ============================================================
  // 2. Version History & Task Rollback Tests
  // ============================================================
  describe('Task Version History & Rollback', () => {
    it('records diffs upon updating a task and allows version rollback', () => {
      const task = taskService.create({
        title: 'Initial Title',
        notes: 'Initial notes',
        priority: 1,
      });

      // Update title and priority
      const updated = taskService.update(task.id, {
        id: task.id,
        title: 'Revised Title',
        priority: 3,
      });
      expect(updated.title).toBe('Revised Title');
      expect(updated.priority).toBe(3);

      const history = taskService.getHistory(task.id);
      expect(history.length).toBe(1);
      expect(history[0].changed_fields.title).toEqual({
        from: 'Initial Title',
        to: 'Revised Title',
      });
      expect(history[0].changed_fields.priority).toEqual({
        from: 1,
        to: 3,
      });

      // Rollback to previous version
      const restored = taskService.restoreVersion(history[0].id);
      expect(restored.title).toBe('Initial Title');
      expect(restored.priority).toBe(1);
    });

    it('purges history records older than specified days', () => {
      const task = taskService.create({ title: 'Purge Test' });

      // Record a fake old entry directly in historyRepo
      const oldDate = new Date(Date.now() - 40 * 24 * 60 * 60 * 1000).toISOString();
      historyRepo.record(task.id, { title: { from: 'Ancient', to: 'Old' } }, oldDate);

      // Record a recent entry
      historyRepo.record(task.id, { title: { from: 'Old', to: 'New' } });

      expect(historyRepo.getByTaskId(task.id).length).toBe(2);

      const purged = taskService.purgeOldHistory(30);
      expect(purged).toBe(1);

      const remaining = historyRepo.getByTaskId(task.id);
      expect(remaining.length).toBe(1);
      expect(remaining[0].changed_fields.title.to).toBe('New');
    });
  });

  // ============================================================
  // 3. Export Service Tests
  // ============================================================
  describe('ExportService', () => {
    beforeEach(() => {
      taskService.create({ title: 'Task Alpha', priority: 1, due_date: '2026-10-01' });
      taskService.create({ title: 'Task Beta', priority: 2, notes: 'Important details' });
    });

    it('exports full round-trip JSON', () => {
      const json = exportService.exportJson();
      expect(json.version).toBe(1);
      expect(json.tasks.length).toBeGreaterThanOrEqual(2);
      expect(json.lists.length).toBeGreaterThan(0);
      expect(json.settings).toBeDefined();
    });

    it('exports flat RFC 4180 CSV', () => {
      const csv = exportService.exportCsv();
      expect(csv).toContain('"title"');
      expect(csv).toContain('"Task Alpha"');
      expect(csv).toContain('"Task Beta"');
      expect(csv).toContain('"Important details"');
    });

    it('exports Markdown checklist grouped by list', () => {
      const md = exportService.exportMarkdown();
      expect(md).toContain('# OS11 Task Export');
      expect(md).toContain('- [ ] Task Alpha [P1] (due: 2026-10-01)');
      expect(md).toContain('- [ ] Task Beta [P2]');
    });

    it('generates clean print HTML view', () => {
      const html = exportService.generatePrintHtml();
      expect(html).toContain('<!DOCTYPE html>');
      expect(html).toContain('Task Alpha');
      expect(html).toContain('Task Beta');
      expect(html).toContain('@media print');
    });

    it('packages attachments ZIP with json export', () => {
      // Create a dummy attachment file
      const sampleFile = path.join(attachmentsDir, 'test.txt');
      fs.writeFileSync(sampleFile, 'attachment content');

      const zipBuf = exportService.exportAttachmentsZip();
      expect(zipBuf.length).toBeGreaterThan(0);

      const extracted = extractZipArchive(zipBuf);
      const jsonEntry = extracted.find((e) => e.name === 'os11-export.json');
      expect(jsonEntry).toBeDefined();

      const attachEntry = extracted.find((e) => e.name === 'attachments/test.txt');
      expect(attachEntry).toBeDefined();
      expect(attachEntry!.data.toString('utf-8')).toBe('attachment content');
    });
  });

  // ============================================================
  // 4. Import Service Tests
  // ============================================================
  describe('ImportService', () => {
    it('imports OS11 JSON export idempotently', async () => {
      taskService.create({ title: 'Task 1' });
      taskService.create({ title: 'Task 2' });

      const exportData = exportService.exportJson();
      const countBefore = taskRepo.getAll().length;

      // Re-importing existing data should be idempotent (no duplicates created)
      const res = await importService.importData({
        format: 'os11_json',
        content: JSON.stringify(exportData),
      });

      expect(res.success).toBe(true);
      expect(res.skippedCount).toBeGreaterThanOrEqual(countBefore);
      expect(taskRepo.getAll().length).toBe(countBefore);
    });

    it('imports Todoist JSON format', async () => {
      const todoistData = {
        projects: [{ id: 100, name: 'Work Project', color: '#ff0000' }],
        labels: [{ id: 200, name: 'urgent', color: '#ff9900' }],
        items: [
          {
            content: 'Ship feature v2',
            description: 'Fix remaining blockers',
            priority: 4, // Todoist P1
            due: { date: '2026-11-15T09:00:00' },
            project_id: 100,
          },
        ],
      };

      const res = await importService.importData({
        format: 'todoist_json',
        content: JSON.stringify(todoistData),
      });

      expect(res.success).toBe(true);
      expect(res.importedTasks).toBe(1);
      expect(res.importedProjects).toBe(1);
      expect(res.importedTags).toBe(1);

      const imported = taskRepo.getAll().find((t) => t.title === 'Ship feature v2');
      expect(imported).toBeDefined();
      expect(imported!.notes).toBe('Fix remaining blockers');
      expect(imported!.priority).toBe(1);
      expect(imported!.due_date).toBe('2026-11-15');
      expect(imported!.due_time).toBe('09:00');
    });

    it('imports Microsoft To Do CSV format', async () => {
      const csv = `Task Name,Due Date,Importance,Completed,Notes
Buy groceries,2026-10-05,High,Completed,Milk and eggs
Prepare slides,2026-10-10,Normal,Not completed,Keynote deck`;

      const res = await importService.importData({
        format: 'ms_todo_csv',
        content: csv,
      });

      expect(res.success).toBe(true);
      expect(res.importedTasks).toBe(2);

      const t1 = taskRepo.getAll().find((t) => t.title === 'Buy groceries');
      expect(t1).toBeDefined();
      expect(t1!.is_completed).toBe(1);
      expect(t1!.priority).toBe(1);
      expect(t1!.notes).toBe('Milk and eggs');
    });

    it('imports Notion Database CSV format with tags', async () => {
      const csv = `"Name","Due Date","Priority","Status","Tags","Notes"
"Refactor API","2026-12-01","High","Done","Backend, Performance","Split monolith"
"Write Docs","2026-12-05","Low","In progress","Documentation","API reference"`;

      const res = await importService.importData({
        format: 'notion_csv',
        content: csv,
      });

      expect(res.success).toBe(true);
      expect(res.importedTasks).toBe(2);
      expect(res.importedTags).toBe(3); // Backend, Performance, Documentation

      const t1 = taskRepo.getAll().find((t) => t.title === 'Refactor API');
      expect(t1).toBeDefined();
      expect(t1!.is_completed).toBe(1);
      expect(t1!.priority).toBe(1);

      const tags = tagRepo.getForTask(t1!.id);
      expect(tags.map((tg) => tg.name).sort()).toEqual(['Backend', 'Performance']);
    });

    it('rolls back completely if a database error occurs during import', async () => {
      const countBefore = taskRepo.getAll().length;

      // Malformed JSON that fails parsing
      const res = await importService.importData({
        format: 'os11_json',
        content: '{"invalid": syntax}',
      });

      expect(res.success).toBe(false);
      expect(res.error).toBeDefined();
      expect(taskRepo.getAll().length).toBe(countBefore);
    });

    it('parses CSV records correctly with quotes and escaped characters', () => {
      const csv = `"Title","Notes","Tags"
"Task with ""quoted"" words","Line 1
Line 2","tag1, tag2"`;

      const parsed = parseCsvToObjects(csv);
      expect(parsed.length).toBe(1);
      expect(parsed[0].title).toBe('Task with "quoted" words');
      expect(parsed[0].notes).toContain('Line 1\nLine 2');
      expect(parsed[0].tags).toBe('tag1, tag2');
    });
  });

  // ============================================================
  // 5. Backup & Restore Tests
  // ============================================================
  describe('BackupService', () => {
    it('creates manual backup and enforces retention limit', async () => {
      backupService.updateSettings({ retentionCount: 3 });

      taskService.create({ title: 'Backup Task' });

      // Create 4 backups
      const b1 = await backupService.createBackup();
      await backupService.createBackup();
      await backupService.createBackup();
      const b4 = await backupService.createBackup();

      expect(b1.sizeBytes).toBeGreaterThan(0);
      expect(b4.sizeBytes).toBeGreaterThan(0);

      const backups = backupService.listBackups();
      // Should have rotated down to 3 backups
      expect(backups.length).toBe(3);
    });

    it('executes daily auto-backup once and skips if already done today', async () => {
      const b1 = await backupService.checkAndRunDailyAutoBackup();
      expect(b1).not.toBeNull();

      // Second check on the same day should return null (skip)
      const b2 = await backupService.checkAndRunDailyAutoBackup();
      expect(b2).toBeNull();
    });

    it('restores database state from a backup archive', async () => {
      taskService.create({ title: 'Pre-Backup Task' });

      const backup = await backupService.createBackup();

      // Add a task after backup
      taskService.create({ title: 'Post-Backup Task' });

      // Restore from backup
      const res = await backupService.restoreFromBackup(backup.filePath);
      expect(res.success).toBe(true);

      const allTasks = taskRepo.getAll();
      expect(allTasks.some((t) => t.title === 'Pre-Backup Task')).toBe(true);
    });
  });
});
