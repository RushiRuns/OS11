import { app, BrowserWindow } from 'electron';
import { initDatabase, closeDatabase } from './database.js';
import { registerIpcHandlers } from './ipc/index.js';
import { createMainWindow } from './window/main-window.js';

app.whenReady().then(() => {
  console.log('[OS11 Main] Initializing database and migrations...');
  initDatabase();

  console.log('[OS11 Main] Registering IPC handlers...');
  registerIpcHandlers();

  console.log('[OS11 Main] Spawning MainWindow...');
  createMainWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    closeDatabase();
    app.quit();
  }
});
