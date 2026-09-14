import React, { useState, useEffect } from 'react';
import { Button } from '../../components/Button/Button.js';
import { invoke, on } from '../../services/ipc.js';
import { IPC } from '@shared/ipc-channels.js';
import type {
  BackupInfo,
  BackupSettings,
  ExportFormat,
  ImportFormat,
  ImportProgress,
  ImportResult,
  List,
} from '@shared/types/index.js';
import baseStyles from './SettingsView.module.css';
import styles from './DataManagementSettings.module.css';

export function DataManagementSettings(): React.ReactElement {
  // Export states
  const [exportLoading, setExportLoading] = useState(false);
  const [exportStatus, setExportStatus] = useState<string | null>(null);

  // Import states
  const [importFormat, setImportFormat] = useState<ImportFormat>('os11_json');
  const [selectedFile, setSelectedFile] = useState<{ filePath: string; fileName: string; content: string } | null>(null);
  const [targetListId, setTargetListId] = useState<string>('list_inbox');
  const [lists, setLists] = useState<List[]>([]);
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState<ImportProgress | null>(null);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);

  // Backup states
  const [backupSettings, setBackupSettings] = useState<BackupSettings>({
    autoBackupEnabled: true,
    backupFolder: '',
    retentionCount: 7,
  });
  const [backups, setBackups] = useState<BackupInfo[]>([]);
  const [backupLoading, setBackupLoading] = useState(false);
  const [backupStatus, setBackupStatus] = useState<string | null>(null);

  useEffect(() => {
    loadLists();
    loadBackups();
    loadBackupSettings();

    // Listen for import progress updates
    const unsubscribe = on(IPC.IMPORT.PROGRESS, (_event, progress) => {
      setImportProgress(progress as ImportProgress);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  const loadLists = async () => {
    try {
      const res = await invoke<List[]>(IPC.LISTS.GET_ALL);
      if (res) {
        setLists(res.filter((l) => !l.is_smart));
      }
    } catch {
      // ignore
    }
  };

  const loadBackups = async () => {
    try {
      const list = await invoke<BackupInfo[]>(IPC.BACKUP.LIST);
      if (list) setBackups(list);
    } catch {
      // ignore
    }
  };

  const loadBackupSettings = async () => {
    try {
      const settings = await invoke<BackupSettings>(IPC.BACKUP.GET_SETTINGS);
      if (settings) setBackupSettings(settings);
    } catch {
      // ignore
    }
  };

  // ---------------- Export Handlers ----------------
  const handleExport = async (format: ExportFormat) => {
    setExportLoading(true);
    setExportStatus(null);
    try {
      if (format === 'print_pdf') {
        const html = await invoke<string>(IPC.EXPORT.PRINT_PDF);
        const win = window.open('', '_blank');
        if (win) {
          win.document.write(html);
          win.document.close();
          win.focus();
          win.print();
        }
        setExportStatus('Print window opened.');
        setExportLoading(false);
        return;
      }

      const destPath = await invoke<string | null>(IPC.EXPORT.SELECT_DESTINATION, format);
      if (!destPath) {
        setExportLoading(false);
        return;
      }

      if (format === 'json') {
        await invoke(IPC.EXPORT.JSON, { destinationPath: destPath, format: 'json' });
      } else if (format === 'csv') {
        await invoke(IPC.EXPORT.CSV, { destinationPath: destPath, format: 'csv' });
      } else if (format === 'markdown') {
        await invoke(IPC.EXPORT.MARKDOWN, { destinationPath: destPath, format: 'markdown' });
      } else if (format === 'attachments_zip') {
        await invoke(IPC.EXPORT.ATTACHMENTS, destPath);
      }

      setExportStatus(`Successfully exported to ${destPath}`);
    } catch (err: unknown) {
      setExportStatus(`Export error: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setExportLoading(false);
    }
  };

  // ---------------- Import Handlers ----------------
  const handlePickImportFile = async () => {
    try {
      const fileData = await invoke<{ filePath: string; fileName: string; content: string } | null>(
        IPC.IMPORT.SELECT_FILE,
        importFormat
      );
      if (fileData) {
        setSelectedFile(fileData);
        setImportResult(null);
        setImportProgress(null);
      }
    } catch (err: unknown) {
      alert(`Could not select file: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  const handleExecuteImport = async () => {
    if (!selectedFile) return;
    setImporting(true);
    setImportResult(null);
    try {
      const result = await invoke<ImportResult>(IPC.IMPORT.EXECUTE, {
        format: importFormat,
        content: selectedFile.content,
        targetListId,
      });
      setImportResult(result);
    } catch (err: unknown) {
      setImportResult({
        success: false,
        importedTasks: 0,
        importedLists: 0,
        importedProjects: 0,
        importedTags: 0,
        error: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setImporting(false);
      loadLists();
    }
  };

  // ---------------- Backup Handlers ----------------
  const handleToggleAutoBackup = async () => {
    const updated = !backupSettings.autoBackupEnabled;
    const newSettings = await invoke<BackupSettings>(IPC.BACKUP.SET_SETTINGS, {
      autoBackupEnabled: updated,
    });
    setBackupSettings(newSettings);
  };

  const handleChangeRetention = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseInt(e.target.value, 10);
    if (!isNaN(val) && val >= 1) {
      const newSettings = await invoke<BackupSettings>(IPC.BACKUP.SET_SETTINGS, {
        retentionCount: val,
      });
      setBackupSettings(newSettings);
    }
  };

  const handleSelectBackupFolder = async () => {
    try {
      const chosen = await invoke<string | null>(IPC.BACKUP.SELECT_FOLDER);
      if (chosen) {
        const newSettings = await invoke<BackupSettings>(IPC.BACKUP.SET_SETTINGS, {
          backupFolder: chosen,
        });
        setBackupSettings(newSettings);
        loadBackups();
      }
    } catch (err: unknown) {
      alert(`Folder error: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  const handleCreateManualBackup = async () => {
    setBackupLoading(true);
    setBackupStatus(null);
    try {
      const backup = await invoke<BackupInfo>(IPC.BACKUP.CREATE);
      setBackupStatus(`Created backup: ${backup.fileName}`);
      loadBackups();
      loadBackupSettings();
    } catch (err: unknown) {
      setBackupStatus(`Backup failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setBackupLoading(false);
    }
  };

  const handleRestoreBackup = async (filePath?: string) => {
    if (!confirm('Restoring will import records from the backup archive. Proceed?')) {
      return;
    }
    setBackupLoading(true);
    setBackupStatus(null);
    try {
      const res = await invoke<{ success: boolean; message?: string; error?: string }>(
        IPC.BACKUP.RESTORE,
        filePath
      );
      if (res.success) {
        setBackupStatus(res.message || 'Backup restored successfully.');
      } else {
        setBackupStatus(`Restore failed: ${res.error}`);
      }
    } catch (err: unknown) {
      setBackupStatus(`Restore failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setBackupLoading(false);
    }
  };

  return (
    <div className={baseStyles.containerWrapper}>
      <header className={baseStyles.sectionHeader}>
        <h2 className={baseStyles.sectionTitle}>Data Portability & Backup</h2>
        <p className={baseStyles.sectionDesc}>
          Export your tasks into standard open formats, migrate data from other tools, and manage automatic backups.
        </p>
      </header>

      {/* 1. EXPORT SECTION */}
      <section className={baseStyles.settingGroup}>
        <div className={baseStyles.groupTitle}>Export Data</div>
        <div className={baseStyles.settingRow}>
          <div className={baseStyles.settingInfo}>
            <span className={baseStyles.settingLabel}>Data Export Tools</span>
            <span className={baseStyles.settingDescription}>
              Download your complete OS11 database or export formatted lists for other applications.
            </span>
          </div>
        </div>

        <div className={styles.exportActions}>
          <Button
            size="sm"
            variant="ghost"
            disabled={exportLoading}
            onClick={() => handleExport('json')}
          >
            Export JSON (Full)
          </Button>
          <Button
            size="sm"
            variant="ghost"
            disabled={exportLoading}
            onClick={() => handleExport('csv')}
          >
            Export CSV
          </Button>
          <Button
            size="sm"
            variant="ghost"
            disabled={exportLoading}
            onClick={() => handleExport('markdown')}
          >
            Export Markdown
          </Button>
          <Button
            size="sm"
            variant="ghost"
            disabled={exportLoading}
            onClick={() => handleExport('attachments_zip')}
          >
            Export Attachments (ZIP)
          </Button>
          <Button
            size="sm"
            variant="ghost"
            disabled={exportLoading}
            onClick={() => handleExport('print_pdf')}
          >
            Print / PDF View
          </Button>
        </div>

        {exportStatus && (
          <div className={styles.resultMessageSuccess}>{exportStatus}</div>
        )}
      </section>

      {/* 2. IMPORT SECTION */}
      <section className={baseStyles.settingGroup}>
        <div className={baseStyles.groupTitle}>Import & Migration</div>
        <div className={baseStyles.settingRow}>
          <div className={baseStyles.settingInfo}>
            <span className={baseStyles.settingLabel}>Import Source</span>
            <span className={baseStyles.settingDescription}>
              Select format to import tasks, tags, and projects from other task managers.
            </span>
          </div>
          <select
            className={baseStyles.selectInput}
            value={importFormat}
            onChange={(e) => {
              setImportFormat(e.target.value as ImportFormat);
              setSelectedFile(null);
              setImportResult(null);
            }}
          >
            <option value="os11_json">OS11 JSON Export</option>
            <option value="todoist_json">Todoist JSON</option>
            <option value="ms_todo_csv">Microsoft To Do (CSV)</option>
            <option value="notion_csv">Notion Database (CSV)</option>
          </select>
        </div>

        {importFormat !== 'os11_json' && (
          <div className={baseStyles.settingRow}>
            <div className={baseStyles.settingInfo}>
              <span className={baseStyles.settingLabel}>Target List</span>
              <span className={baseStyles.settingDescription}>
                Assign newly imported tasks to this list.
              </span>
            </div>
            <select
              className={baseStyles.selectInput}
              value={targetListId}
              onChange={(e) => setTargetListId(e.target.value)}
            >
              <option value="list_inbox">Inbox</option>
              {lists.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className={styles.filePickBox}>
          <div className={styles.fileDetails}>
            <span className={styles.fileName}>
              {selectedFile ? selectedFile.fileName : 'No file selected'}
            </span>
            <span className={styles.fileMeta}>
              {selectedFile ? `${Math.round(selectedFile.content.length / 1024)} KB` : 'Choose a file to begin ingestion'}
            </span>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <Button size="sm" variant="ghost" onClick={handlePickImportFile}>
              Select File...
            </Button>
            {selectedFile && (
              <Button
                size="sm"
                variant="primary"
                disabled={importing}
                onClick={handleExecuteImport}
              >
                {importing ? 'Importing...' : 'Start Import'}
              </Button>
            )}
          </div>
        </div>

        {importProgress && importing && (
          <div className={styles.progressBarContainer}>
            <div className={styles.progressBarTrack}>
              <div
                className={styles.progressBarFill}
                style={{
                  width: `${importProgress.total > 0 ? (importProgress.current / importProgress.total) * 100 : 0}%`,
                }}
              />
            </div>
            <span className={styles.progressText}>
              {importProgress.message} ({importProgress.current} / {importProgress.total})
            </span>
          </div>
        )}

        {importResult && (
          <div
            className={
              importResult.success ? styles.resultMessageSuccess : styles.resultMessageError
            }
          >
            {importResult.success
              ? `Imported: ${importResult.importedTasks} tasks, ${importResult.importedLists} lists, ${importResult.importedProjects} projects, ${importResult.importedTags} tags.${importResult.skippedCount ? ` (${importResult.skippedCount} duplicates skipped)` : ''}`
              : `Import failed: ${importResult.error}`}
          </div>
        )}
      </section>

      {/* 3. AUTO-BACKUP & RESTORE SECTION */}
      <section className={baseStyles.settingGroup}>
        <div className={baseStyles.groupTitle}>Automatic Backup & Restore</div>

        <div className={baseStyles.settingRow}>
          <div className={baseStyles.settingInfo}>
            <span className={baseStyles.settingLabel}>Daily Automatic Backup</span>
            <span className={baseStyles.settingDescription}>
              Automatically snapshots database and attachments once per day on app startup.
            </span>
          </div>
          <input
            type="checkbox"
            checked={backupSettings.autoBackupEnabled}
            onChange={handleToggleAutoBackup}
          />
        </div>

        <div className={baseStyles.settingRow}>
          <div className={baseStyles.settingInfo}>
            <span className={baseStyles.settingLabel}>Backup Retention Limit</span>
            <span className={baseStyles.settingDescription}>
              Keep the last N daily backups; older archives are automatically rotated out.
            </span>
          </div>
          <input
            type="number"
            min="1"
            max="365"
            className={baseStyles.textInput}
            style={{ width: '80px' }}
            value={backupSettings.retentionCount}
            onChange={handleChangeRetention}
          />
        </div>

        <div className={baseStyles.settingRow}>
          <div className={baseStyles.settingInfo}>
            <span className={baseStyles.settingLabel}>Backup Location</span>
            <span className={baseStyles.settingDescription}>
              {backupSettings.backupFolder || 'Default system directory'}
            </span>
          </div>
          <Button size="sm" variant="ghost" onClick={handleSelectBackupFolder}>
            Change Folder...
          </Button>
        </div>

        <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
          <Button
            size="sm"
            variant="primary"
            disabled={backupLoading}
            onClick={handleCreateManualBackup}
          >
            {backupLoading ? 'Backing up...' : 'Backup Now'}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            disabled={backupLoading}
            onClick={() => handleRestoreBackup()}
          >
            Restore from File...
          </Button>
        </div>

        {backupStatus && (
          <div className={styles.resultMessageSuccess}>{backupStatus}</div>
        )}

        {/* Recent backups table */}
        {backups.length > 0 && (
          <table className={styles.backupTable}>
            <thead>
              <tr>
                <th>Backup File</th>
                <th>Date</th>
                <th>Size</th>
                <th style={{ textAlign: 'right' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {backups.map((b) => (
                <tr key={b.fileName}>
                  <td>{b.fileName}</td>
                  <td>{new Date(b.createdAt).toLocaleString()}</td>
                  <td>{Math.round(b.sizeBytes / 1024)} KB</td>
                  <td style={{ textAlign: 'right' }}>
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={backupLoading}
                      onClick={() => handleRestoreBackup(b.filePath)}
                    >
                      Restore
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}

export default DataManagementSettings;
