import React, { useState } from 'react';
import { settingsServiceAdapter } from '../../services/settings-service-adapter.js';
import { useNotificationStore } from '../../stores/notificationStore.js';
import styles from './Titlebar.module.css';

interface TitlebarProps {
  title?: string;
  version?: string;
  isAlwaysOnTop?: boolean;
  onToggleAlwaysOnTop?: (pinned: boolean) => void;
}

export function Titlebar({
  title = 'OS11',
  version,
  isAlwaysOnTop: initialAlwaysOnTop = false,
  onToggleAlwaysOnTop,
}: TitlebarProps): React.ReactElement {
  const [pinned, setPinned] = useState(initialAlwaysOnTop);
  const unreadCount = useNotificationStore((state) => state.unreadCount);
  const isNotificationOpen = useNotificationStore((state) => state.isOpen);
  const toggleNotificationOpen = useNotificationStore((state) => state.toggleOpen);

  const isMac =
    typeof navigator !== 'undefined' &&
    (navigator.userAgent.includes('Mac') || navigator.platform?.includes('Mac'));

  const handleTogglePin = () => {
    const nextPinned = !pinned;
    setPinned(nextPinned);
    if (onToggleAlwaysOnTop) {
      onToggleAlwaysOnTop(nextPinned);
    }
  };

  return (
    <header className={`${styles.titlebar} ${isMac ? styles.macTitlebar : ''}`}>
      <div className={styles.titlebarLeft}>
        <div className={styles.titlebarTitle}>
          <span>{title}</span>
          {version && <span className={styles.versionBadge}>v{version}</span>}
        </div>
      </div>

      <div className={styles.titlebarActions}>
        {/* In-App Notification Center Bell */}
        <button
          type="button"
          className={`${styles.bellButton} ${isNotificationOpen ? styles.bellButtonActive : ''}`}
          onClick={() => toggleNotificationOpen()}
          title="Notification Center"
          aria-label="Notification Center"
        >
          <svg className={styles.bellIcon} viewBox="0 0 24 24">
            <path d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.9 2 2 2zm6-6v-5c0-3.07-1.63-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.64 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2zm-2 1H8v-6c0-2.48 1.51-4.5 4-4.5s4 2.02 4 4.5v6z" />
          </svg>
          {unreadCount > 0 && <span className={styles.unreadBadge}>{unreadCount}</span>}
        </button>

        {/* Always on Top Pin Button */}
        <button
          type="button"
          className={`${styles.pinButton} ${pinned ? styles.pinButtonActive : ''}`}
          onClick={handleTogglePin}
          title={pinned ? 'Unpin from Top' : 'Always on Top'}
          aria-label={pinned ? 'Unpin from Top' : 'Always on Top'}
        >
          <svg className={styles.pinIcon} viewBox="0 0 24 24">
            <path d="M16 12V4h1V2H7v2h1v8l-2 2v2h5.2v6h1.6v-6H18v-2l-2-2z" />
          </svg>
        </button>

        {/* Windows / Linux Window Chrome Controls */}
        {!isMac && (
          <div className={styles.windowControls} aria-label="Window Controls">
            <button
              type="button"
              className={`${styles.controlButton} ${styles.minimizeButton}`}
              onClick={() => settingsServiceAdapter.minimize()}
              aria-label="Minimize"
              title="Minimize"
            />
            <button
              type="button"
              className={`${styles.controlButton} ${styles.maximizeButton}`}
              onClick={() => settingsServiceAdapter.maximize()}
              aria-label="Maximize"
              title="Maximize"
            />
            <button
              type="button"
              className={`${styles.controlButton} ${styles.closeButton}`}
              onClick={() => settingsServiceAdapter.close()}
              aria-label="Close"
              title="Close"
            />
          </div>
        )}
      </div>
    </header>
  );
}

export default Titlebar;
