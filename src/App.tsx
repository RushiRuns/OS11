import React, { useState } from 'react';

declare global {
  interface Window {
    electron?: {
      versions: {
        node: () => string;
        chrome: () => string;
        electron: () => string;
      };
    };
  }
}

export function App(): React.ReactElement {
  const [count, setCount] = useState<number>(0);

  const nodeVersion = window.electron?.versions?.node() ?? 'N/A';
  const chromeVersion = window.electron?.versions?.chrome() ?? 'N/A';
  const electronVersion = window.electron?.versions?.electron() ?? 'N/A';

  return (
    <main style={styles.container}>
      <div style={styles.card}>
        <div style={styles.badge}>Scaffold Ready</div>
        <h1 style={styles.title}>OS11</h1>
        <p style={styles.subtitle}>Electron + Vite + React 18 + TypeScript</p>

        <section style={styles.versionGrid} aria-label="Environment details">
          <div style={styles.versionItem}>
            <span style={styles.label}>React</span>
            <span style={styles.value}>{React.version}</span>
          </div>
          <div style={styles.versionItem}>
            <span style={styles.label}>Electron</span>
            <span style={styles.value}>{electronVersion}</span>
          </div>
          <div style={styles.versionItem}>
            <span style={styles.label}>Node</span>
            <span style={styles.value}>{nodeVersion}</span>
          </div>
          <div style={styles.versionItem}>
            <span style={styles.label}>Chromium</span>
            <span style={styles.value}>{chromeVersion}</span>
          </div>
        </section>

        <div style={styles.actionRow}>
          <button
            id="counter-btn"
            style={styles.button}
            onClick={() => setCount((prev) => prev + 1)}
          >
            Count: {count}
          </button>
        </div>
      </div>
    </main>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    width: '100%',
    height: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '2rem',
  },
  card: {
    maxWidth: '480px',
    width: '100%',
    backgroundColor: '#1e293b',
    border: '1px solid #334155',
    borderRadius: '12px',
    padding: '2.5rem 2rem',
    boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    textAlign: 'center',
  },
  badge: {
    display: 'inline-block',
    padding: '0.25rem 0.75rem',
    fontSize: '0.75rem',
    fontWeight: 600,
    letterSpacing: '0.05em',
    textTransform: 'uppercase',
    color: '#38bdf8',
    backgroundColor: 'rgba(56, 189, 248, 0.1)',
    borderRadius: '9999px',
    marginBottom: '1rem',
    border: '1px solid rgba(56, 189, 248, 0.2)',
  },
  title: {
    fontSize: '2.5rem',
    fontWeight: 700,
    letterSpacing: '-0.025em',
    color: '#f8fafc',
    marginBottom: '0.25rem',
  },
  subtitle: {
    fontSize: '0.95rem',
    color: '#94a3b8',
    marginBottom: '1.75rem',
  },
  versionGrid: {
    width: '100%',
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: '0.75rem',
    marginBottom: '2rem',
  },
  versionItem: {
    backgroundColor: '#0f172a',
    borderRadius: '8px',
    padding: '0.75rem',
    border: '1px solid #1e293b',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.25rem',
  },
  label: {
    fontSize: '0.75rem',
    color: '#64748b',
    fontWeight: 500,
  },
  value: {
    fontSize: '0.9rem',
    color: '#e2e8f0',
    fontWeight: 600,
    fontFamily: 'monospace',
  },
  actionRow: {
    width: '100%',
    display: 'flex',
    justifyContent: 'center',
  },
  button: {
    backgroundColor: '#2563eb',
    color: '#ffffff',
    border: 'none',
    borderRadius: '8px',
    padding: '0.6rem 1.5rem',
    fontSize: '0.9rem',
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'background-color 0.2s ease',
  },
};

export default App;
