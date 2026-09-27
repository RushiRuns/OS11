import React, { useState, lazy, Suspense } from 'react';
import type { TaskFilterConfig, SortOption, SortDirection } from '../../hooks/useFilteredTasks.js';
import { Button } from '../../components/Button/Button.js';
import { Tooltip } from '../../components/Tooltip/Tooltip.js';
import type { DropdownMenuItemConfig } from '../../components/primitives/DropdownMenu/DropdownMenu.js';
import styles from './TaskListHeader.module.css';

const DropdownMenu = lazy(() => import('../../components/primitives/DropdownMenu/DropdownMenu.js'));

export interface TaskListHeaderProps {
  title: string;
  count: number;
  filterConfig: TaskFilterConfig;
  onFilterChange: (config: TaskFilterConfig) => void;
  isMyDayList?: boolean;
  isSuggestionsOpen?: boolean;
  onToggleSuggestions?: () => void;
  suggestionsCount?: number;
}

export function TaskListHeader({
  title,
  count,
  filterConfig,
  onFilterChange,
  isMyDayList = false,
  isSuggestionsOpen = false,
  onToggleSuggestions,
  suggestionsCount,
}: TaskListHeaderProps): React.ReactElement {
  const [isFilterExpanded, setIsFilterExpanded] = useState(false);

  const menuItems: (DropdownMenuItemConfig | 'separator')[] = [
    {
      id: 'sort_by',
      label: 'Sort by',
      onClick: () => setIsFilterExpanded((prev) => !prev),
    },
    {
      id: 'filter',
      label: 'Filter',
      onClick: () => setIsFilterExpanded((prev) => !prev),
    },
    {
      id: 'group_by',
      label: 'Group by',
      onClick: () => {
        // Action stub for Group by
      },
    },
    'separator',
    {
      id: 'email_list',
      label: 'Email list',
      onClick: () => {
        // Action stub for Email list
      },
    },
    {
      id: 'display_completed',
      label: 'Display completed',
      onClick: () =>
        onFilterChange({
          ...filterConfig,
          incompleteOnly: !filterConfig.incompleteOnly,
        }),
    },
    {
      id: 'select_tasks',
      label: 'Select tasks',
      onClick: () => {
        // Action stub for Select tasks
      },
    },
    {
      id: 'save_template',
      label: 'Save as template',
      onClick: () => {
        // Action stub for Save as template
      },
    },
    'separator',
    {
      id: 'delete',
      label: 'Delete',
      danger: true,
      onClick: () => {
        // Action stub for Delete
      },
    },
  ];

  return (
    <div className={styles.headerContainer}>
      <div className={styles.topRow}>
        <h1 className={styles.title}>
          {title} <span style={{ fontSize: '16px', color: 'var(--text-tertiary)' }}>({count})</span>
        </h1>

        <div className={styles.headerControls}>
          {isMyDayList && (
            <Tooltip
              content={suggestionsCount ? `Suggestions (${suggestionsCount})` : 'Suggestions'}
              side="bottom"
            >
              <Button
                variant={isSuggestionsOpen ? 'primary' : 'ghost'}
                size="sm"
                className={styles.iconBtn}
                onClick={onToggleSuggestions}
                aria-label="Toggle suggestions"
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5" />
                  <path d="M9 18h6" />
                  <path d="M10 22h4" />
                </svg>
              </Button>
            </Tooltip>
          )}

          <Suspense
            fallback={
              <Button
                variant="ghost"
                size="sm"
                className={styles.iconBtn}
                aria-label="List options"
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
                  <circle cx="12" cy="12" r="1.75" />
                  <circle cx="19" cy="12" r="1.75" />
                  <circle cx="5" cy="12" r="1.75" />
                </svg>
              </Button>
            }
          >
            <DropdownMenu
              trigger={
                <Button
                  variant="ghost"
                  size="sm"
                  className={styles.iconBtn}
                  aria-label="List options"
                >
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                  >
                    <circle cx="12" cy="12" r="1.75" />
                    <circle cx="19" cy="12" r="1.75" />
                    <circle cx="5" cy="12" r="1.75" />
                  </svg>
                </Button>
              }
              items={menuItems}
              align="end"
            />
          </Suspense>
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
