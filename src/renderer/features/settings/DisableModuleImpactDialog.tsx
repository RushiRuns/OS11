import React from 'react';
import { Button } from '../../components/Button/Button.js';
import styles from './DisableModuleImpactDialog.module.css';

interface DisableModuleImpactDialogProps {
  moduleName: string;
  taskCount: number;
  projectCount: number;
  onConfirm: () => void;
  onCancel: () => void;
}

export function DisableModuleImpactDialog({
  moduleName,
  taskCount,
  projectCount,
  onConfirm,
  onCancel,
}: DisableModuleImpactDialogProps): React.ReactElement {
  const getModuleNameDisplay = (name: string) => {
    switch (name) {
      case 'anytime':
        return 'Anytime';
      case 'someday':
        return 'Someday / Maybe';
      case 'waiting_for':
        return 'Waiting For';
      default:
        return name;
    }
  };

  const displayName = getModuleNameDisplay(moduleName);

  return (
    <div className={styles.overlay} onClick={onCancel} role="dialog" aria-modal="true" aria-labelledby="dialog-title">
      <div className={styles.dialog} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <div className={styles.warningIcon}>⚠️</div>
          <h3 id="dialog-title" className={styles.title}>
            Disable {displayName}?
          </h3>
        </div>

        <p className={styles.description}>
          You have{' '}
          <strong>
            {taskCount} {taskCount === 1 ? 'task' : 'tasks'}
            {projectCount > 0 ? ` and ${projectCount} ${projectCount === 1 ? 'project' : 'projects'}` : ''}
          </strong>{' '}
          currently categorized under {displayName}.
        </p>
        <p className={styles.subtext}>
          Disabling this module hides the view from the sidebar. Your data is preserved and will reappear if re-enabled.
        </p>

        <div className={styles.actions}>
          <Button variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
          <Button variant="primary" onClick={onConfirm}>
            Disable Module
          </Button>
        </div>
      </div>
    </div>
  );
}
