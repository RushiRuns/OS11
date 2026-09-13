import React from 'react';
import { settingsServiceAdapter } from '../../services/settings-service-adapter.js';
import styles from './Titlebar.module.css';

interface TitlebarProps {
  title?: string;
  version?: string;
}

export function Titlebar({ title = 'OS11', version }: TitlebarProps): React.ReactElement {
  const isMac = typeof navigator !== 'undefined' && navigator.userAgent.includes('Mac');

  return (
    <header className={styles.titlebar}>
      <div className={styles.titlebarTitle}>
        <span>{title}</span>
        {version && <span>v{version}</span>}
      </div>

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
    </header>
  );
}

export default Titlebar;
