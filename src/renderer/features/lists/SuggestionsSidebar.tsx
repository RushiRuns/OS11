import React, { useMemo, useEffect, useState, useRef } from 'react';
import { useTaskStore } from '../../stores/taskStore.js';
import { EmptyState } from '../../components/EmptyState/EmptyState.js';
import type { Task } from '@shared/types/task.js';
import styles from './SuggestionsSidebar.module.css';

export interface SuggestionsSidebarProps {
  onClose: () => void;
}

interface SuggestionItem {
  task: Task;
  section: string;
}

interface SectionGroup {
  id: string;
  title: string;
  items: Array<SuggestionItem & { isLeaving: boolean; globalIndex: number }>;
}

export function SuggestionsSidebar({ onClose }: SuggestionsSidebarProps): React.ReactElement {
  const { tasksById, updateTask } = useTaskStore();
  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);

  // Filter and prioritize suggestions into 4 categories:
  // 1. Due / overdue tasks
  // 2. Due follow-ups: waiting_since is set and follow_up_date <= today
  // 3. High priority tasks
  // 4. Anytime bucket tasks
  // Strictly excludes Someday bucket tasks.
  const suggestions = useMemo(() => {
    const dueTasks: SuggestionItem[] = [];
    const followUps: SuggestionItem[] = [];
    const priorityTasks: SuggestionItem[] = [];
    const anytimeTasks: SuggestionItem[] = [];

    for (const t of Object.values(tasksById)) {
      if (t.is_trashed === 1 || t.is_completed === 1) continue;
      if (t.my_day_date === todayStr) continue;
      if (t.bucket === 'someday') continue;

      if (t.due_date && t.due_date <= todayStr) {
        dueTasks.push({
          task: t,
          section: 'Due',
        });
        continue;
      }

      if (t.waiting_since && t.follow_up_date && t.follow_up_date <= todayStr) {
        followUps.push({
          task: t,
          section: 'Follow up today',
        });
        continue;
      }

      if (t.priority >= 2) {
        priorityTasks.push({
          task: t,
          section: 'Priority',
        });
        continue;
      }

      if (t.bucket === 'anytime') {
        anytimeTasks.push({
          task: t,
          section: 'Anytime',
        });
      }
    }

    anytimeTasks.sort((a, b) => (b.task.created_at || '').localeCompare(a.task.created_at || ''));

    return [...dueTasks, ...followUps, ...priorityTasks, ...anytimeTasks].slice(0, 20);
  }, [tasksById, todayStr]);

  const handleAddToMyDay = async (task: Task) => {
    await updateTask({
      id: task.id,
      my_day_date: todayStr,
    });
  };

  // State to track leaving rows for staged exit animation
  const [leavingMap, setLeavingMap] = useState<Map<string, SuggestionItem>>(new Map());
  const lastOrderedIdsRef = useRef<string[]>([]);
  const buttonRefs = useRef<Map<string, HTMLButtonElement>>(new Map());
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const [announcement, setAnnouncement] = useState('');
  const announceTimerRef = useRef<number | null>(null);
  const [isEntering, setIsEntering] = useState(true);

  // Entrance stagger safety timer: motion-fast (120ms) + 7 * detail-stagger-step (168ms) + motion-default (180ms) + buffer
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setIsEntering(false);
    }, 600);
    return () => window.clearTimeout(timer);
  }, []);

  // Close on Escape key press
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // Cleanup announcement timer on unmount
  useEffect(() => {
    return () => {
      if (announceTimerRef.current) {
        window.clearTimeout(announceTimerRef.current);
      }
    };
  }, []);

  // Merge live suggestions with leaving rows while maintaining visual order across sections
  const { displayedSections, totalVisibleCount } = useMemo(() => {
    const liveMap = new Map(suggestions.map((s) => [s.task.id, s]));
    const prevOrder = lastOrderedIdsRef.current;

    const activeIds = new Set([...liveMap.keys(), ...leavingMap.keys()]);
    const orderedIds: string[] = [];

    for (const id of prevOrder) {
      if (activeIds.has(id)) {
        orderedIds.push(id);
        activeIds.delete(id);
      }
    }
    for (const id of activeIds) {
      orderedIds.push(id);
    }

    lastOrderedIdsRef.current = orderedIds;

    const allItems = orderedIds.map((id) => {
      const leavingItem = leavingMap.get(id);
      if (leavingItem) {
        return { ...leavingItem, isLeaving: true };
      }
      const liveItem = liveMap.get(id)!;
      return { ...liveItem, isLeaving: false };
    });

    const sectionConfigs = [
      { id: 'due', title: 'Due' },
      { id: 'follow_up', title: 'Follow up today' },
      { id: 'priority', title: 'Priority' },
      { id: 'anytime', title: 'Anytime' },
    ];

    let runningIndex = 0;
    const sections: SectionGroup[] = [];

    for (const config of sectionConfigs) {
      const sectionItems = allItems.filter((item) => item.section === config.title);
      if (sectionItems.length > 0) {
        const indexedItems = sectionItems.map((item) => ({
          ...item,
          globalIndex: runningIndex++,
        }));
        sections.push({
          id: config.id,
          title: config.title,
          items: indexedItems,
        });
      }
    }

    return { displayedSections: sections, totalVisibleCount: runningIndex };
  }, [suggestions, leavingMap]);

  const handleRowAnimationEnd = (index: number) => {
    const maxStaggerIndex = Math.min(totalVisibleCount - 1, 7);
    if (index >= maxStaggerIndex) {
      setIsEntering(false);
    }
  };

  const handleAddClick = async (item: SuggestionItem) => {
    const { task, section } = item;
    if (leavingMap.has(task.id)) return;

    // 1. Focus shift: find next non-leaving Add button
    const orderedIds = lastOrderedIdsRef.current;
    const currentIndex = orderedIds.indexOf(task.id);
    let nextFocusBtn: HTMLButtonElement | null = null;

    for (let i = currentIndex + 1; i < orderedIds.length; i++) {
      const id = orderedIds[i];
      if (!leavingMap.has(id) && id !== task.id) {
        const btn = buttonRefs.current.get(id);
        if (btn) {
          nextFocusBtn = btn;
          break;
        }
      }
    }

    if (!nextFocusBtn) {
      for (let i = currentIndex - 1; i >= 0; i--) {
        const id = orderedIds[i];
        if (!leavingMap.has(id) && id !== task.id) {
          const btn = buttonRefs.current.get(id);
          if (btn) {
            nextFocusBtn = btn;
            break;
          }
        }
      }
    }

    if (!nextFocusBtn) {
      nextFocusBtn = closeButtonRef.current;
    }

    if (nextFocusBtn) {
      nextFocusBtn.focus();
    }

    // 2. Announce to polite live region
    setAnnouncement('Added to My Day');
    if (announceTimerRef.current) window.clearTimeout(announceTimerRef.current);
    announceTimerRef.current = window.setTimeout(() => {
      setAnnouncement('');
    }, 3000);

    // 3. Mark row as leaving at 0ms
    setLeavingMap((prev) => {
      const next = new Map(prev);
      next.set(task.id, { task, section });
      return next;
    });

    // 4. Safety timer: motion-fast (120ms) + motion-slow (280ms) + 100ms buffer = 500ms
    const SAFETY_LEAVING_TIMEOUT_MS = 500;
    window.setTimeout(() => {
      setLeavingMap((prev) => {
        if (!prev.has(task.id)) return prev;
        const next = new Map(prev);
        next.delete(task.id);
        return next;
      });
    }, SAFETY_LEAVING_TIMEOUT_MS);

    // 5. Fire store write immediately
    await handleAddToMyDay(task);
  };

  const handleWrapperTransitionEnd = (
    e: React.TransitionEvent<HTMLDivElement>,
    taskId: string
  ) => {
    if (e.target !== e.currentTarget) return;
    if (e.propertyName === 'grid-template-rows') {
      setLeavingMap((prev) => {
        if (!prev.has(taskId)) return prev;
        const next = new Map(prev);
        next.delete(taskId);
        return next;
      });
    }
  };

  return (
    <aside className={styles.panelContainer} aria-label="Suggestions Sidebar">
      {/* Polite live region for accessibility announcements */}
      <div aria-live="polite" className={styles.visuallyHidden}>
        {announcement}
      </div>

      <div className={styles.header}>
        <span className={styles.headerTitle}>SUGGESTIONS</span>
        <button
          ref={closeButtonRef}
          type="button"
          className={styles.closeButton}
          onClick={onClose}
          aria-label="Close suggestions"
          title="Close suggestions"
        >
          <svg
            className={styles.closeIcon}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      {totalVisibleCount === 0 ? (
        <div className={styles.emptyStateContainer}>
          <EmptyState
            title="All caught up!"
            description="No suggestions recommended for today."
            className={styles.emptyStateCustom}
          />
        </div>
      ) : (
        <div className={styles.content}>
          <div
            className={styles.suggestionList}
            data-entering={isEntering ? 'true' : undefined}
          >
            {displayedSections.map((section) => (
              <div key={section.id} className={styles.section}>
                <div className={styles.sectionHeader}>{section.title}</div>
                <div className={styles.sectionRows}>
                  {section.items.map(({ task, isLeaving, globalIndex }) => (
                    <div
                      key={task.id}
                      className={styles.rowWrapper}
                      data-leaving={isLeaving ? 'true' : undefined}
                      onTransitionEnd={(e) => handleWrapperTransitionEnd(e, task.id)}
                    >
                      <div className={styles.rowClip}>
                        <div
                          className={styles.suggestionRow}
                          style={{ '--row-index': globalIndex } as React.CSSProperties}
                          onAnimationEnd={() => handleRowAnimationEnd(globalIndex)}
                        >
                          <div className={styles.suggestionInfo}>
                            <span className={styles.suggestionTitle} title={task.title}>
                              {task.title}
                            </span>
                          </div>
                          <button
                            type="button"
                            ref={(el) => {
                              if (el) buttonRefs.current.set(task.id, el);
                              else buttonRefs.current.delete(task.id);
                            }}
                            className={styles.addButton}
                            data-added={isLeaving ? 'true' : undefined}
                            aria-disabled={isLeaving ? 'true' : undefined}
                            aria-label={`Add to My Day: ${task.title}`}
                            onClick={() =>
                              handleAddClick({
                                task,
                                section: section.title,
                              })
                            }
                          >
                            {isLeaving ? (
                              <>
                                <svg
                                  className={styles.checkIcon}
                                  viewBox="0 0 24 24"
                                  fill="none"
                                  stroke="currentColor"
                                  strokeWidth="2.5"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  aria-hidden="true"
                                >
                                  <polyline points="20 6 9 17 4 12" />
                                </svg>
                                <span>Added</span>
                              </>
                            ) : (
                              <>
                                <svg
                                  className={styles.addButtonIcon}
                                  viewBox="0 0 24 24"
                                  fill="none"
                                  stroke="currentColor"
                                  strokeWidth="2"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  aria-hidden="true"
                                >
                                  <line x1="12" y1="5" x2="12" y2="19" />
                                  <line x1="5" y1="12" x2="19" y2="12" />
                                </svg>
                                <span>Add</span>
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </aside>
  );
}

export default SuggestionsSidebar;
