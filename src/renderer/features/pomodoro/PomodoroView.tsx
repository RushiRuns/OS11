import React from 'react';
import { EmptyState } from '../../components/EmptyState/EmptyState.js';

export function PomodoroView(): React.ReactElement {
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
          Pomodoro Focus Timer
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--text-base)', margin: 'var(--space-2) 0 0 0' }}>
          Deep work intervals and focused task execution
        </p>
      </header>

      <EmptyState
        icon="⏱️"
        title="Ready to Focus"
        description="Select a task to link your 25-minute deep work session and track completed intervals."
      />
    </div>
  );
}

export default PomodoroView;
