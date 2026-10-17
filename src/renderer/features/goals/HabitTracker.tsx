import React, { useMemo } from 'react';
import { useTaskStore } from '../../stores/taskStore.js';
import { useOkrStore } from '../../stores/okrStore.js';
import { useModuleStore } from '../../stores/moduleStore.js';
import { useOkrMetrics } from '../../hooks/useOkrMetrics.js';
import { useToday } from '../../hooks/useToday.js';
import { addDays } from '@shared/utils/okr.js';
import { Checkbox } from '../../components/Checkbox/Checkbox.js';
import { EmptyState } from '../../components/EmptyState/EmptyState.js';
import styles from './HabitTracker.module.css';

export function HabitTracker(): React.ReactElement {
  const isEnabled = useModuleStore((state) => state.isEnabled('habit_tracker'));
  const toggleModule = useModuleStore((state) => state.toggleModule);

  const todayStr = useToday();
  const metrics = useOkrMetrics(todayStr);

  const tasksById = useTaskStore((state) => state.tasksById);
  const toggleComplete = useTaskStore((state) => state.toggleComplete);

  const keyResultsById = useOkrStore((s) => s.keyResultsById);
  const objectivesById = useOkrStore((s) => s.objectivesById);
  const habitLogsByKeyResultId = useOkrStore((s) => s.habitLogsByKeyResultId);
  const toggleHabitLog = useOkrStore((s) => s.toggleHabitLog);

  // Filter tasks marked as habits
  const habitTasks = useMemo(() => {
    return Object.values(tasksById).filter((t) => t.is_habit === 1 && t.is_trashed === 0);
  }, [tasksById]);

  // Filter key results marked as habits
  const habitKeyResults = useMemo(() => {
    return Object.values(keyResultsById).filter(
      (kr) => kr.kind === 'habit' && objectivesById[kr.objective_id]?.status !== 'archived'
    );
  }, [keyResultsById, objectivesById]);

  // Generate 52 weeks (364 days) of date strings ending today, unifying tasks & habit logs
  const heatmapDays = useMemo(() => {
    const days: Array<{ dateStr: string; count: number }> = [];

    // Map completions by date
    const completionsByDate: Record<string, number> = {};
    for (const task of habitTasks) {
      if (task.completed_at) {
        const date = task.completed_at.substring(0, 10);
        completionsByDate[date] = (completionsByDate[date] ?? 0) + 1;
      }
    }

    // Include check-ins from kr_habit_logs
    for (const logs of Object.values(habitLogsByKeyResultId)) {
      for (const log of logs) {
        if (log.log_date) {
          const date = log.log_date.substring(0, 10);
          completionsByDate[date] = (completionsByDate[date] ?? 0) + 1;
        }
      }
    }

    // 52 weeks * 7 days = 364 days ending today
    for (let i = 363; i >= 0; i--) {
      const dateStr = addDays(todayStr, -i);
      days.push({
        dateStr,
        count: completionsByDate[dateStr] ?? 0,
      });
    }

    return days;
  }, [habitTasks, habitLogsByKeyResultId, todayStr]);

  // Recent 7 days helper
  const recent7Days = useMemo(() => {
    const days: Array<{ dateStr: string; dayLabel: string; isToday: boolean }> = [];
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    for (let i = 6; i >= 0; i--) {
      const dateStr = addDays(todayStr, -i);
      const [y, m, d] = dateStr.split('-').map(Number);
      const dayDate = new Date(y, m - 1, d);
      days.push({
        dateStr,
        dayLabel: dayNames[dayDate.getDay()],
        isToday: dateStr === todayStr,
      });
    }
    return days;
  }, [todayStr]);

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

      {/* Habit Key Results & Streaks */}
      <section className={styles.chainSection}>
        <div className={styles.sectionHeader}>
          <span className={styles.sectionTitle}>
            <span>🎯 Habit Key Results & Streaks</span>
            <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>
              ({habitKeyResults.length})
            </span>
          </span>
          <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>
            Daily goal check-ins and consistency streaks
          </span>
        </div>

        {habitKeyResults.length === 0 ? (
          <EmptyState
            icon="🎯"
            title="No Habit Key Results Yet"
            description="Add a key result of kind 'Habit' to a goal in the Goals view to track your long-term consistency and streaks here."
          />
        ) : (
          <div className={styles.habitGoalsGrid}>
            {habitKeyResults.map((kr) => {
              const habitStat = metrics.habitStatsMap.get(kr.id);
              const parentObj = objectivesById[kr.objective_id];
              const logs = habitLogsByKeyResultId[kr.id] || [];
              const checkedInToday = logs.some((l) => l.log_date === todayStr);
              const streak = habitStat?.weekStreak ?? 0;

              return (
                <div key={kr.id} className={styles.habitGoalCard}>
                  <div className={styles.habitGoalTop}>
                    <div className={styles.habitGoalInfo}>
                      <h3 className={styles.habitGoalTitle}>{kr.title}</h3>
                      {parentObj && (
                        <span className={styles.categoryBadge}>🎯 {parentObj.title}</span>
                      )}
                    </div>
                    {checkedInToday ? (
                      <span className={styles.streakBadgeCompleted}>
                        🔥 {streak}w Streak
                      </span>
                    ) : (
                      <span className={styles.streakBadgeDue}>
                        ⏳ {streak}w Streak
                      </span>
                    )}
                  </div>

                  {/* 7-Day Mini Track */}
                  <div className={styles.recentDaysStrip}>
                    {recent7Days.map((d) => {
                      const checked = logs.some((l) => l.log_date === d.dateStr);
                      return (
                        <div
                          key={d.dateStr}
                          className={`${styles.dayDot} ${checked ? styles.dayDotChecked : ''} ${d.isToday ? styles.dayDotToday : ''}`}
                          title={`${d.dateStr} (${d.dayLabel}): ${checked ? 'Checked in' : 'Missed'}${d.isToday ? ' (Today)' : ''}`}
                        >
                          <span className={styles.dayDotLabel}>{d.dayLabel}</span>
                          <span className={styles.dayDotIndicator}>{checked ? '✓' : '·'}</span>
                        </div>
                      );
                    })}
                  </div>

                  <div className={styles.habitGoalBottom}>
                    <span className={styles.bestStreakText}>
                      This week: <strong>{habitStat?.weekCount ?? 0}/{kr.target_value ?? 7}d</strong>
                    </span>
                    <button
                      type="button"
                      className={`${styles.checkInBtn} ${checkedInToday ? styles.checkInBtnDone : ''}`}
                      onClick={() => toggleHabitLog(kr.id, todayStr)}
                      title={checkedInToday ? 'Checked in today! Click to undo' : 'Check in for today'}
                    >
                      {checkedInToday ? '✓ Done Today' : '+ Check In Today'}
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
