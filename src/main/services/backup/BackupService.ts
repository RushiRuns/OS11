import fs from 'node:fs';
import path from 'node:path';
import { app } from 'electron';
import type Database from 'better-sqlite3';

import { getDb } from '../../repositories/db.js';
import { SettingsRepository } from '../../repositories/SettingsRepository.js';
import { ExportService } from '../export/ExportService.js';
import { ImportService } from '../import/ImportService.js';
import { extractZipArchive } from '../../utils/zip-util.js';
import type {
  BackupInfo,
  BackupSettings,
  RestoreResult,
} from '../../../shared/types/index.js';

export class BackupService {
  private db: Database.Database;
  private settingsRepo: SettingsRepository;
  private exportService: ExportService;
  private importService: ImportService;
  private customBackupDir?: string;

  constructor(options?: {
    db?: Database.Database;
    settingsRepo?: SettingsRepository;
    exportService?: ExportService;
    importService?: ImportService;
    backupDir?: string;
  }) {
    this.db = options?.db ?? getDb();
    this.settingsRepo = options?.settingsRepo ?? new SettingsRepository(this.db);
    this.exportService = options?.exportService ?? new ExportService({ db: this.db });
    this.importService = options?.importService ?? new ImportService(this.db);
    this.customBackupDir = options?.backupDir;
  }

  public getBackupDirectory(): string {
    if (this.customBackupDir) {
      return this.customBackupDir;
    }
    const configured = this.settingsRepo.get<string>('backup_folder');
    if (configured && fs.existsSync(configured)) {
      return configured;
    }
    try {
      if (typeof app !== 'undefined' && app?.getPath) {
        return path.join(app.getPath('userData'), 'backups');
      }
    } catch {
      // test fallback
    }
    return path.join(process.cwd(), '.os11-backups');
  }

  public getSettings(): BackupSettings {
    const autoBackupEnabled = this.settingsRepo.get<boolean>('auto_backup_enabled', true);
    const retentionCount = this.settingsRepo.get<number>('backup_retention_count', 7);
    const lastBackupAt = this.settingsRepo.get<string>('last_backup_at') ?? undefined;
    const backupFolder = this.getBackupDirectory();

    return {
      autoBackupEnabled,
      backupFolder,
      retentionCount,
      lastBackupAt,
    };
  }

  public updateSettings(updates: Partial<BackupSettings>): BackupSettings {
    if (updates.autoBackupEnabled !== undefined) {
      this.settingsRepo.set('auto_backup_enabled', updates.autoBackupEnabled);
    }
    if (updates.retentionCount !== undefined) {
      this.settingsRepo.set('backup_retention_count', Math.max(1, updates.retentionCount));
    }
    if (updates.backupFolder !== undefined) {
      this.settingsRepo.set('backup_folder', updates.backupFolder);
    }
    return this.getSettings();
  }

  /**
   * Creates a full ZIP backup (JSON export + attachments)
   */
  public async createBackup(destinationFolder?: string): Promise<BackupInfo> {
    const backupDir = destinationFolder ?? this.getBackupDirectory();
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }

    const now = new Date();
    const datePart = now.toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const uniqueSuffix = `${now.getTime()}-${Math.random().toString(36).substring(2, 6)}`;
    const fileName = `os11-backup-${datePart}_${uniqueSuffix}.zip`;
    const filePath = path.join(backupDir, fileName);

    // Build ZIP with JSON export and all attachments
    this.exportService.exportAttachmentsZip(filePath);

    const stat = fs.statSync(filePath);
    const createdAt = now.toISOString();

    this.settingsRepo.set('last_backup_at', createdAt);

    // Apply retention rotation
    this.rotateBackups(backupDir);

    return {
      fileName,
      filePath,
      sizeBytes: stat.size,
      createdAt,
    };
  }

  /**
   * Daily auto-backup: runs on startup if enabled and no backup exists for today
   */
  public async checkAndRunDailyAutoBackup(): Promise<BackupInfo | null> {
    const settings = this.getSettings();
    if (!settings.autoBackupEnabled) {
      return null;
    }

    const todayStr = new Date().toISOString().split('T')[0];
    const existingBackups = this.listBackups();

    const alreadyBackedUpToday = existingBackups.some((b) =>
      b.createdAt.startsWith(todayStr) || b.fileName.includes(todayStr)
    );

    if (alreadyBackedUpToday) {
      return null;
    }

    return this.createBackup();
  }

  /**
   * Lists all existing backups in the backup folder sorted newest to oldest
   */
  public listBackups(backupFolder?: string): BackupInfo[] {
    const dir = backupFolder ?? this.getBackupDirectory();
    if (!fs.existsSync(dir)) {
      return [];
    }

    const files = fs.readdirSync(dir).filter((f) => f.endsWith('.zip'));
    const backups: BackupInfo[] = [];

    for (const f of files) {
      const fullPath = path.join(dir, f);
      try {
        const stat = fs.statSync(fullPath);
        backups.push({
          fileName: f,
          filePath: fullPath,
          sizeBytes: stat.size,
          createdAt: stat.mtime.toISOString(),
        });
      } catch {
        // file could have been removed concurrently
      }
    }

    return backups.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  }

  /**
   * Deletes backups exceeding the retention threshold (keeps newest N)
   */
  public rotateBackups(backupFolder?: string): number {
    const settings = this.getSettings();
    const keepCount = settings.retentionCount;
    const backups = this.listBackups(backupFolder);

    if (backups.length <= keepCount) {
      return 0;
    }

    let deletedCount = 0;
    const toDelete = backups.slice(keepCount);

    for (const b of toDelete) {
      try {
        if (fs.existsSync(b.filePath)) {
          fs.unlinkSync(b.filePath);
          deletedCount++;
        }
      } catch {
        // ignore deletion errors
      }
    }

    return deletedCount;
  }

  /**
   * Restores data from a backup ZIP archive
   */
  public async restoreFromBackup(backupFilePath: string): Promise<RestoreResult> {
    if (!fs.existsSync(backupFilePath)) {
      return { success: false, error: `Backup file does not exist: ${backupFilePath}` };
    }

    try {
      const fileBuffer = fs.readFileSync(backupFilePath);
      const entries = extractZipArchive(fileBuffer);

      const jsonEntry = entries.find((e) => e.name === 'os11-export.json');
      if (!jsonEntry) {
        return { success: false, error: 'Corrupted backup: os11-export.json not found in archive.' };
      }

      const jsonContent = jsonEntry.data.toString('utf-8');

      // 1. Restore database records via ImportService
      const importResult = await this.importService.importData({
        format: 'os11_json',
        content: jsonContent,
      });

      if (!importResult.success) {
        return { success: false, error: importResult.error };
      }

      // 2. Restore attachments if present
      const attachDir = this.exportService.getAttachmentsDir();
      for (const entry of entries) {
        if (entry.name.startsWith('attachments/') && entry.name !== 'attachments/') {
          const relPath = entry.name.replace(/^attachments\//, '');
          const destPath = path.join(attachDir, relPath);
          const dir = path.dirname(destPath);
          if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
          }
          fs.writeFileSync(destPath, entry.data);
        }
      }

      return {
        success: true,
        message: `Backup restored successfully (${importResult.importedTasks} tasks, ${importResult.importedLists} lists).`,
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return { success: false, error: msg };
    }
  }
}

export default BackupService;
