import React, { useState } from 'react';
import type { TaskFilterConfig, SortOption, SortDirection } from '../../hooks/useFilteredTasks.js';
import styles from './TaskListHeader.module.css';

export interface TaskListHeaderProps {
  title: string;
  count: number;
  filterConfig: TaskFilterConfig;
  onFilterChange: (config: TaskFilterConfig) => void;
}

export function TaskListHeader({
  title,
  count,
  filterConfig,
  onFilterChange,
}: TaskListHeaderProps): React.ReactElement {
  const [isFilterExpanded, setIsFilterExpanded] = useState(false);

  const hasActiveFilters =
    filterConfig.sortBy !== 'manual' ||
    filterConfig.priorityFilter !== null ||
    filterConfig.incompleteOnly ||
    filterConfig.starredOnly;

  return (
    <div className={styles.headerContainer}>
      <div className={styles.topRow}>
        <h1 className={styles.title}>
          {title} <span style={{ fontSize: '16px', color: 'var(--text-tertiary)' }}>({count})</span>
        </h1>

        <div className={styles.headerControls}>
          <button
            type="button"
            className={`${styles.filterToggleBtn} ${
              hasActiveFilters || isFilterExpanded ? styles.filterToggleBtnActive : ''
            }`}
            onClick={() => setIsFilterExpanded(!isFilterExpanded)}
            aria-expanded={isFilterExpanded}
          >
            <span>⚡ Filters</span>
            {hasActiveFilters && <span style={{ color: 'var(--color-accent-blue)' }}>•</span>}
          </button>
        </div>
      </div>

      {isFilterExpanded && (
        <div className={styles.filterBar}>
          {/* Sort Option */}
          <div className={styles.filterGroup}>
            <label>Sort:</label>
            <select
              className={styles.filterSelect}
              value={filterConfig.sortBy}
              onChange={(e) =>
                onFilterChange({
                  ...filterConfig,
                  sortBy: e.target.value as SortOption,
                })
              }
            >
              <option value="manual">Manual (Default)</option>
              <option value="due_date">Due Date</option>
              <option value="priority">Priority</option>
              <option value="alphabetical">Title (A-Z)</option>
              <option value="created_at">Created Date</option>
            </select>

            <select
              className={styles.filterSelect}
              value={filterConfig.sortDirection}
              onChange={(e) =>
                onFilterChange({
                  ...filterConfig,
                  sortDirection: e.target.value as SortDirection,
                })
              }
            >
              <option value="asc">Asc</option>
              <option value="desc">Desc</option>
            </select>
          </div>

          {/* Priority Filter */}
          <div className={styles.filterGroup}>
            <label>Priority:</label>
            <select
              className={styles.filterSelect}
              value={filterConfig.priorityFilter === null ? '' : filterConfig.priorityFilter}
              onChange={(e) =>
                onFilterChange({
                  ...filterConfig,
                  priorityFilter: e.target.value === '' ? null : Number(e.target.value),
                })
              }
            >
              <option value="">All Priorities</option>
              <option value="4">Critical (P4)</option>
              <option value="3">High (P3)</option>
              <option value="2">Medium (P2)</option>
              <option value="1">Low (P1)</option>
              <option value="0">None (P0)</option>
            </select>
          </div>

          {/* Incomplete Only Checkbox */}
          <label className={styles.filterCheckboxLabel}>
            <input
              type="checkbox"
              checked={filterConfig.incompleteOnly}
              onChange={(e) =>
                onFilterChange({
                  ...filterConfig,
                  incompleteOnly: e.target.checked,
                })
              }
            />
            <span>Incomplete only</span>
          </label>

          {/* Starred Only Checkbox */}
          <label className={styles.filterCheckboxLabel}>
            <input
              type="checkbox"
              checked={filterConfig.starredOnly}
              onChange={(e) =>
                onFilterChange({
                  ...filterConfig,
                  starredOnly: e.target.checked,
                })
              }
            />
            <span>Starred ★ only</span>
          </label>
        </div>
      )}
    </div>
  );
}

export default TaskListHeader;
