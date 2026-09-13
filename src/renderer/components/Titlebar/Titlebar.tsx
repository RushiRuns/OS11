import React, { useState } from 'react';
import { settingsServiceAdapter } from '../../services/settings-service-adapter.js';
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
