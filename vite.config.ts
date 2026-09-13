import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import electron from 'vite-plugin-electron';
import renderer from 'vite-plugin-electron-renderer';
import path from 'node:path';

export default defineConfig({
  plugins: [
    react(),
    electron([
      {
        entry: 'src/main/index.ts',
        vite: {
          resolve: {
            alias: {
              '@shared': path.resolve(__dirname, 'src/shared'),
              '@main': path.resolve(__dirname, 'src/main'),
              '@worker': path.resolve(__dirname, 'src/worker'),
            },
          },
          build: {
            outDir: 'dist-electron',
            rollupOptions: {
              external: ['better-sqlite3', 'keytar'],
            },
          },
        },
      },
      {
        entry: 'src/main/window/preload.ts',
        onstart(options) {
          options.reload();
        },
        vite: {
          resolve: {
            alias: {
              '@shared': path.resolve(__dirname, 'src/shared'),
            },
          },
          build: {
            outDir: 'dist-electron',
            rollupOptions: {
              output: {
                format: 'cjs',
                entryFileNames: '[name].js',
              },
            },
          },
        },
      },
    ]),
    renderer(),
  ],
  resolve: {
    alias: {
      '@shared': path.resolve(__dirname, 'src/shared'),
      '@renderer': path.resolve(__dirname, 'src/renderer'),
      '@worker': path.resolve(__dirname, 'src/worker'),
      '@main': path.resolve(__dirname, 'src/main'),
    },
  },
  server: {
    port: 5173,
    strictPort: true,
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      output: {
        manualChunks(id) {
          // Recharts and data viz are bundled with dashboard chunk (PERFORMANCE.md §5)
          if (id.includes('node_modules/recharts')) {
            return 'dashboard';
          }
          // Lazy feature chunks
          if (id.includes('src/renderer/features/dashboard')) {
            return 'dashboard';
          }
          if (id.includes('src/renderer/features/agenda')) {
            return 'agenda';
          }
          if (id.includes('src/renderer/features/projects')) {
            return 'projects';
          }
          if (id.includes('src/renderer/features/settings')) {
            return 'settings';
          }
          if (id.includes('src/renderer/features/pomodoro')) {
            return 'pomodoro';
          }
        },
      },
    },
  },
});
