module.exports = {
  root: true,
  env: {
    browser: true,
    es2022: true,
    node: true,
  },
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
    ecmaFeatures: {
      jsx: true,
    },
  },
  plugins: ['@typescript-eslint', 'react', 'react-hooks'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:react/recommended',
    'plugin:react/jsx-runtime',
    'plugin:react-hooks/recommended',
    'prettier',
  ],
  settings: {
    react: {
      version: 'detect',
    },
  },
  rules: {
    '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    '@typescript-eslint/no-explicit-any': 'warn',
    'react/prop-types': 'off',
  },
  overrides: [
    // Strict Layer Boundaries: Renderer process cannot import main, worker, or database
    {
      files: ['src/renderer/**/*.{ts,tsx}'],
      rules: {
        'no-restricted-imports': [
          'error',
          {
            paths: [
              {
                name: 'better-sqlite3',
                message:
                  'Renderer cannot access SQLite directly. All persistence must go through IPC to Main repositories (ARCHITECTURE.md Layer Order).',
              },
            ],
            patterns: [
              {
                group: ['@main', '@main/**', '**/main/**', '**/main'],
                message:
                  'Renderer process may not import from the main process. Communicate via window.electron IPC bridge only (ARCHITECTURE.md Layer Order).',
              },
              {
                group: ['@worker', '@worker/**', '**/worker/**', '**/worker'],
                message:
                  'Renderer process may not import from worker threads directly (ARCHITECTURE.md Layer Order).',
              },
            ],
          },
        ],
      },
    },
    // Main process cannot import renderer code
    {
      files: ['src/main/**/*.{ts,tsx}'],
      rules: {
        'no-restricted-imports': [
          'error',
          {
            patterns: [
              {
                group: ['@renderer', '@renderer/**', '**/renderer/**', '**/renderer'],
                message:
                  'Main process may not import React UI or renderer code (ARCHITECTURE.md Process Boundaries).',
              },
            ],
          },
        ],
      },
    },
    // Worker threads cannot import UI or window modules
    {
      files: ['src/worker/**/*.{ts,tsx}'],
      rules: {
        'no-restricted-imports': [
          'error',
          {
            patterns: [
              {
                group: [
                  '@renderer',
                  '@renderer/**',
                  '**/renderer/**',
                  '**/renderer',
                  '@main/window/**',
                  '@main/tray/**',
                ],
                message:
                  'Worker threads must remain completely detached from UI and window management.',
              },
            ],
          },
        ],
      },
    },
  ],
};
