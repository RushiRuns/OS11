import './styles/tokens.css';
import './styles/fonts.css';
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.js';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Failed to find root element');
}

// Global DevTools Hotkeys (F12, Ctrl+Shift+I / Cmd+Option+I, Ctrl+Shift+C / Cmd+Option+C)
window.addEventListener('keydown', (e: KeyboardEvent) => {
  const isMac = typeof navigator !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.platform);
  const modKey = isMac ? e.metaKey : e.ctrlKey;
  const isF12 = e.key === 'F12';
  const isDevToolsCombo =
    (isMac && modKey && e.altKey && (e.key.toLowerCase() === 'i' || e.key.toLowerCase() === 'c')) ||
    (!isMac && modKey && e.shiftKey && (e.key.toLowerCase() === 'i' || e.key.toLowerCase() === 'c'));

  if (isF12 || isDevToolsCombo) {
    e.preventDefault();
    const electron = (window as unknown as { electron?: { invoke: (channel: string) => Promise<unknown> } }).electron;
    electron?.invoke('app:toggle-dev-tools').catch(() => {});
  }
});

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
