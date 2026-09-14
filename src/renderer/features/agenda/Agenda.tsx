import React, { useState } from 'react';
import { DailyAgenda } from './DailyAgenda.js';
import { WeeklyAgenda } from './WeeklyAgenda.js';
import { GoalsView } from './GoalsView.js';
import { HabitTracker } from './HabitTracker.js';
import styles from './Agenda.module.css';

export type AgendaSubView = 'daily' | 'weekly' | 'goals' | 'habits';

export function Agenda(): React.ReactElement {
  const [activeSubView, setActiveSubView] = useState<AgendaSubView>('daily');

  return (
    <div className={styles.container}>
      {/* Segmented Top Tab Bar */}
      <div className={styles.topTabBar}>
        <div className={styles.tabList} role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={activeSubView === 'daily'}
            className={`${styles.tabItem} ${activeSubView === 'daily' ? styles.tabItemActive : ''}`}
            onClick={() => setActiveSubView('daily')}
          >
            <span>📅</span>
            <span>Daily Agenda</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeSubView === 'weekly'}
            className={`${styles.tabItem} ${activeSubView === 'weekly' ? styles.tabItemActive : ''}`}
            onClick={() => setActiveSubView('weekly')}
          >
            <span>📆</span>
            <span>Weekly Agenda</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeSubView === 'goals'}
            className={`${styles.tabItem} ${activeSubView === 'goals' ? styles.tabItemActive : ''}`}
            onClick={() => setActiveSubView('goals')}
          >
            <span>🎯</span>
            <span>Goals</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeSubView === 'habits'}
            className={`${styles.tabItem} ${activeSubView === 'habits' ? styles.tabItemActive : ''}`}
            onClick={() => setActiveSubView('habits')}
          >
            <span>🔁</span>
            <span>Habits</span>
          </button>
        </div>
      </div>

      {/* Subview Content */}
      <div className={styles.viewContent}>
        {activeSubView === 'daily' && <DailyAgenda />}
        {activeSubView === 'weekly' && <WeeklyAgenda />}
        {activeSubView === 'goals' && <GoalsView />}
        {activeSubView === 'habits' && <HabitTracker />}
      </div>
    </div>
  );
}

export default Agenda;
