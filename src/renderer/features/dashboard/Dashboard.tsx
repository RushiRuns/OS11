import React, { useState, useEffect, useCallback } from 'react';
import styles from './Dashboard.module.css';
import { ipc } from '../../services/ipc.js';
import { IPC } from '@shared/ipc-channels.js';
import type {
  PersonalStats,
  ProductiveDayStat,
  ProductiveHourStat,
  CompletionDayStat,
  DistributionStat,
  Project,
  DateRangePreset,
} from '@shared/types/index.js';

import { CompletionBarChart } from './charts/CompletionBarChart.js';
import { TaskDistributionPie } from './charts/TaskDistributionPie.js';
import { CompletionTrend } from './charts/CompletionTrend.js';
import { ActivityHeatmap } from './charts/ActivityHeatmap.js';
import { ProjectBurndown } from './charts/ProjectBurndown.js';

export function Dashboard(): React.ReactElement {
  const [range, setRange] = useState<DateRangePreset>('30d');
  const [loading, setLoading] = useState<boolean>(true);

  const [personalStats, setPersonalStats] = useState<PersonalStats | null>(null);
  const [productiveDay, setProductiveDay] = useState<ProductiveDayStat | null>(null);
  const [productiveHour, setProductiveHour] = useState<ProductiveHourStat | null>(null);
  const [completions, setCompletions] = useState<CompletionDayStat[]>([]);
  const [yearCompletions, setYearCompletions] = useState<CompletionDayStat[]>([]);
  const [byList, setByList] = useState<DistributionStat[]>([]);
  const [byTag, setByTag] = useState<DistributionStat[]>([]);
  const [byPriority, setByPriority] = useState<DistributionStat[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);

  const [exportingPdf, setExportingPdf] = useState(false);
  const [exportingCsv, setExportingCsv] = useState(false);
  const [exportMessage, setExportMessage] = useState<string | null>(null);

  // Compute date range from preset
  const getDateBounds = useCallback((preset: DateRangePreset): { from?: string; to?: string } => {
    const today = new Date();
    const to = today.toISOString().slice(0, 10);

    if (preset === '7d') {
      const fromDate = new Date(today);
      fromDate.setDate(today.getDate() - 6);
      return { from: fromDate.toISOString().slice(0, 10), to };
    }
    if (preset === '30d') {
      const fromDate = new Date(today);
      fromDate.setDate(today.getDate() - 29);
      return { from: fromDate.toISOString().slice(0, 10), to };
    }
    if (preset === '90d') {
      const fromDate = new Date(today);
      fromDate.setDate(today.getDate() - 89);
      return { from: fromDate.toISOString().slice(0, 10), to };
    }
    return {};
  }, []);

  const fetchDashboardData = useCallback(async (preset: DateRangePreset) => {
    setLoading(true);
    const { from, to } = getDateBounds(preset);

    const oneYearAgo = new Date();
    oneYearAgo.setDate(oneYearAgo.getDate() - 364);
    const yearFrom = oneYearAgo.toISOString().slice(0, 10);
    const yearTo = new Date().toISOString().slice(0, 10);

    try {
      const [
        statsRes,
        dayRes,
        hourRes,
        compRes,
        yearCompRes,
        listRes,
        tagRes,
        priorityRes,
        projectsRes,
      ] = await Promise.all([
        ipc.invoke<PersonalStats>(IPC.ANALYTICS.GET_PERSONAL_STATS, { from, to }),
        ipc.invoke<ProductiveDayStat>(IPC.ANALYTICS.GET_PRODUCTIVE_DAY),
        ipc.invoke<ProductiveHourStat>(IPC.ANALYTICS.GET_PRODUCTIVE_HOUR),
        ipc.invoke<CompletionDayStat[]>(IPC.ANALYTICS.GET_COMPLETIONS_BY_DAY, { from, to }),
        ipc.invoke<CompletionDayStat[]>(IPC.ANALYTICS.GET_COMPLETIONS_BY_DAY, { from: yearFrom, to: yearTo }),
        ipc.invoke<DistributionStat[]>(IPC.ANALYTICS.GET_TASKS_BY_LIST),
        ipc.invoke<DistributionStat[]>(IPC.ANALYTICS.GET_TASKS_BY_TAG),
        ipc.invoke<DistributionStat[]>(IPC.ANALYTICS.GET_TASKS_BY_PRIORITY),
        ipc.invoke<Project[]>(IPC.PROJECTS.GET_ALL).catch(() => []),
      ]);

      setPersonalStats(statsRes);
      setProductiveDay(dayRes);
      setProductiveHour(hourRes);
      setCompletions(compRes);
      setYearCompletions(yearCompRes);
      setByList(listRes);
      setByTag(tagRes);
      setByPriority(priorityRes);
      setProjects(projectsRes);
    } catch (err) {
      console.error('Failed to fetch dashboard data', err);
    } finally {
      setLoading(false);
    }
  }, [getDateBounds]);

  useEffect(() => {
    fetchDashboardData(range);
  }, [range, fetchDashboardData]);

  const handleExportPdf = async () => {
    setExportingPdf(true);
    setExportMessage(null);
    try {
      const res = await ipc.invoke<{ saved?: boolean; filePath?: string; canceled?: boolean }>(
        IPC.ANALYTICS.EXPORT_PDF
      );
      if (res.saved && res.filePath) {
        setExportMessage('PDF saved successfully');
      }
    } catch (err) {
      console.error('PDF export failed', err);
      setExportMessage('PDF export failed');
    } finally {
      setExportingPdf(false);
      setTimeout(() => setExportMessage(null), 4000);
    }
  };

  const handleExportCsv = async () => {
    setExportingCsv(true);
    setExportMessage(null);
    const { from, to } = getDateBounds(range);
    try {
      const res = await ipc.invoke<{ saved?: boolean; filePath?: string; canceled?: boolean }>(
        IPC.ANALYTICS.EXPORT_CSV,
        { from, to }
      );
      if (res.saved && res.filePath) {
        setExportMessage('CSV saved successfully');
      }
    } catch (err) {
      console.error('CSV export failed', err);
      setExportMessage('CSV export failed');
    } finally {
      setExportingCsv(false);
      setTimeout(() => setExportMessage(null), 4000);
    }
  };

  return (
    <div className={styles.container}>
      {/* Top Header */}
      <header className={styles.header}>
        <div className={styles.titleGroup}>
          <h1 className={styles.title}>Dashboard & Statistics</h1>
          <p className={styles.subtitle}>
            Performance metrics, task throughput, and completion velocity
          </p>
        </div>

        <div className={styles.actions}>
          {exportMessage && (
            <span
              style={{
                fontSize: 'var(--text-xs)',
                color: 'var(--color-success)',
                fontWeight: 'var(--weight-medium)',
              }}
            >
              {exportMessage}
            </span>
          )}

          {/* Date Range Selector */}
          <div className={styles.rangeSelector} role="radiogroup" aria-label="Date range">
            <button
              type="button"
              className={`${styles.rangeBtn} ${range === '7d' ? styles.rangeBtnActive : ''}`}
              onClick={() => setRange('7d')}
            >
              Last 7 days
            </button>
            <button
              type="button"
              className={`${styles.rangeBtn} ${range === '30d' ? styles.rangeBtnActive : ''}`}
              onClick={() => setRange('30d')}
            >
              Last 30 days
            </button>
            <button
              type="button"
              className={`${styles.rangeBtn} ${range === '90d' ? styles.rangeBtnActive : ''}`}
              onClick={() => setRange('90d')}
            >
              Last 3 months
            </button>
            <button
              type="button"
              className={`${styles.rangeBtn} ${range === 'all' ? styles.rangeBtnActive : ''}`}
              onClick={() => setRange('all')}
            >
              All time
            </button>
          </div>

          {/* Export Buttons */}
          <button
            type="button"
            className={styles.exportBtn}
            onClick={handleExportPdf}
            disabled={exportingPdf}
            title="Export Dashboard as PDF"
          >
            <span>📄</span>
            <span>{exportingPdf ? 'Exporting...' : 'PDF'}</span>
          </button>

          <button
            type="button"
            className={styles.exportBtn}
            onClick={handleExportCsv}
            disabled={exportingCsv}
            title="Export Statistics as CSV"
          >
            <span>📊</span>
            <span>{exportingCsv ? 'Exporting...' : 'CSV'}</span>
          </button>
        </div>
      </header>

      {/* 4 Hero Stat Cards */}
      <section className={styles.statsGrid}>
        {loading ? (
          <>
            <div className={styles.skeletonStat} />
            <div className={styles.skeletonStat} />
            <div className={styles.skeletonStat} />
            <div className={styles.skeletonStat} />
          </>
        ) : (
          <>
            {/* Card 1: Completed Today */}
            <div className={styles.statCard}>
              <div className={styles.statHeader}>
                <span className={styles.statLabel}>Completed Today</span>
                <span className={styles.statIcon}>✅</span>
              </div>
              <div className={styles.statValue}>
                {personalStats?.tasksToday ?? 0}
              </div>
              <div className={styles.statMeta}>
                <span>{personalStats?.completedCount ?? 0} total in range</span>
              </div>
            </div>

            {/* Card 2: Current Streak */}
            <div className={styles.statCard}>
              <div className={styles.statHeader}>
                <span className={styles.statLabel}>Current Streak</span>
                <span className={styles.statIcon}>🔥</span>
              </div>
              <div className={styles.statValue} style={{ color: 'var(--color-warning)' }}>
                {personalStats?.streak ?? 0}d
              </div>
              <div className={styles.statMeta}>
                <span>Consecutive days active</span>
              </div>
            </div>

            {/* Card 3: On-Time Rate */}
            <div className={styles.statCard}>
              <div className={styles.statHeader}>
                <span className={styles.statLabel}>On-Time Rate</span>
                <span className={styles.statIcon}>🎯</span>
              </div>
              <div className={styles.statValue} style={{ color: 'var(--color-success)' }}>
                {personalStats?.onTimeRate ?? 100}%
              </div>
              <div className={styles.statMeta}>
                <span>Avg {personalStats?.avgCompletionHours ?? 0}h to complete</span>
              </div>
            </div>

            {/* Card 4: Focus Time */}
            <div className={styles.statCard}>
              <div className={styles.statHeader}>
                <span className={styles.statLabel}>Total Focus Time</span>
                <span className={styles.statIcon}>🍅</span>
              </div>
              <div className={styles.statValue} style={{ color: 'var(--accent)' }}>
                {personalStats?.totalFocusMinutes ?? 0}m
              </div>
              <div className={styles.statMeta}>
                <span>Completed pomodoro focus</span>
              </div>
            </div>
          </>
        )}
      </section>

      {/* Secondary micro-highlights strip */}
      {!loading && (productiveDay || productiveHour) && (
        <section className={styles.microHighlights}>
          {productiveDay && (
            <div className={styles.highlightItem}>
              <span>📅 Most Productive Day:</span>
              <span className={styles.highlightValue}>
                {productiveDay.dayName} ({productiveDay.count} tasks completed)
              </span>
            </div>
          )}
          {productiveHour && (
            <div className={styles.highlightItem}>
              <span>⏰ Peak Focus Hour:</span>
              <span className={styles.highlightValue}>
                {productiveHour.formattedHour} ({productiveHour.count} tasks completed)
              </span>
            </div>
          )}
        </section>
      )}

      {/* 5 Charts below stat cards in strict order */}
      <section className={styles.chartsFlow}>
        {loading ? (
          <>
            <div className={styles.skeletonCard} />
            <div className={styles.skeletonCard} />
            <div className={styles.skeletonCard} />
            <div className={styles.skeletonCard} />
          </>
        ) : (
          <>
            {/* Chart 1: Completion Bar */}
            <CompletionBarChart data={completions} />

            {/* Chart 2: Task Distribution */}
            <TaskDistributionPie byList={byList} byTag={byTag} byPriority={byPriority} />

            {/* Chart 3: Completion Trend */}
            <CompletionTrend data={completions} />

            {/* Chart 4: Activity Heatmap */}
            <ActivityHeatmap completions={yearCompletions} />

            {/* Chart 5: Project Burndown */}
            <ProjectBurndown projects={projects} />
          </>
        )}
      </section>
    </div>
  );
}

export default Dashboard;
