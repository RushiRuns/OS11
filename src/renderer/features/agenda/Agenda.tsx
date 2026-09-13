import React from 'react';
import { EmptyState } from '../../components/EmptyState/EmptyState.js';

export function Agenda(): React.ReactElement {
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
          Agenda & Schedule
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--text-base)', margin: 'var(--space-2) 0 0 0' }}>
          Daily calendar timeline and scheduled task deadlines
        </p>
      </header>

      <EmptyState
        icon="📆"
        title="Schedule Clear"
        description="No events or timed deadlines scheduled for today. Tasks with due dates will appear on your timeline."
      />
    </div>
  );
}

export default Agenda;
