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
            lib: {
              entry: 'src/main/window/preload.ts',
              formats: ['cjs'],
            },
            rollupOptions: {
              output: {
                entryFileNames: '[name].js',
              },
            },
          },
        },
      },
      {
        entry: 'src/worker/worker-main.ts',
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
              external: ['better-sqlite3'],
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
          // Vendor chunk for React core to prevent circular chunk initialization issues
          if (id.includes('node_modules/react') || id.includes('node_modules/react-dom') || id.includes('node_modules/scheduler')) {
            return 'vendor-react';
          }
          // Recharts and data viz are bundled with dashboard chunk (PERFORMANCE.md §5)
          if (id.includes('node_modules/recharts')) {
            return 'dashboard';
          }
          // Lazy feature chunks
          if (id.includes('node_modules/chrono-node')) {
            return 'chrono';
          }
          if (id.includes('src/renderer/features/dashboard')) {
            return 'dashboard';
          }
          if (id.includes('src/renderer/features/goals')) {
            return 'goals';
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
          if (id.includes('src/renderer/features/gtd') || id.includes('src/renderer/features/review')) {
            return 'gtd';
          }
        },
      },
    },
  },
});
