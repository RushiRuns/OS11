import { createServer, build } from 'vite';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import electron from 'electron';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

// 1. Start Vite Dev Server
console.log('[OS11 Dev] Starting Vite dev server...');
const server = await createServer({
  root: rootDir,
  configFile: path.join(rootDir, 'vite.config.ts'),
  mode: 'development',
});
await server.listen();

const address = server.httpServer?.address();
const port = typeof address === 'object' && address ? address.port : 5173;
const devUrl = `http://localhost:${port}`;
console.log(`[OS11 Dev] Dev server ready at ${devUrl}`);

// 2. Build Electron main process
console.log('[OS11 Dev] Compiling Electron main...');
await build({
  root: rootDir,
  configFile: false,
  build: {
    ssr: true,
    target: 'node20',
    outDir: path.join(rootDir, 'dist-electron'),
    emptyOutDir: false,
    lib: {
      entry: path.join(rootDir, 'electron/main.ts'),
      formats: ['es'],
      fileName: () => 'main.js',
    },
    rollupOptions: {
      external: ['electron'],
    },
  },
});

// 3. Build Electron preload script
console.log('[OS11 Dev] Compiling Electron preload...');
await build({
  root: rootDir,
  configFile: false,
  build: {
    ssr: true,
    target: 'node20',
    outDir: path.join(rootDir, 'dist-electron'),
    emptyOutDir: false,
    lib: {
      entry: path.join(rootDir, 'electron/preload.ts'),
      formats: ['cjs'],
      fileName: () => 'preload.cjs',
    },
    rollupOptions: {
      external: ['electron'],
    },
  },
});

// 4. Spawn Electron binary
console.log('[OS11 Dev] Launching Electron...');
const electronProcess = spawn(electron, ['.'], {
  cwd: rootDir,
  stdio: 'inherit',
  env: {
    ...process.env,
    VITE_DEV_SERVER_URL: devUrl,
  },
});

const cleanup = () => {
  if (electronProcess && !electronProcess.killed) {
    electronProcess.kill();
  }
  server.close();
  process.exit();
};

electronProcess.on('close', () => {
  server.close();
  process.exit();
});

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);
