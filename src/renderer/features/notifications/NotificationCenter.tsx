import React, { useEffect, useMemo } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { useNotificationStore } from '../../stores/notificationStore.js';
import type { NotificationHistoryItem } from '@shared/types/NotificationHistoryItem.js';
import styles from './NotificationCenter.module.css';

export interface NotificationCenterProps {
  onFocusTask?: (taskId: string) => void;
}

export function groupNotificationsByDate(items: NotificationHistoryItem[]): {
  today: NotificationHistoryItem[];
  yesterday: NotificationHistoryItem[];
  earlier: NotificationHistoryItem[];
} {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const groups = {
    today: [] as NotificationHistoryItem[],
    yesterday: [] as NotificationHistoryItem[],
    earlier: [] as NotificationHistoryItem[],
  };

  for (const item of items) {
    const itemDate = new Date(item.created_at);
    if (itemDate >= today) {
      groups.today.push(item);
    } else if (itemDate >= yesterday) {
      groups.yesterday.push(item);
    } else {
      groups.earlier.push(item);
    }
  }

  return groups;
}

function getTypeIcon(type: string): string {
  switch (type) {
    case 'pomodoro':
      return '🍅';
    case 'reminder':
      return '⏰';
    case 'due':
      return '📅';
    case 'agenda':
      return '📆';
    case 'goal':
      return '🎯';
    case 'streak':
      return '🔥';
    default:
      return '🔔';
  }
}

function formatItemTime(isoStr: string): string {
  try {
    const d = new Date(isoStr);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}

export function NotificationCenter({ onFocusTask }: NotificationCenterProps): React.ReactElement {
  const { items, unreadCount, isOpen, setOpen, loadNotifications, markRead, markAllRead, clearHistory } =
    useNotificationStore();
  const shouldReduceMotion = useReducedMotion();

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  // Group notifications
  const groups = useMemo(() => groupNotificationsByDate(items), [items]);

  const handleItemClick = async (item: NotificationHistoryItem) => {
    if (!item.read_at) {
      await markRead(item.id);
    }
    if (item.task_id && onFocusTask) {
      onFocusTask(item.task_id);
      setOpen(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Subtle backdrop overlay */}
          <motion.div
            className={styles.backdrop}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={() => setOpen(false)}
          />

          {/* Drawer Panel */}
          <motion.aside
            className={styles.drawer}
            role="region"
            aria-label="Notification Center"
            initial={shouldReduceMotion ? false : { x: 360 }}
            animate={{ x: 0 }}
            exit={shouldReduceMotion ? undefined : { x: 360 }}
            transition={{ duration: 0.17, ease: [0.16, 1, 0.3, 1] }}
          >
            {/* Header */}
            <div className={styles.header}>
              <div className={styles.titleArea}>
                <h2 className={styles.title}>Notifications</h2>
                {unreadCount > 0 && <span className={styles.unreadPill}>{unreadCount}</span>}
              </div>

              <div className={styles.headerActions}>
                {unreadCount > 0 && (
                  <button
                    type="button"
                    className={styles.actionBtn}
                    onClick={() => markAllRead()}
                    title="Mark all as read"
                  >
                    Mark All Read
                  </button>
                )}
                {items.length > 0 && (
                  <button
                    type="button"
                    className={styles.actionBtn}
                    onClick={() => clearHistory()}
                    title="Clear notification history"
                  >
                    Clear
                  </button>
                )}
                <button
                  type="button"
                  className={styles.closeBtn}
                  onClick={() => setOpen(false)}
                  aria-label="Close notification center"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Notification History List */}
            <div className={styles.scrollArea}>
              {items.length === 0 ? (
                <div className={styles.emptyState}>
                  <span className={styles.emptyIcon}>🔔</span>
                  <span className={styles.emptyText}>No notifications yet</span>
                </div>
              ) : (
                <>
                  {/* Today Group */}
                  {groups.today.length > 0 && (
                    <div className={styles.groupBlock}>
                      <div className={styles.groupHeader}>Today</div>
                      {groups.today.map((item) => (
                        <div
                          key={item.id}
                          className={`${styles.item} ${!item.read_at ? styles.itemUnread : ''}`}
                          onClick={() => handleItemClick(item)}
                        >
                          <span className={styles.typeIcon}>{getTypeIcon(item.type)}</span>
                          <div className={styles.itemContent}>
                            <div className={styles.itemTitleRow}>
                              <span className={styles.itemTitle}>{item.title}</span>
                              <span className={styles.itemTime}>{formatItemTime(item.created_at)}</span>
                            </div>
                            <span className={styles.itemBody}>{item.body}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Yesterday Group */}
                  {groups.yesterday.length > 0 && (
                    <div className={styles.groupBlock}>
                      <div className={styles.groupHeader}>Yesterday</div>
                      {groups.yesterday.map((item) => (
                        <div
                          key={item.id}
                          className={`${styles.item} ${!item.read_at ? styles.itemUnread : ''}`}
                          onClick={() => handleItemClick(item)}
                        >
                          <span className={styles.typeIcon}>{getTypeIcon(item.type)}</span>
                          <div className={styles.itemContent}>
                            <div className={styles.itemTitleRow}>
                              <span className={styles.itemTitle}>{item.title}</span>
                              <span className={styles.itemTime}>{formatItemTime(item.created_at)}</span>
                            </div>
                            <span className={styles.itemBody}>{item.body}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Earlier Group */}
                  {groups.earlier.length > 0 && (
                    <div className={styles.groupBlock}>
                      <div className={styles.groupHeader}>Earlier</div>
                      {groups.earlier.map((item) => (
                        <div
                          key={item.id}
                          className={`${styles.item} ${!item.read_at ? styles.itemUnread : ''}`}
                          onClick={() => handleItemClick(item)}
                        >
                          <span className={styles.typeIcon}>{getTypeIcon(item.type)}</span>
                          <div className={styles.itemContent}>
                            <div className={styles.itemTitleRow}>
                              <span className={styles.itemTitle}>{item.title}</span>
                              <span className={styles.itemTime}>{formatItemTime(item.created_at)}</span>
                            </div>
                            <span className={styles.itemBody}>{item.body}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}

export default NotificationCenter;
