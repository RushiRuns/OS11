import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import os from 'os';

import { AttachmentRepository } from '../../src/main/repositories/AttachmentRepository.js';
import {
  AttachmentService,
  sanitizeFilename,
  getMimeType,
} from '../../src/main/services/attachment/AttachmentService.js';
import { TaskRepository } from '../../src/main/repositories/TaskRepository.js';
import { ListRepository } from '../../src/main/repositories/ListRepository.js';

describe('Phase 15: File Attachments', () => {
  let db: Database.Database;
  let repo: AttachmentRepository;
  let service: AttachmentService;
  let taskRepo: TaskRepository;
  let listRepo: ListRepository;
  let tempStorageDir: string;

  beforeEach(() => {
    vi.clearAllMocks();
    db = new Database(':memory:');
    db.pragma('foreign_keys = ON');

    const schemaPath = path.resolve(__dirname, '../../src/main/migrations/0001_initial_schema.sql');
    const schemaSql = fs.readFileSync(schemaPath, 'utf8');
    db.exec(schemaSql);

    tempStorageDir = fs.mkdtempSync(path.join(os.tmpdir(), 'os11-attach-test-'));

    repo = new AttachmentRepository(db);
    service = new AttachmentService(repo, tempStorageDir);
    taskRepo = new TaskRepository(db);
    listRepo = new ListRepository(db);
  });

  afterEach(() => {
    try {
      if (fs.existsSync(tempStorageDir)) {
        fs.rmSync(tempStorageDir, { recursive: true, force: true });
      }
    } catch {
      // ignore cleanup errors in tests
    }
  });

  describe('Utilities', () => {
    it('sanitizes unsafe filenames and path traversal attempts', () => {
      expect(sanitizeFilename('../../etc/passwd')).toBe('_.._etc_passwd');
      expect(sanitizeFilename('C:\\Windows\\System32\\file.exe')).toBe('C:_Windows_System32_file.exe');
      expect(sanitizeFilename('normal-document.pdf')).toBe('normal-document.pdf');
      expect(sanitizeFilename('   .hidden.txt   ')).toBe('hidden.txt');
    });

    it('identifies common MIME types correctly', () => {
      expect(getMimeType('photo.png')).toBe('image/png');
      expect(getMimeType('doc.pdf')).toBe('application/pdf');
      expect(getMimeType('notes.md')).toBe('text/markdown');
      expect(getMimeType('archive.zip')).toBe('application/zip');
      expect(getMimeType('unknown.xyz123')).toBe('application/octet-stream');
    });
  });

  describe('AttachmentRepository', () => {
    it('creates, retrieves, counts, and deletes attachment records', () => {
      const list = listRepo.create({ name: 'General' });
      const task = taskRepo.create({ title: 'Important Task', list_id: list.id });

      const att1 = repo.create({
        task_id: task.id,
        filename: 'file1.pdf',
        original_name: 'Original File 1.pdf',
        mime_type: 'application/pdf',
        size_bytes: 1024,
        local_path: '/path/to/file1.pdf',
      });

      const att2 = repo.create({
        task_id: task.id,
        filename: 'Drive Link',
        original_name: 'Google Drive Doc',
        mime_type: 'text/uri-list',
        size_bytes: 0,
        local_path: 'https://docs.google.com/document/d/123',
        is_link: 1,
      });

      expect(att1.id).toBeDefined();
      expect(att1.is_link).toBe(0);
      expect(att2.is_link).toBe(1);

      const byTask = repo.getByTaskId(task.id);
      expect(byTask).toHaveLength(2);

      const count = repo.getCountByTaskId(task.id);
      expect(count).toBe(2);

      const counts = repo.getAllCounts();
      expect(counts[task.id]).toBe(2);

      const deleted = repo.delete(att1.id);
      expect(deleted.id).toBe(att1.id);
      expect(repo.getByTaskId(task.id)).toHaveLength(1);
    });
  });

  describe('AttachmentService', () => {
    it('uploads a local file and stores it in task directory', async () => {
      const list = listRepo.create({ name: 'Work' });
      const task = taskRepo.create({ title: 'Task with attachment', list_id: list.id });

      // Create a temporary source file
      const sourceFile = path.join(tempStorageDir, 'sample_test_doc.txt');
      fs.writeFileSync(sourceFile, 'Hello OS11 Attachments', 'utf-8');

      const uploaded = await service.upload(sourceFile, task.id);
      expect(uploaded.id).toBeDefined();
      expect(uploaded.original_name).toBe('sample_test_doc.txt');
      expect(uploaded.mime_type).toBe('text/plain');
      expect(uploaded.size_bytes).toBe(22);
      expect(fs.existsSync(uploaded.local_path)).toBe(true);

      const fromRepo = service.getByTask(task.id);
      expect(fromRepo).toHaveLength(1);
      expect(fromRepo[0].id).toBe(uploaded.id);
    });

    it('adds cloud storage link attachments', () => {
      const list = listRepo.create({ name: 'Work' });
      const task = taskRepo.create({ title: 'Cloud Task', list_id: list.id });

      const link = service.addLink(
        task.id,
        'https://drive.google.com/file/d/abcdef/view',
        'Project Specs'
      );

      expect(link.id).toBeDefined();
      expect(link.is_link).toBe(1);
      expect(link.original_name).toBe('Project Specs');
      expect(link.local_path).toBe('https://drive.google.com/file/d/abcdef/view');
    });

    it('atomically deletes DB record and local disk file', async () => {
      const list = listRepo.create({ name: 'Work' });
      const task = taskRepo.create({ title: 'Delete Test', list_id: list.id });

      const sourceFile = path.join(tempStorageDir, 'to_delete.txt');
      fs.writeFileSync(sourceFile, 'Delete me', 'utf-8');

      const uploaded = await service.upload(sourceFile, task.id);
      expect(fs.existsSync(uploaded.local_path)).toBe(true);

      const deleted = service.delete(uploaded.id);
      expect(deleted.id).toBe(uploaded.id);

      // Verify file removed from disk
      expect(fs.existsSync(uploaded.local_path)).toBe(false);
      // Verify record removed from DB
      expect(repo.getById(uploaded.id)).toBeNull();
    });

    it('exports all attachments to a destination directory', async () => {
      const list = listRepo.create({ name: 'Work' });
      const task = taskRepo.create({ title: 'Export Task', list_id: list.id });

      const file1 = path.join(tempStorageDir, 'file1.txt');
      const file2 = path.join(tempStorageDir, 'file2.txt');
      fs.writeFileSync(file1, 'File 1 content', 'utf-8');
      fs.writeFileSync(file2, 'File 2 content', 'utf-8');

      await service.upload(file1, task.id);
      await service.upload(file2, task.id);

      // Add a link that shouldn't be copied as physical file
      service.addLink(task.id, 'https://dropbox.com/s/12345');

      const exportDestDir = path.join(tempStorageDir, 'export_out');
      const exportedCount = await service.exportAll(exportDestDir);

      expect(exportedCount).toBe(2);
      expect(fs.readdirSync(exportDestDir)).toHaveLength(2);
    });
  });
});
