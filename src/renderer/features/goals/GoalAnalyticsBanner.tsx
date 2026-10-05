import React from 'react';
import type { GoalAnalyticsSummary } from '../../../shared/types/Goal.js';
import styles from './GoalAnalyticsBanner.module.css';

interface GoalAnalyticsBannerProps {
  summary: GoalAnalyticsSummary;
  onSelectCategoryFilter?: (category: string) => void;
  onFilterOverdue?: () => void;
}

export function GoalAnalyticsBanner({
  summary,
  onSelectCategoryFilter,
  onFilterOverdue,
}: GoalAnalyticsBannerProps): React.ReactElement {
  return (
    <div className={styles.bannerContainer}>
      <div className={styles.bannerHeader}>
        <h2 className={styles.bannerTitle}>
          <span>📊</span>
          <span>Goal Analytics & Performance</span>
        </h2>
        <span className={styles.bannerSubtitle}>
          Real-time execution velocity and domain progress
        </span>
      </div>

      {/* KPI Cards Grid */}
      <div className={styles.kpiGrid}>
        {/* Active Goals */}
        <div className={styles.kpiCard}>
          <span className={styles.kpiLabel}>
            <span>Active Goals</span>
            <span>🎯</span>
          </span>
          <div className={styles.kpiValueRow}>
            <span className={styles.kpiValue}>{summary.activeGoals}</span>
            <span className={styles.kpiSubtext}>/ {summary.totalGoals} total</span>
          </div>
        </div>

        {/* Overall In-Progress Health */}
        <div className={styles.kpiCard}>
          <span className={styles.kpiLabel}>
            <span>Active Progress</span>
            <span>📈</span>
          </span>
          <div className={styles.kpiValueRow}>
            <span className={styles.kpiValue}>{summary.overallActiveProgress}%</span>
            <span className={styles.kpiSubtext}>avg health</span>
          </div>
          <div className={styles.kpiProgressTrack}>
            <div
              className={styles.kpiProgressBar}
              style={{ width: `${summary.overallActiveProgress}%` }}
            />
          </div>
        </div>

        {/* Milestone Completion Rate */}
        <div className={styles.kpiCard}>
          <span className={styles.kpiLabel}>
            <span>Completion Rate</span>
            <span>🏆</span>
          </span>
          <div className={styles.kpiValueRow}>
            <span className={styles.kpiValue}>{summary.completionRate}%</span>
            <span className={styles.kpiSubtext}>{summary.completedGoals} completed</span>
          </div>
          <div className={styles.kpiProgressTrack}>
            <div
              className={styles.kpiProgressBar}
              style={{
                width: `${summary.completionRate}%`,
                backgroundColor: '#10b981',
              }}
            />
          </div>
        </div>

        {/* Habit Streaks */}
        <div className={styles.kpiCard}>
          <span className={styles.kpiLabel}>
            <span>Habit Streaks</span>
            <span>🔥</span>
          </span>
          <div className={styles.kpiValueRow}>
            <span className={styles.kpiValue}>{summary.topStreak}d</span>
            <span className={styles.kpiSubtext}>
              {summary.totalActiveStreaks > 0
                ? `${summary.totalActiveStreaks}d total`
                : 'best record'}
            </span>
          </div>
        </div>

        {/* Overdue / Needs Attention */}
        <div
          className={`${styles.kpiCard} ${summary.overdueCount > 0 ? styles.kpiCardOverdue : ''} ${
            onFilterOverdue ? styles.kpiCardClickable : ''
          }`}
          onClick={() => onFilterOverdue?.()}
          title={summary.overdueCount > 0 ? 'Click to show overdue goals' : undefined}
        >
          <span className={styles.kpiLabel}>
            <span>Needs Attention</span>
            <span>⚠️</span>
          </span>
          <div className={styles.kpiValueRow}>
            <span
              className={styles.kpiValue}
              style={summary.overdueCount > 0 ? { color: '#ef4444' } : undefined}
            >
              {summary.overdueCount}
            </span>
            <span className={styles.kpiSubtext}>
              {summary.overdueCount > 0 ? 'overdue milestones' : 'all on track'}
            </span>
          </div>
        </div>
      </div>

      {/* Category / Domain Breakdown */}
      {summary.categoryBreakdown.length > 0 && (
        <div className={styles.categorySection}>
          <span className={styles.categorySectionHeader}>Progress by Life Domain / Category</span>
          <div className={styles.categoryGrid}>
            {summary.categoryBreakdown.map((cat) => (
              <div
                key={cat.category}
                className={styles.categoryItem}
                onClick={() => onSelectCategoryFilter?.(cat.category)}
                title={`Filter by category "${cat.category}"`}
              >
                <div className={styles.categoryTitleRow}>
                  <span className={styles.categoryName}>🏷️ {cat.category}</span>
                  <span className={styles.categoryPercent}>{cat.avgProgress}%</span>
                </div>
                <div className={styles.kpiProgressTrack}>
                  <div
                    className={styles.kpiProgressBar}
                    style={{ width: `${cat.avgProgress}%` }}
                  />
                </div>
                <div className={styles.categoryMeta}>
                  <span>{cat.count} goal{cat.count !== 1 ? 's' : ''}</span>
                  {cat.completedCount > 0 && (
                    <span style={{ color: '#10b981' }}>{cat.completedCount} achieved</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default GoalAnalyticsBanner;
