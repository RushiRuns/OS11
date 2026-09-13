import React from 'react';
import { useAppStore } from '../../stores/app-store.js';
import { ScrollArea } from '../../components/primitives/ScrollArea/ScrollArea.js';
import styles from './Sidebar.module.css';

interface NavItem {
  id: string;
  label: string;
  icon: string;
  count?: number;
}

const SMART_LISTS: NavItem[] = [
  { id: 'smart_my_day', label: 'My Day', icon: '☀️' },
  { id: 'smart_important', label: 'Important', icon: '⭐' },
  { id: 'smart_planned', label: 'Planned', icon: '📅' },
  { id: 'smart_all', label: 'All Tasks', icon: '📋' },
  { id: 'smart_completed', label: 'Completed', icon: '✅' },
  { id: 'list_inbox', label: 'Inbox', icon: '📥' },
];

const VIEWS: NavItem[] = [
  { id: 'view_dashboard', label: 'Dashboard', icon: '📊' },
  { id: 'view_agenda', label: 'Agenda', icon: '📆' },
  { id: 'view_projects', label: 'Projects', icon: '📁' },
  { id: 'view_pomodoro', label: 'Pomodoro', icon: '⏱️' },
  { id: 'view_settings', label: 'Settings', icon: '⚙️' },
];

export function Sidebar(): React.ReactElement {
  const { activeListId, setActiveListId } = useAppStore();

  return (
    <aside className={styles.sidebar} aria-label="Application Sidebar">
      <ScrollArea orientation="vertical">
        <div className={styles.sectionLabel}>Lists</div>
        <nav className={styles.navList}>
          {SMART_LISTS.map(item => {
            const isActive = activeListId === item.id;
            return (
              <button
                key={item.id}
                type="button"
                className={`${styles.navItem} ${isActive ? styles.navItemActive : ''}`}
                onClick={() => setActiveListId(item.id)}
              >
                <span className={styles.navIcon}>{item.icon}</span>
                <span className={styles.navLabel}>{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className={styles.sectionLabel}>Views</div>
        <nav className={styles.navList}>
          {VIEWS.map(item => {
            const isActive = activeListId === item.id;
            return (
              <button
                key={item.id}
                type="button"
                className={`${styles.navItem} ${isActive ? styles.navItemActive : ''}`}
                onClick={() => setActiveListId(item.id)}
              >
                <span className={styles.navIcon}>{item.icon}</span>
                <span className={styles.navLabel}>{item.label}</span>
              </button>
            );
          })}
        </nav>
      </ScrollArea>
    </aside>
  );
}

export default Sidebar;
