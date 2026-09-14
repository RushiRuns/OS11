import React, { useState, useEffect } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from 'recharts';
import { ipc } from '../../../services/ipc.js';
import { IPC } from '@shared/ipc-channels.js';
import type { Project, ProjectAnalytics } from '@shared/types/index.js';

interface ProjectBurndownProps {
  projects: Project[];
}

export const ProjectBurndown: React.FC<ProjectBurndownProps> = ({ projects }) => {
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [projectStats, setProjectStats] = useState<ProjectAnalytics | null>(null);
  const [loading, setLoading] = useState<boolean>(false);

  useEffect(() => {
    if (projects.length > 0 && !selectedProjectId) {
      setSelectedProjectId(projects[0].id);
    }
  }, [projects, selectedProjectId]);

  useEffect(() => {
    if (!selectedProjectId) return;

    let isMounted = true;
    setLoading(true);

    ipc
      .invoke<ProjectAnalytics>(IPC.ANALYTICS.GET_PROJECT_STATS, selectedProjectId)
      .then((data) => {
        if (isMounted) {
          setProjectStats(data);
          setLoading(false);
        }
      })
      .catch((err) => {
        console.error('Failed to load project analytics', err);
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [selectedProjectId]);

  if (projects.length === 0) {
    return null;
  }

  const formattedBurndown =
    projectStats?.burndown.map((b) => {
      const parts = b.date.split('-');
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const month = monthNames[parseInt(parts[1], 10) - 1] ?? '';
      const day = parseInt(parts[2], 10);
      return {
        ...b,
        displayDate: `${month} ${day}`,
      };
    }) ?? [];

  return (
    <div
      style={{
        backgroundColor: 'var(--surface-raised)',
        borderRadius: 'var(--radius-lg)',
        border: '1px solid var(--border-subtle)',
        padding: 'var(--space-6)',
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-4)',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 'var(--space-3)',
        }}
      >
        <div>
          <h3
            style={{
              margin: 0,
              fontSize: 'var(--text-lg)',
              fontWeight: 'var(--weight-semibold)',
              color: 'var(--text-primary)',
            }}
          >
            Project Burndown
          </h3>
          <p
            style={{
              margin: 'var(--space-1) 0 0 0',
              fontSize: 'var(--text-xs)',
              color: 'var(--text-secondary)',
            }}
          >
            Project completion velocity and ideal trajectory tracking
          </p>
        </div>

        {/* Project Selector Dropdown */}
        <select
          value={selectedProjectId}
          onChange={(e) => setSelectedProjectId(e.target.value)}
          style={{
            backgroundColor: 'var(--surface-base)',
            color: 'var(--text-primary)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-md)',
            padding: 'var(--space-2) var(--space-4)',
            fontSize: 'var(--text-xs)',
            fontWeight: 'var(--weight-medium)',
            cursor: 'pointer',
            outline: 'none',
          }}
        >
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <div
          style={{
            height: 260,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--text-tertiary)',
            fontSize: 'var(--text-sm)',
          }}
        >
          Calculating burndown...
        </div>
      ) : !projectStats ? (
        <div
          style={{
            height: 260,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--text-tertiary)',
            fontSize: 'var(--text-sm)',
          }}
        >
          Select a project to view burndown
        </div>
      ) : (
        <>
          {/* Micro stat pills */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))',
              gap: 'var(--space-3)',
            }}
          >
            <div
              style={{
                backgroundColor: 'var(--surface-base)',
                padding: 'var(--space-2) var(--space-3)',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-subtle)',
              }}
            >
              <div style={{ fontSize: '10px', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
                Total Tasks
              </div>
              <div style={{ fontSize: 'var(--text-lg)', fontWeight: 'var(--weight-bold)', color: 'var(--text-primary)' }}>
                {projectStats.totalTasks}
              </div>
            </div>
            <div
              style={{
                backgroundColor: 'var(--surface-base)',
                padding: 'var(--space-2) var(--space-3)',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-subtle)',
              }}
            >
              <div style={{ fontSize: '10px', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
                Completed
              </div>
              <div style={{ fontSize: 'var(--text-lg)', fontWeight: 'var(--weight-bold)', color: 'var(--color-success)' }}>
                {projectStats.completedTasks}
              </div>
            </div>
            <div
              style={{
                backgroundColor: 'var(--surface-base)',
                padding: 'var(--space-2) var(--space-3)',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-subtle)',
              }}
            >
              <div style={{ fontSize: '10px', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
                Overdue
              </div>
              <div style={{ fontSize: 'var(--text-lg)', fontWeight: 'var(--weight-bold)', color: projectStats.overdueTasks > 0 ? 'var(--color-danger)' : 'var(--text-primary)' }}>
                {projectStats.overdueTasks}
              </div>
            </div>
            <div
              style={{
                backgroundColor: 'var(--surface-base)',
                padding: 'var(--space-2) var(--space-3)',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-subtle)',
              }}
            >
              <div style={{ fontSize: '10px', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
                Velocity
              </div>
              <div style={{ fontSize: 'var(--text-lg)', fontWeight: 'var(--weight-bold)', color: 'var(--accent)' }}>
                {projectStats.velocity} <span style={{ fontSize: '10px', fontWeight: 'normal' }}>tasks/wk</span>
              </div>
            </div>
          </div>

          <div style={{ width: '100%', height: 260 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={formattedBurndown} margin={{ top: 10, right: 15, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" opacity={0.6} vertical={false} />
                <XAxis
                  dataKey="displayDate"
                  stroke="var(--text-tertiary)"
                  fontSize={11}
                  tickLine={false}
                  axisLine={{ stroke: 'var(--border-subtle)' }}
                />
                <YAxis
                  stroke="var(--text-tertiary)"
                  fontSize={11}
                  tickLine={false}
                  axisLine={{ stroke: 'var(--border-subtle)' }}
                  allowDecimals={false}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'var(--surface-overlay)',
                    borderColor: 'var(--border-subtle)',
                    borderRadius: 'var(--radius-sm)',
                    boxShadow: 'var(--shadow-md)',
                    color: 'var(--text-primary)',
                    fontSize: 'var(--text-xs)',
                  }}
                  formatter={(value: number, name: string) => {
                    if (name === 'remaining') return [value, 'Remaining Tasks'];
                    if (name === 'ideal') return [value, 'Ideal Linear Burndown'];
                    return [value, name];
                  }}
                  labelFormatter={(label) => `Date: ${label}`}
                />
                <Legend
                  wrapperStyle={{ fontSize: 11, paddingTop: 6 }}
                  formatter={(value) => (value === 'remaining' ? 'Remaining Tasks' : 'Ideal Trajectory')}
                />
                <Line
                  type="monotone"
                  dataKey="remaining"
                  name="remaining"
                  stroke="var(--accent)"
                  strokeWidth={2.5}
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="ideal"
                  name="ideal"
                  stroke="var(--text-tertiary)"
                  strokeWidth={1.5}
                  strokeDasharray="4 4"
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </>
      )}
    </div>
  );
};

export default ProjectBurndown;
