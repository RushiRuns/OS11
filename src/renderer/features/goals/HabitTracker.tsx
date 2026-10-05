import React, { useMemo } from 'react';
import { useTaskStore } from '../../stores/taskStore.js';
import { useGoalStore } from '../../stores/goalStore.js';
import { useModuleStore } from '../../stores/moduleStore.js';
import { Checkbox } from '../../components/Checkbox/Checkbox.js';
import { EmptyState } from '../../components/EmptyState/EmptyState.js';
import styles from './HabitTracker.module.css';

export function HabitTracker(): React.ReactElement {
  const isEnabled = useModuleStore((state) => state.isEnabled('habit_tracker'));
  const toggleModule = useModuleStore((state) => state.toggleModule);

  const tasksById = useTaskStore((state) => state.tasksById);
  const toggleComplete = useTaskStore((state) => state.toggleComplete);

  const goalsById = useGoalStore((state) => state.goalsById);
  const habitLogsByGoalId = useGoalStore((state) => state.habitLogsByGoalId);
  const checkInHabit = useGoalStore((state) => state.checkInHabit);
  const getStreakStatus = useGoalStore((state) => state.getStreakStatus);

  // Filter tasks marked as habits
  const habitTasks = useMemo(() => {
    return Object.values(tasksById).filter((t) => t.is_habit === 1 && t.is_trashed === 0);
  }, [tasksById]);

  // Filter goals marked as habits
  const habitGoals = useMemo(() => {
    return Object.values(goalsById).filter(
      (g) => g.goal_type === 'habit' && g.status !== 'archived'
    );
  }, [goalsById]);

  // Generate 52 weeks (364 days) of date strings ending today, unifying tasks & goal logs
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

    // Include check-ins from goal_habit_logs
    for (const logs of Object.values(habitLogsByGoalId)) {
      for (const log of logs) {
        if (log.check_in_date) {
          const date = log.check_in_date.substring(0, 10);
          completionsByDate[date] = (completionsByDate[date] ?? 0) + 1;
        }
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
  }, [habitTasks, habitLogsByGoalId]);

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

      {/* Habit Goals & Streaks */}
      <section className={styles.chainSection}>
        <div className={styles.sectionHeader}>
          <span className={styles.sectionTitle}>
            <span>🎯 Habit Goals & Streaks</span>
            <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>
              ({habitGoals.length})
            </span>
          </span>
          <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>
            Daily goal check-ins and consistency streaks
          </span>
        </div>

        {habitGoals.length === 0 ? (
          <EmptyState
            icon="🎯"
            title="No Habit Goals Yet"
            description="Create a goal with type 'Habit' in the Goals view to track your long-term consistency and streaks here."
          />
        ) : (
          <div className={styles.habitGoalsGrid}>
            {habitGoals.map((goal) => {
              const streakStatus = getStreakStatus(goal.id);
              return (
                <div key={goal.id} className={styles.habitGoalCard}>
                  <div className={styles.habitGoalTop}>
                    <div className={styles.habitGoalInfo}>
                      <h3 className={styles.habitGoalTitle}>{goal.title}</h3>
                      {goal.category && (
                        <span className={styles.categoryBadge}>🏷️ {goal.category}</span>
                      )}
                    </div>
                    {streakStatus.health === 'completed_today' && (
                      <span className={styles.streakBadgeCompleted}>
                        🔥 {streakStatus.currentStreak}d Streak
                      </span>
                    )}
                    {streakStatus.health === 'due_today' && (
                      <span className={styles.streakBadgeDue}>
                        ⏳ {streakStatus.currentStreak}d Due
                      </span>
                    )}
                    {streakStatus.health === 'broken' && (
                      <span className={styles.streakBadgeBroken}>
                        ⚠️ Broken (Best: {streakStatus.longestStreak}d)
                      </span>
                    )}
                    {streakStatus.health === 'inactive' && (
                      <span className={styles.streakBadgeInactive}>💤 Inactive</span>
                    )}
                  </div>

                  {/* 7-Day Mini Track */}
                  <div className={styles.recentDaysStrip}>
                    {streakStatus.recentDays.map((d) => (
                      <div
                        key={d.date}
                        className={`${styles.dayDot} ${d.checked ? styles.dayDotChecked : ''} ${d.isToday ? styles.dayDotToday : ''}`}
                        title={`${d.date} (${d.dayLabel}): ${d.checked ? 'Checked in' : 'Missed'}${d.isToday ? ' (Today)' : ''}`}
                      >
                        <span className={styles.dayDotLabel}>{d.dayLabel}</span>
                        <span className={styles.dayDotIndicator}>{d.checked ? '✓' : '·'}</span>
                      </div>
                    ))}
                  </div>

                  <div className={styles.habitGoalBottom}>
                    <span className={styles.bestStreakText}>
                      Best Streak: <strong>{streakStatus.longestStreak}d</strong>
                    </span>
                    <button
                      type="button"
                      className={`${styles.checkInBtn} ${streakStatus.checkedInToday ? styles.checkInBtnDone : ''}`}
                      onClick={() => checkInHabit(goal.id)}
                      title={streakStatus.checkedInToday ? 'Checked in today! Click to undo' : 'Check in for today'}
                    >
                      {streakStatus.checkedInToday
                        ? '✓ Done Today'
                        : streakStatus.health === 'broken'
                          ? '+ Restart Streak'
                          : '+ Check In Today'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Habit Chain View */}
      <section className={styles.chainSection}>
        <div className={styles.sectionHeader}>
          <span className={styles.sectionTitle}>
            <span>🔗 Active Habit Tasks</span>
            <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>
              ({habitTasks.length})
            </span>
          </span>
          <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>
            Check off today&apos;s habit tasks to extend your streak
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
            <span>📊 52-Week Habit Heatmap (Tasks & Goals)</span>
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
