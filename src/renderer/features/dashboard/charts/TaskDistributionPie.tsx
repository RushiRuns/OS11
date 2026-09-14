import React, { useState } from 'react';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from 'recharts';
import type { DistributionStat } from '@shared/types/index.js';

interface TaskDistributionPieProps {
  byList: DistributionStat[];
  byTag: DistributionStat[];
  byPriority: DistributionStat[];
}

type DistributionMode = 'list' | 'tag' | 'priority';

export const TaskDistributionPie: React.FC<TaskDistributionPieProps> = ({
  byList,
  byTag,
  byPriority,
}) => {
  const [mode, setMode] = useState<DistributionMode>('list');

  const currentData =
    mode === 'list' ? byList : mode === 'tag' ? byTag : byPriority;

  const totalTasks = currentData.reduce((acc, curr) => acc + curr.count, 0);

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
          gap: 'var(--space-2)',
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
            Task Distribution
          </h3>
          <p
            style={{
              margin: 'var(--space-1) 0 0 0',
              fontSize: 'var(--text-xs)',
              color: 'var(--text-secondary)',
            }}
          >
            Breakdown of tasks across lists, tags, and priorities
          </p>
        </div>

        {/* Mode switcher tabs */}
        <div
          style={{
            display: 'flex',
            backgroundColor: 'var(--surface-base)',
            padding: '2px',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border-subtle)',
          }}
        >
          <button
            type="button"
            onClick={() => setMode('list')}
            style={{
              padding: 'var(--space-1) var(--space-3)',
              fontSize: 'var(--text-xs)',
              fontWeight: mode === 'list' ? 'var(--weight-medium)' : 'var(--weight-normal)',
              color: mode === 'list' ? 'var(--text-primary)' : 'var(--text-secondary)',
              backgroundColor: mode === 'list' ? 'var(--surface-raised)' : 'transparent',
              border: 'none',
              borderRadius: 'var(--radius-sm)',
              cursor: 'pointer',
              transition: 'background-color 150ms var(--ease-out)',
            }}
          >
            By List
          </button>
          <button
            type="button"
            onClick={() => setMode('tag')}
            style={{
              padding: 'var(--space-1) var(--space-3)',
              fontSize: 'var(--text-xs)',
              fontWeight: mode === 'tag' ? 'var(--weight-medium)' : 'var(--weight-normal)',
              color: mode === 'tag' ? 'var(--text-primary)' : 'var(--text-secondary)',
              backgroundColor: mode === 'tag' ? 'var(--surface-raised)' : 'transparent',
              border: 'none',
              borderRadius: 'var(--radius-sm)',
              cursor: 'pointer',
              transition: 'background-color 150ms var(--ease-out)',
            }}
          >
            By Tag
          </button>
          <button
            type="button"
            onClick={() => setMode('priority')}
            style={{
              padding: 'var(--space-1) var(--space-3)',
              fontSize: 'var(--text-xs)',
              fontWeight: mode === 'priority' ? 'var(--weight-medium)' : 'var(--weight-normal)',
              color: mode === 'priority' ? 'var(--text-primary)' : 'var(--text-secondary)',
              backgroundColor: mode === 'priority' ? 'var(--surface-raised)' : 'transparent',
              border: 'none',
              borderRadius: 'var(--radius-sm)',
              cursor: 'pointer',
              transition: 'background-color 150ms var(--ease-out)',
            }}
          >
            By Priority
          </button>
        </div>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: currentData.length > 0 ? 'minmax(200px, 1fr) minmax(180px, 1.2fr)' : '1fr',
          alignItems: 'center',
          gap: 'var(--space-6)',
          minHeight: 260,
        }}
      >
        {totalTasks === 0 ? (
          <div
            style={{
              height: 260,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--text-tertiary)',
              fontSize: 'var(--text-sm)',
              gridColumn: '1 / -1',
            }}
          >
            No tasks found in this category
          </div>
        ) : (
          <>
            <div style={{ width: '100%', height: 260, position: 'relative' }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
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
                      const pct = Math.round((value / totalTasks) * 100);
                      return [`${value} tasks (${pct}%)`, name];
                    }}
                  />
                  <Pie
                    data={currentData.filter((d) => d.count > 0)}
                    dataKey="count"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={85}
                    paddingAngle={3}
                    stroke="var(--surface-raised)"
                    strokeWidth={2}
                  >
                    {currentData
                      .filter((d) => d.count > 0)
                      .map((entry) => (
                        <Cell key={`cell-${entry.id}`} fill={entry.color} />
                      ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div
                style={{
                  position: 'absolute',
                  top: '50%',
                  left: '50%',
                  transform: 'translate(-50%, -50%)',
                  textAlign: 'center',
                  pointerEvents: 'none',
                }}
              >
                <div style={{ fontSize: 'var(--text-2xl)', fontWeight: 'var(--weight-bold)', color: 'var(--text-primary)' }}>
                  {totalTasks}
                </div>
                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>
                  Tasks
                </div>
              </div>
            </div>

            {/* Custom Legend / Value List */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 'var(--space-2)',
                maxHeight: 240,
                overflowY: 'auto',
                paddingRight: 'var(--space-2)',
              }}
            >
              {currentData
                .filter((item) => item.count > 0)
                .map((item) => {
                  const pct = Math.round((item.count / totalTasks) * 100);
                  return (
                    <div
                      key={item.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: 'var(--space-1) var(--space-2)',
                        borderRadius: 'var(--radius-sm)',
                        fontSize: 'var(--text-xs)',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', minWidth: 0 }}>
                        <span
                          style={{
                            width: 10,
                            height: 10,
                            borderRadius: 'var(--radius-xs)',
                            backgroundColor: item.color,
                            flexShrink: 0,
                          }}
                        />
                        <span
                          style={{
                            color: 'var(--text-primary)',
                            fontWeight: 'var(--weight-medium)',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                        >
                          {item.name}
                        </span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                        <span style={{ color: 'var(--text-secondary)' }}>{item.count}</span>
                        <span
                          style={{
                            color: 'var(--text-tertiary)',
                            minWidth: 32,
                            textAlign: 'right',
                          }}
                        >
                          {pct}%
                        </span>
                      </div>
                    </div>
                  );
                })}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default TaskDistributionPie;
