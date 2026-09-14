import React from 'react';
import styles from './ViewSwitcher.module.css';

export type ProjectViewMode = 'list' | 'board' | 'timeline' | 'calendar' | 'table';

interface ViewOption {
  id: ProjectViewMode;
  label: string;
  icon: string;
}

const VIEW_OPTIONS: ViewOption[] = [
  { id: 'list', label: 'List', icon: '☰' },
  { id: 'board', label: 'Board', icon: '▦' },
  { id: 'timeline', label: 'Timeline', icon: '⫿' },
  { id: 'calendar', label: 'Calendar', icon: '📅' },
  { id: 'table', label: 'Table', icon: '⊞' },
];

interface ViewSwitcherProps {
  currentView: ProjectViewMode;
  onViewChange: (view: ProjectViewMode) => void;
}

export function ViewSwitcher({ currentView, onViewChange }: ViewSwitcherProps): React.ReactElement {
  return (
    <div className={styles.switcherContainer} role="tablist" aria-label="Project View Switcher">
      {VIEW_OPTIONS.map((opt) => {
        const isActive = currentView === opt.id;
        return (
          <button
            key={opt.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            className={`${styles.viewButton} ${isActive ? styles.viewButtonActive : ''}`}
            onClick={() => onViewChange(opt.id)}
          >
            <span className={styles.icon}>{opt.icon}</span>
            <span>{opt.label}</span>
          </button>
        );
      })}
    </div>
  );
}

export default ViewSwitcher;
