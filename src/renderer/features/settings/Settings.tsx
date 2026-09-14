import React, { useState, useEffect } from 'react';
import { Button } from '../../components/Button/Button.js';
import { TagManager } from '../tags/TagManager.js';
import { useModuleStore } from '../../stores/moduleStore.js';
import { invoke } from '../../services/ipc.js';
import { IPC } from '../../../shared/ipc-channels.js';
import type { CalendarStatus, CalendarProvider } from '../../../shared/types/index.js';

export function Settings(): React.ReactElement {
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    return document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
  });

  const toggleTheme = () => {
    const nextTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(nextTheme);
    if (nextTheme === 'dark') {
      document.documentElement.setAttribute('data-theme', 'dark');
    } else {
      document.documentElement.removeAttribute('data-theme');
    }
  };

  return (
    <div style={{ padding: 'var(--space-8)', height: '100%', overflowY: 'auto' }}>
      <header style={{ marginBottom: 'var(--space-6)' }}>
        <h1
          style={{
            fontSize: 'var(--text-2xl)',
            fontWeight: 'var(--weight-bold)',
            letterSpacing: 'var(--tracking-tight)',
            color: 'var(--text-primary)',
            margin: 0,
          }}
        >
          Preferences & Settings
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--text-base)', margin: 'var(--space-2) 0 0 0' }}>
          Personalize appearance, keyboard shortcuts, and local storage
        </p>
      </header>

      <section
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--space-4)',
          maxWidth: '560px',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: 'var(--space-4)',
            backgroundColor: 'var(--surface-raised)',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border-subtle)',
          }}
        >
          <div>
            <div style={{ fontWeight: 'var(--weight-semibold)', color: 'var(--text-primary)' }}>
              Appearance Theme
            </div>
            <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', marginTop: '2px' }}>
              Switch between calibrated Light and Dark modes
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={toggleTheme}>
            {theme === 'dark' ? '☀️ Light Mode' : '🌙 Dark Mode'}
          </Button>
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: 'var(--space-4)',
            backgroundColor: 'var(--surface-raised)',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border-subtle)',
          }}
        >
          <div>
            <div style={{ fontWeight: 'var(--weight-semibold)', color: 'var(--text-primary)' }}>
              Local-First Database
            </div>
            <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', marginTop: '2px' }}>
              All data is stored locally in SQLite (WAL Mode). Zero external cloud sync.
            </div>
          </div>
          <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-success)', fontWeight: 'var(--weight-semibold)' }}>
            HEALTHY
          </span>
        </div>

        {/* Phase 9: Tag Management & Auto-Tagging */}
        <TagManager />

        {/* Phase 11: Calendar Integration Module */}
        <CalendarSettingsSection />
      </section>
    </div>
  );
}

function CalendarSettingsSection(): React.ReactElement {
  const isEnabled = useModuleStore((state) => state.isEnabled('calendar_integration'));
  const toggleModule = useModuleStore((state) => state.toggleModule);
  const [status, setStatus] = useState<CalendarStatus | null>(null);
  const [connectingProvider, setConnectingProvider] = useState<string | null>(null);

  const fetchStatus = async () => {
    try {
      const res = await invoke<CalendarStatus>(IPC.CALENDAR.GET_STATUS);
      if (res) setStatus(res);
    } catch {
      // Best-effort
    }
  };

  useEffect(() => {
    if (isEnabled) {
      fetchStatus();
    }
  }, [isEnabled]);

  const handleToggle = async () => {
    const nextState = !isEnabled;
    await toggleModule('calendar_integration', nextState);
    if (nextState) {
      await fetchStatus();
    }
  };

  const handleConnect = async (provider: CalendarProvider) => {
    setConnectingProvider(provider);
    try {
      await invoke(IPC.CALENDAR.CONNECT, provider);
      await fetchStatus();
    } finally {
      setConnectingProvider(null);
    }
  };

  const handleDisconnect = async (provider: CalendarProvider) => {
    try {
      await invoke(IPC.CALENDAR.DISCONNECT, provider);
      await fetchStatus();
    } catch {
      // Ignore
    }
  };

  const providers: Array<{ id: CalendarProvider; name: string; desc: string; icon: string }> = [
    {
      id: 'google',
      name: 'Google Calendar',
      desc: 'OAuth2 local loopback redirect (Raw REST API)',
      icon: '🌐',
    },
    {
      id: 'apple',
      name: 'Apple Calendar (iCloud)',
      desc: 'CalDAV protocol sync',
      icon: '🍎',
    },
    {
      id: 'outlook',
      name: 'Outlook / Office 365',
      desc: 'Microsoft Graph API via local OAuth2',
      icon: '📧',
    },
  ];

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-3)',
        padding: 'var(--space-4)',
        backgroundColor: 'var(--surface-raised)',
        borderRadius: 'var(--radius-md)',
        border: '1px solid var(--border-subtle)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontWeight: 'var(--weight-semibold)', color: 'var(--text-primary)' }}>
            Calendar Integration Module
          </div>
          <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', marginTop: '2px' }}>
            Sync scheduled task deadlines with external Google, Apple, and Outlook calendars
          </div>
        </div>
        <Button variant={isEnabled ? 'primary' : 'ghost'} size="sm" onClick={handleToggle}>
          {isEnabled ? 'Enabled ✓' : 'Disabled'}
        </Button>
      </div>

      {isEnabled && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', marginTop: 'var(--space-2)' }}>
          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Connected Calendar Providers
          </div>

          {providers.map((p) => {
            const isConnected = status?.connectedProviders?.includes(p.id);
            const isConnecting = connectingProvider === p.id;

            return (
              <div
                key={p.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: 'var(--space-3)',
                  backgroundColor: 'var(--surface-base)',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border-subtle)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                  <span style={{ fontSize: 'var(--text-lg)' }}>{p.icon}</span>
                  <div>
                    <div style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-medium)', color: 'var(--text-primary)' }}>
                      {p.name}
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>{p.desc}</div>
                  </div>
                </div>

                {isConnected ? (
                  <Button variant="ghost" size="sm" onClick={() => handleDisconnect(p.id)}>
                    Disconnect
                  </Button>
                ) : (
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={isConnecting}
                    onClick={() => handleConnect(p.id)}
                  >
                    {isConnecting ? 'Connecting...' : 'Connect'}
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default Settings;
