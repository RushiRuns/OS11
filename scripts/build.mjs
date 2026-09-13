import { build } from 'vite';
import { execSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

console.log('[OS11 Build] Running TypeScript type check...');
execSync('npx tsc --noEmit', { cwd: rootDir, stdio: 'inherit' });

console.log('[OS11 Build] Building renderer...');
await build({
  root: rootDir,
  configFile: path.join(rootDir, 'vite.config.ts'),
});

console.log('[OS11 Build] Building Electron main...');
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

console.log('[OS11 Build] Building Electron preload...');
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

console.log('[OS11 Build] Build completed successfully!');
