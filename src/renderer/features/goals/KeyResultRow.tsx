import React, { useState } from 'react';
import type { KeyResult, KRCheckIn } from '@shared/types/KeyResult.js';
import { ProgressRing } from './ProgressRing.js';
import { WorkPickerPopover } from './WorkPickerPopover.js';
import { KeyResultModal } from './KeyResultModal.js';
import { DropdownMenu, type DropdownMenuItemConfig } from '../../components/primitives/DropdownMenu/DropdownMenu.js';
import { formatDueLabel } from '../tasks/due-label.js';
import { useOkrStore } from '../../stores/okrStore.js';
import { useTaskStore } from '../../stores/taskStore.js';
import { useProjectStore } from '../../stores/projectStore.js';
import { useOkrMetrics } from '../../hooks/useOkrMetrics.js';
import { useToday } from '../../hooks/useToday.js';
import styles from './KeyResultRow.module.css';

function Sparkline({ entries }: { entries: KRCheckIn[] }) {
  if (entries.length < 2) return null;
  // Chronological order: oldest to newest
  const sorted = [...entries].sort((a, b) => a.checked_in_on.localeCompare(b.checked_in_on));
  const values = sorted
    .map((e) => e.value)
    .filter((v): v is number => v !== null && typeof v === 'number' && !isNaN(v));
  if (values.length < 2) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const width = 120;
  const height = 24;
  const pad = 3;
  const points = values
    .map((v, i) => {
      const x = pad + (i / (values.length - 1)) * (width - pad * 2);
      const y = height - pad - ((v - min) / range) * (height - pad * 2);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className={styles.sparkline}>
      <polyline
        fill="none"
        stroke="var(--accent)"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points}
      />
    </svg>
  );
}

export interface KeyResultRowProps {
  keyResult: KeyResult;
}

export const KeyResultRow: React.FC<KeyResultRowProps> = ({ keyResult }) => {
  const [expanded, setExpanded] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [quickValue, setQuickValue] = useState('');

  const todayStr = useToday();
  const metrics = useOkrMetrics(todayStr);

  const updateKeyResult = useOkrStore((s) => s.updateKeyResult);
  const deleteKeyResult = useOkrStore((s) => s.deleteKeyResult);
  const recordCheckIns = useOkrStore((s) => s.recordCheckIns);
  const toggleHabitLog = useOkrStore((s) => s.toggleHabitLog);
  const checkInsByKeyResultId = useOkrStore((s) => s.checkInsByKeyResultId);
  const habitLogsByKeyResultId = useOkrStore((s) => s.habitLogsByKeyResultId);

  const updateTask = useTaskStore((s) => s.updateTask);
  const updateProject = useProjectStore((s) => s.updateProject);

  const progress = metrics.krProgressMap.get(keyResult.id) ?? 0;
  const workRollup = metrics.workRollups.get(keyResult.id);
  const habitStat = metrics.habitStatsMap.get(keyResult.id);

  const checkIns = checkInsByKeyResultId[keyResult.id] || [];
  const habitLogs = habitLogsByKeyResultId[keyResult.id] || [];
  const isHabitDoneToday = habitLogs.some((l) => l.log_date === todayStr);

  const handleToggleHabitToday = async (e: React.MouseEvent) => {
    e.stopPropagation();
    await toggleHabitLog(keyResult.id, todayStr);
  };

  const handleUnlinkTask = async (taskId: string) => {
    await updateTask({ id: taskId, key_result_id: null });
  };

  const handleUnlinkProject = async (projectId: string) => {
    await updateProject(projectId, { key_result_id: null });
  };

  const handleDelete = async () => {
    if (window.confirm(`Delete key result "${keyResult.title}"?`)) {
      await deleteKeyResult(keyResult.id);
    }
  };

  const renderSubtitle = () => {
    let valueText = '';
    if (keyResult.kind === 'metric') {
      const u = keyResult.unit ? ` ${keyResult.unit}` : '';
      valueText = `${keyResult.current_value} of ${keyResult.target_value}${u}`;
    } else if (keyResult.kind === 'work') {
      const done = workRollup?.done ?? 0;
      const total = workRollup?.total ?? 0;
      valueText = `${done} of ${total} done`;
    } else if (keyResult.kind === 'habit') {
      const streak = habitStat?.weekStreak ?? 0;
      const weekCount = habitStat?.weekCount ?? 0;
      valueText =
        streak > 0
          ? `${weekCount} of ${keyResult.target_value} this week · ${streak} week streak`
          : `${weekCount} of ${keyResult.target_value} this week`;
    }

    const statusNode = (() => {
      if (!keyResult.status) {
        return <span className={styles.statusNoCheckIn}>No check-in yet</span>;
      }
      switch (keyResult.status) {
        case 'on_track':
          return <span className={styles.statusOnTrack}>On track</span>;
        case 'at_risk':
          return <span className={styles.statusAtRisk}>At risk</span>;
        case 'off_track':
          return <span className={styles.statusOffTrack}>Off track</span>;
        default:
          return <span className={styles.statusNoCheckIn}>No check-in yet</span>;
      }
    })();

    return (
      <div className={styles.subtitle}>
        <span>{valueText}</span>
        <span>·</span>
        {statusNode}
      </div>
    );
  };

  const menuItems: (DropdownMenuItemConfig | 'separator')[] = [
    {
      id: 'edit-kr',
      label: 'Edit',
      onClick: () => setIsEditing(true),
    },
    {
      id: 'delete-kr',
      label: 'Delete',
      danger: true,
      onClick: handleDelete,
    },
  ];

  return (
    <div className={styles.krContainer}>
      <div className={styles.krHeader} onClick={() => setExpanded(!expanded)}>
        <div className={styles.krLeft}>
          {keyResult.kind === 'habit' ? (
            <button
              type="button"
              className={`${styles.habitCheckBtn} ${isHabitDoneToday ? styles.habitChecked : ''}`}
              onClick={handleToggleHabitToday}
              title={isHabitDoneToday ? 'Completed today' : 'Mark completed today'}
            >
              {isHabitDoneToday && (
                <svg
                  className={styles.habitCheckIcon}
                  viewBox="0 0 24 24"
                  fill="none"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              )}
            </button>
          ) : (
            <ProgressRing progress={progress} size={20} strokeWidth={2.2} />
          )}

          <div className={styles.krInfo}>
            <div className={styles.titleRow}>
              <span className={styles.title}>{keyResult.title}</span>
            </div>
            {renderSubtitle()}
          </div>
        </div>

        <div className={styles.krRight} onClick={(e) => e.stopPropagation()}>
          <span className={styles.progressText}>{progress}%</span>
          <DropdownMenu
            trigger={
              <button
                type="button"
                className={styles.menuTriggerBtn}
                aria-label="Key result options"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="1" />
                  <circle cx="19" cy="12" r="1" />
                  <circle cx="5" cy="12" r="1" />
                </svg>
              </button>
            }
            items={menuItems}
          />
          <svg
            className={`${styles.expandChevron} ${expanded ? styles.expandedChevron : ''}`}
            viewBox="0 0 24 24"
            fill="none"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            onClick={() => setExpanded(!expanded)}
          >
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </div>
      </div>

      {/* Collapsible detail pane */}
      <div
        className={styles.expandedWrapper}
        data-collapsed={!expanded}
        aria-hidden={!expanded}
      >
        <div className={styles.expandedInner}>
          <div className={styles.expandedContent}>
          {/* Number KR inline update */}
          {keyResult.kind === 'metric' && (
            <div className={styles.detailSection}>
              <div className={styles.updateNumberRow}>
                <input
                  type="number"
                  className={styles.updateNumberInput}
                  placeholder="Update number"
                  value={quickValue}
                  onChange={(e) => setQuickValue(e.target.value)}
                  onKeyDown={async (e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      const num = Number(quickValue);
                      if (!isNaN(num) && quickValue.trim() !== '') {
                        await recordCheckIns(
                          [
                            {
                              keyResultId: keyResult.id,
                              value: num,
                              status: keyResult.status || 'on_track',
                              note: null,
                            },
                          ],
                          todayStr
                        );
                        setQuickValue('');
                      }
                    }
                  }}
                />
                {keyResult.unit && <span className={styles.subtitle}>{keyResult.unit}</span>}
              </div>
            </div>
          )}

          {/* Work / Supporting Work section */}
          <div className={styles.detailSection}>
            <div className={styles.sectionHeaderRow}>
              <span className={styles.sectionTitle}>
                {keyResult.kind === 'work' ? 'Work' : 'Supporting work'}
              </span>
              <WorkPickerPopover
                keyResultId={keyResult.id}
                trigger={<button type="button" className={styles.linkWorkBtn}>Link work</button>}
              />
            </div>

            <div className={styles.linkedList}>
              {workRollup?.tasks.map((t) => {
                const isDone = Boolean(t.is_completed);
                return (
                  <div
                    key={t.id}
                    className={`${styles.linkedRow} ${isDone ? styles.linkedRowCompleted : ''}`}
                  >
                    <div className={styles.linkedTaskTitle}>
                      {isDone && (
                        <svg
                          className={styles.taskCheckIcon}
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      )}
                      <span>{t.title}</span>
                    </div>
                    <button
                      type="button"
                      className={styles.unlinkBtn}
                      onClick={() => handleUnlinkTask(t.id)}
                      title="Unlink task"
                      aria-label={`Unlink task ${t.title}`}
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <line x1="18" y1="6" x2="6" y2="18" />
                        <line x1="6" y1="6" x2="18" y2="18" />
                      </svg>
                    </button>
                  </div>
                );
              })}

              {workRollup?.projects.map((p) => (
                <div key={p.id} className={styles.linkedRow}>
                  <span>Project: {p.name}</span>
                  <button
                    type="button"
                    className={styles.unlinkBtn}
                    onClick={() => handleUnlinkProject(p.id)}
                    title="Unlink project"
                    aria-label={`Unlink project ${p.name}`}
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <line x1="18" y1="6" x2="6" y2="18" />
                      <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                </div>
              ))}

              {(!workRollup || (workRollup.tasks.length === 0 && workRollup.projects.length === 0)) && (
                <span className={styles.subtitle}>No linked tasks or projects yet.</span>
              )}
            </div>
          </div>

          {/* History section (last 3 check-ins, sparkline if >= 2) */}
          <div className={styles.detailSection}>
            <div className={styles.historyHeaderRow}>
              <span className={styles.sectionTitle}>History</span>
              {checkIns.length >= 2 && <Sparkline entries={checkIns} />}
            </div>
            <div className={styles.checkInHistoryList}>
              {checkIns.slice(0, 3).map((ci) => {
                const dateLabel = formatDueLabel(ci.checked_in_on)?.label ?? ci.checked_in_on;
                const statusLabel =
                  ci.status === 'on_track' ? 'On track' : ci.status === 'at_risk' ? 'At risk' : 'Off track';
                const u = keyResult.unit ? ` ${keyResult.unit}` : '';
                return (
                  <div key={ci.id} className={styles.checkInHistoryRow}>
                    <span className={styles.checkInHistoryText}>
                      {dateLabel} · {ci.value}{u} · {statusLabel}
                      {ci.note && <span className={styles.checkInNote}> · {ci.note}</span>}
                    </span>
                  </div>
                );
              })}
              {checkIns.length === 0 && (
                <span className={styles.subtitle}>No check-ins yet.</span>
              )}
            </div>
          </div>
        </div>
      </div>
      </div>

      {/* Edit key result modal */}
      <KeyResultModal
        open={isEditing}
        onOpenChange={setIsEditing}
        objectiveId={keyResult.objective_id}
        initialKeyResult={keyResult}
        onSave={async (fields) => {
          await updateKeyResult(keyResult.id, fields);
          setIsEditing(false);
        }}
      />
    </div>
  );
};

export default KeyResultRow;
