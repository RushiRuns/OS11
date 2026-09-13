import React from 'react';
import { EmptyState } from '../../components/EmptyState/EmptyState.js';

export function Projects(): React.ReactElement {
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
          Projects & Roadmaps
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--text-base)', margin: 'var(--space-2) 0 0 0' }}>
          Organize complex goals with sections, milestones, and task dependencies
        </p>
      </header>

      <EmptyState
        icon="📁"
        title="No Projects Yet"
        description="Create your first structured project to track multi-phase initiatives and deliverables."
      />
    </div>
  );
}

export default Projects;
