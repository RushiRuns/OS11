import React, { useState } from 'react';
import { GeneralSettings } from './GeneralSettings.js';
import { AppearanceSettings } from './AppearanceSettings.js';
import { ModulesPage } from './ModulesPage.js';
import { KeyboardSettings } from './KeyboardSettings.js';
import { NotificationSettings } from './NotificationSettings.js';
import { PrivacySettings } from './PrivacySettings.js';
import { AdvancedSettings } from './AdvancedSettings.js';
import styles from './SettingsView.module.css';

type SettingsTab =
  | 'general'
  | 'appearance'
  | 'modules'
  | 'keyboard'
  | 'notifications'
  | 'privacy'
  | 'advanced';

interface NavTabItem {
  id: SettingsTab;
  label: string;
  icon: string;
}

const TABS: NavTabItem[] = [
  { id: 'general', label: 'General', icon: '⚙️' },
  { id: 'appearance', label: 'Appearance', icon: '🎨' },
  { id: 'modules', label: 'Modules', icon: '🧩' },
  { id: 'keyboard', label: 'Keyboard', icon: '⌨️' },
  { id: 'notifications', label: 'Notifications', icon: '🔔' },
  { id: 'privacy', label: 'Privacy & Lock', icon: '🔒' },
  { id: 'advanced', label: 'Advanced', icon: '⚡' },
];

export function SettingsView(): React.ReactElement {
  const [activeTab, setActiveTab] = useState<SettingsTab>('appearance');

  const renderActiveContent = () => {
    switch (activeTab) {
      case 'general':
        return <GeneralSettings />;
      case 'appearance':
        return <AppearanceSettings />;
      case 'modules':
        return <ModulesPage />;
      case 'keyboard':
        return <KeyboardSettings />;
      case 'notifications':
        return <NotificationSettings />;
      case 'privacy':
        return <PrivacySettings />;
      case 'advanced':
        return <AdvancedSettings />;
      default:
        return <AppearanceSettings />;
    }
  };

  return (
    <div className={styles.container}>
      {/* Settings Navigation Sidebar */}
      <nav className={styles.navSidebar} aria-label="Settings Categories">
        <div className={styles.navHeader}>Preferences</div>
        {TABS.map((t) => {
          const isActive = activeTab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              className={`${styles.navItem} ${isActive ? styles.navItemActive : ''}`}
              onClick={() => setActiveTab(t.id)}
            >
              <span>{t.icon}</span>
              <span>{t.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Main Settings Panel */}
      <main className={styles.contentArea}>
        {renderActiveContent()}
      </main>
    </div>
  );
}

export default SettingsView;
