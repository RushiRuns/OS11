import React, { useMemo } from 'react';
import { useTaskStore } from '../../stores/taskStore.js';
import { useModuleStore } from '../../stores/moduleStore.js';
import { Checkbox } from '../../components/Checkbox/Checkbox.js';
import { EmptyState } from '../../components/EmptyState/EmptyState.js';
import styles from './HabitTracker.module.css';

export function HabitTracker(): React.ReactElement {
  const isEnabled = useModuleStore((state) => state.isEnabled('habit_tracker'));
  const toggleModule = useModuleStore((state) => state.toggleModule);

  const tasksById = useTaskStore((state) => state.tasksById);
  const toggleComplete = useTaskStore((state) => state.toggleComplete);

  // Filter tasks marked as habits
  const habitTasks = useMemo(() => {
    return Object.values(tasksById).filter((t) => t.is_habit === 1 && t.is_trashed === 0);
  }, [tasksById]);

  // Generate 52 weeks (364 days) of date strings ending today
  const heatmapDays = useMemo(() => {
    const days: Array<{ dateStr: string; count: number }> = [];
    const today = new Date();

    // Map completions by date
    const completionsByDate: Record<string, number> = {};
    for (const task of habitTasks) {
      if (task.completed_at) {
        const date = task.completed_at.substring(0, 10);
        completionsByDate[date] = (completionsByDate[date] ?? 0) + 1;
      }
    }

    // 52 weeks * 7 days = 364 days
    for (let i = 363; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      days.push({
        dateStr,
        count: completionsByDate[dateStr] ?? 0,
      });
    }

    return days;
  }, [habitTasks]);

  if (!isEnabled) {
    return (
      <div className={styles.container}>
        <div className={styles.enableBanner}>
          <span className={styles.enableIcon}>🔁</span>
          <h2 className={styles.enableTitle}>Habit Tracker Module Disabled</h2>
          <p className={styles.enableDesc}>
            Enable the Habit Tracker to mark tasks as recurring daily habits, build momentum chains, and view your 52-week consistency heatmap.
          </p>
          <button
            type="button"
            className={styles.enableBtn}
            onClick={() => toggleModule('habit_tracker', true)}
          >
            Enable Habit Tracker
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.headerRow}>
        <div className={styles.titleWrap}>
          <h1 className={styles.title}>Habit Tracker & Chains</h1>
          <p className={styles.subtitle}>
            Build daily consistency, visualize streaks, and track year-long execution
          </p>
        </div>
      </div>

      {/* Habit Chain View */}
      <section className={styles.chainSection}>
        <div className={styles.sectionHeader}>
          <span className={styles.sectionTitle}>
            <span>🔗 Active Habit Chains</span>
            <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>
              ({habitTasks.length})
            </span>
          </span>
          <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>
            Check off today&apos;s habits to extend your streak
          </span>
        </div>

        {habitTasks.length === 0 ? (
          <EmptyState
            icon="🌱"
            title="No Habits Yet"
            description="Open any task in the Task Detail panel and toggle 'Mark as Habit' to track it here."
          />
        ) : (
          <div className={styles.habitChainList}>
            {habitTasks.map((task) => {
              const isChecked = task.is_completed === 1;

              return (
                <div
                  key={task.id}
                  className={`${styles.habitCard} ${isChecked ? styles.habitCardChecked : ''}`}
                >
                  <div className={styles.habitCardLeft}>
                    <Checkbox
                      checked={isChecked}
                      onChange={() => toggleComplete(task.id)}
                    />
                    <span
                      className={styles.habitTitle}
                      style={{
                        textDecoration: isChecked ? 'line-through' : 'none',
                      }}
                      title={task.title}
                    >
                      {task.title}
                    </span>
                  </div>

                  {isChecked ? (
                    <span style={{ fontSize: '11px', color: '#10b981', fontWeight: 600 }}>
                      ✓ Done
                    </span>
                  ) : (
                    <span style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>
                      Pending
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* GitHub-style Heatmap Section */}
      <section className={styles.heatmapSection}>
        <div className={styles.sectionHeader}>
          <span className={styles.sectionTitle}>
            <span>📊 52-Week Habit Heatmap</span>
          </span>
          <div className={styles.heatmapLegend}>
            <span>Less</span>
            <div className={styles.legendCells}>
              <span className={`${styles.cell} ${styles.level0}`} />
              <span className={`${styles.cell} ${styles.level1}`} />
              <span className={`${styles.cell} ${styles.level2}`} />
              <span className={`${styles.cell} ${styles.level3}`} />
              <span className={`${styles.cell} ${styles.level4}`} />
            </div>
            <span>More</span>
          </div>
        </div>

        <div className={styles.heatmapContainer}>
          <div className={styles.heatmapGrid}>
            {heatmapDays.map(({ dateStr, count }) => {
              const level =
                count === 0
                  ? styles.level0
                  : count === 1
                    ? styles.level1
                    : count === 2
                      ? styles.level2
                      : count === 3
                        ? styles.level3
                        : styles.level4;

              return (
                <div
                  key={dateStr}
                  className={`${styles.cell} ${level}`}
                  title={`${dateStr}: ${count} habit${count !== 1 ? 's' : ''} completed`}
                />
              );
            })}
          </div>
        </div>
      </section>
    </div>
  );
}

export default HabitTracker;
