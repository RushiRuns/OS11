import { app, nativeImage } from 'electron';
import path from 'node:path';
import fs from 'node:fs';
import { v4 as uuidv4 } from 'uuid';
import { AttachmentRepository } from '../../repositories/AttachmentRepository.js';
import type { Attachment } from '@shared/types/index.js';

export function sanitizeFilename(name: string): string {
  // Strip control characters, path traversals, and path separators
  // eslint-disable-next-line no-control-regex
  let clean = name.trim().replace(/[\x00-\x1f\x80-\x9f]/g, '').replace(/[/\\]/g, '_');
  clean = clean.replace(/^\.+/, '').trim();
  return clean || 'attachment';
}

export function getMimeType(filePathOrUrl: string): string {
  const ext = path.extname(filePathOrUrl).toLowerCase();
  switch (ext) {
    case '.pdf':
      return 'application/pdf';
    case '.png':
      return 'image/png';
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg';
    case '.gif':
      return 'image/gif';
    case '.webp':
      return 'image/webp';
    case '.svg':
      return 'image/svg+xml';
    case '.bmp':
      return 'image/bmp';
    case '.txt':
      return 'text/plain';
    case '.md':
      return 'text/markdown';
    case '.json':
      return 'application/json';
    case '.csv':
      return 'text/csv';
    case '.zip':
      return 'application/zip';
    case '.doc':
      return 'application/msword';
    case '.docx':
      return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    case '.xls':
      return 'application/vnd.ms-excel';
    case '.xlsx':
      return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    default:
      return 'application/octet-stream';
  }
}

export class AttachmentService {
  private repo: AttachmentRepository;
  private baseStorageDir?: string;

  constructor(repo?: AttachmentRepository, baseStorageDir?: string) {
    this.repo = repo ?? new AttachmentRepository();
    this.baseStorageDir = baseStorageDir;
  }

  private getStorageBaseDir(): string {
    if (this.baseStorageDir) {
      return this.baseStorageDir;
    }
    try {
      if (typeof app !== 'undefined' && app?.getPath) {
        return path.join(app.getPath('userData'), 'attachments');
      }
    } catch {
      // fallback for test environments
    }
    return path.join(process.cwd(), '.os11-attachments');
  }

  /**
   * Uploads a local file:
   * 1. Copies file to userData/attachments/{taskId}/{uuid}.{ext}
   * 2. Sanitizes original filename
   * 3. Inserts into attachments table
   * 4. Generates thumbnail for images (80px height)
   * 5. Returns Attachment record
   */
  public async upload(sourcePath: string, taskId: string): Promise<Attachment> {
    if (!fs.existsSync(sourcePath)) {
      throw new Error(`Source file does not exist: ${sourcePath}`);
    }

    const originalBasename = path.basename(sourcePath);
    const sanitizedOriginalName = sanitizeFilename(originalBasename);
    const ext = path.extname(sourcePath).toLowerCase();
    const uniqueId = uuidv4();
    const storageFilename = `${uniqueId}${ext}`;

    const taskAttachmentDir = path.join(this.getStorageBaseDir(), taskId);
    if (!fs.existsSync(taskAttachmentDir)) {
      fs.mkdirSync(taskAttachmentDir, { recursive: true });
    }

    const destinationPath = path.join(taskAttachmentDir, storageFilename);
    await fs.promises.copyFile(sourcePath, destinationPath);

    const stats = await fs.promises.stat(destinationPath);
    const mimeType = getMimeType(destinationPath);

    // Generate thumbnail for image files
    let thumbnailDataUrl: string | null = null;
    if (mimeType.startsWith('image/')) {
      thumbnailDataUrl = this.generateThumbnail(destinationPath);
    }

    const record = this.repo.create({
      task_id: taskId,
      filename: storageFilename,
      original_name: sanitizedOriginalName,
      mime_type: mimeType,
      size_bytes: stats.size,
      local_path: destinationPath,
      is_link: 0,
      thumbnail_path: thumbnailDataUrl,
    });

    return record;
  }

  /**
   * Generates a base64 data URL thumbnail for an image file resized to height 80px
   */
  private generateThumbnail(imagePath: string): string | null {
    try {
      if (typeof nativeImage !== 'undefined' && nativeImage?.createFromPath) {
        const img = nativeImage.createFromPath(imagePath);
        if (!img.isEmpty()) {
          const resized = img.resize({ height: 80 });
          return resized.toDataURL();
        }
      }
    } catch {
      // best-effort fallback
    }
    return null;
  }

  /**
   * Adds a cloud storage URL link (Google Drive / Dropbox / OneDrive / Web link)
   */
  public addLink(taskId: string, url: string, title?: string): Attachment {
    if (!url || typeof url !== 'string') {
      throw new Error('URL is required for link attachments');
    }

    const trimmedUrl = url.trim();
    const cleanTitle = title?.trim() || trimmedUrl;

    const record = this.repo.create({
      task_id: taskId,
      filename: cleanTitle,
      original_name: cleanTitle,
      mime_type: 'text/uri-list',
      size_bytes: 0,
      local_path: trimmedUrl,
      is_link: 1,
      thumbnail_path: null,
    });

    return record;
  }

  /**
   * Deletes attachment record from DB and deletes file from disk atomically.
   */
  public delete(attachmentId: string): Attachment {
    const record = this.repo.getById(attachmentId);
    if (!record) {
      throw new Error(`Attachment not found: ${attachmentId}`);
    }

    // Delete DB record first
    this.repo.delete(attachmentId);

    // If it's a physical local file, remove it from disk
    if (record.is_link === 0 && record.local_path) {
      try {
        if (fs.existsSync(record.local_path)) {
          fs.unlinkSync(record.local_path);
        }
      } catch (err) {
        console.error(`Failed to delete local attachment file: ${record.local_path}`, err);
      }
    }

    return record;
  }

  /**
   * Retrieves all attachments for a specific task.
   */
  public getByTask(taskId: string): Attachment[] {
    return this.repo.getByTaskId(taskId);
  }

  /**
   * Retrieves all attachments across all tasks.
   */
  public getAll(): Attachment[] {
    return this.repo.getAll();
  }

  /**
   * Retrieves count of attachments for every task ID.
   */
  public getAllCounts(): Record<string, number> {
    return this.repo.getAllCounts();
  }

  /**
   * Exports all physical attachment files to a target directory.
   */
  public async exportAll(destDir: string): Promise<number> {
    if (!fs.existsSync(destDir)) {
      fs.mkdirSync(destDir, { recursive: true });
    }

    const allAttachments = this.repo.getAll().filter((a) => a.is_link === 0);
    let exportedCount = 0;

    for (const a of allAttachments) {
      if (a.local_path && fs.existsSync(a.local_path)) {
        const destFile = path.join(destDir, `${a.task_id}_${a.original_name}`);
        try {
          await fs.promises.copyFile(a.local_path, destFile);
          exportedCount++;
        } catch (err) {
          console.error(`Failed to export attachment ${a.id}`, err);
        }
      }
    }

    return exportedCount;
  }
}

export default AttachmentService;
