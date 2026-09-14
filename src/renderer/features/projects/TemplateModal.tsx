import React, { useState } from 'react';
import type { Project, Section, Task, ProjectTemplate } from '@shared/types/index.js';
import { createProjectTemplate } from './projectExport.js';
import { useProjectStore } from '../../stores/projectStore.js';
import styles from './TemplateModal.module.css';

interface TemplateModalProps {
  project: Project;
  sections: Section[];
  tasks: Task[];
  onClose: () => void;
}

export function TemplateModal({
  project,
  sections,
  tasks,
  onClose,
}: TemplateModalProps): React.ReactElement {
  const { importTemplate } = useProjectStore();
  const currentTemplate = createProjectTemplate(project, sections, tasks);
  const [exportJson, setExportJson] = useState(JSON.stringify(currentTemplate, null, 2));
  const [importJson, setImportJson] = useState('');
  const [copied, setCopied] = useState(false);
  const [importStatus, setImportStatus] = useState<string | null>(null);

  const handleCopy = () => {
    navigator.clipboard.writeText(exportJson);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const blob = new Blob([exportJson], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${project.name.toLowerCase().replace(/[^a-z0-9]/g, '_')}_template.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleImport = async () => {
    try {
      const parsed = JSON.parse(importJson) as ProjectTemplate;
      if (!parsed.name || !Array.isArray(parsed.sections)) {
        throw new Error('Invalid template structure. Expected "name" and "sections" array.');
      }
      setImportStatus('Importing...');
      const created = await importTemplate(parsed);
      setImportStatus(`Successfully created project "${created.name}"!`);
      setTimeout(() => {
        onClose();
      }, 1200);
    } catch (err: unknown) {
      setImportStatus(`Error: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <h2 className={styles.title}>Project Templates</h2>
          <button type="button" className={styles.closeBtn} onClick={onClose}>
            ✕
          </button>
        </div>

        <div className={styles.body}>
          {/* Export Section */}
          <div className={styles.sectionBox}>
            <span className={styles.sectionTitle}>Export Current Project as Template</span>
            <p style={{ margin: 0, fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>
              Exports project structure (sections and placeholder tasks with priorities, stripped of dates and completion status).
            </p>
            <textarea
              className={styles.jsonArea}
              value={exportJson}
              onChange={(e) => setExportJson(e.target.value)}
              readOnly
            />
            <div className={styles.btnRow}>
              <button type="button" className={styles.secondaryBtn} onClick={handleCopy}>
                {copied ? '✓ Copied to Clipboard' : '📋 Copy JSON'}
              </button>
              <button type="button" className={styles.primaryBtn} onClick={handleDownload}>
                💾 Download Template JSON
              </button>
            </div>
          </div>

          <hr style={{ border: 'none', borderTop: '1px solid var(--border-subtle)', margin: 'var(--space-2) 0' }} />

          {/* Import Section */}
          <div className={styles.sectionBox}>
            <span className={styles.sectionTitle}>Import New Project from Template</span>
            <p style={{ margin: 0, fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>
              Paste a template JSON snippet below to instantiate a new structured project with sections and tasks.
            </p>
            <textarea
              className={styles.jsonArea}
              placeholder="Paste template JSON here..."
              value={importJson}
              onChange={(e) => setImportJson(e.target.value)}
            />
            <div className={styles.btnRow}>
              <button
                type="button"
                className={styles.primaryBtn}
                onClick={handleImport}
                disabled={!importJson.trim()}
              >
                🚀 Create Project from Template
              </button>
            </div>
            {importStatus && (
              <span
                style={{
                  fontSize: 'var(--text-xs)',
                  color: importStatus.startsWith('Error') ? 'var(--color-danger)' : 'var(--color-success)',
                }}
              >
                {importStatus}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default TemplateModal;
