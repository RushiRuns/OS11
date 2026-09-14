import React, { useState } from 'react';
import type { CompletionDayStat } from '@shared/types/index.js';

interface ActivityHeatmapProps {
  completions: CompletionDayStat[];
}

export const ActivityHeatmap: React.FC<ActivityHeatmapProps> = ({ completions }) => {
  const [hoveredCell, setHoveredCell] = useState<{
    date: string;
    count: number;
    x: number;
    y: number;
  } | null>(null);

  // Map completions by date string
  const countsByDate = new Map<string, number>();
  for (const c of completions) {
    countsByDate.set(c.date, c.count);
  }

  // Generate 52 weeks of dates ending today
  const today = new Date();
  // We align columns to weeks (Sunday to Saturday or Monday to Sunday). Let's use Monday (1) to Sunday (0)
  const daysTotal = 52 * 7;
  const startDate = new Date(today);
  startDate.setDate(today.getDate() - daysTotal + 1);

  const weeks: Array<Array<{ date: string; dateObj: Date; count: number }>> = [];
  let currentWeek: Array<{ date: string; dateObj: Date; count: number }> = [];

  const runner = new Date(startDate);
  while (runner <= today) {
    const dStr = runner.toISOString().slice(0, 10);
    const count = countsByDate.get(dStr) ?? 0;
    currentWeek.push({
      date: dStr,
      dateObj: new Date(runner),
      count,
    });

    if (currentWeek.length === 7) {
      weeks.push(currentWeek);
      currentWeek = [];
    }
    runner.setDate(runner.getDate() + 1);
  }
  if (currentWeek.length > 0) {
    weeks.push(currentWeek);
  }

  // Helper for color intensity (levels 0 to 4)
  const getCellColor = (count: number) => {
    if (count === 0) return 'var(--surface-hover)';
    if (count <= 2) return 'rgba(27, 136, 255, 0.25)';
    if (count <= 5) return 'rgba(27, 136, 255, 0.50)';
    if (count <= 8) return 'rgba(27, 136, 255, 0.75)';
    return 'var(--accent)';
  };

  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

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
        position: 'relative',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h3
            style={{
              margin: 0,
              fontSize: 'var(--text-lg)',
              fontWeight: 'var(--weight-semibold)',
              color: 'var(--text-primary)',
            }}
          >
            Activity Heatmap
          </h3>
          <p
            style={{
              margin: 'var(--space-1) 0 0 0',
              fontSize: 'var(--text-xs)',
              color: 'var(--text-secondary)',
            }}
          >
            Year-long view of daily task completion consistency (52 weeks)
          </p>
        </div>

        {/* Legend */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
          <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>Less</span>
          <div style={{ display: 'flex', gap: '3px' }}>
            <span style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: 'var(--surface-hover)' }} />
            <span style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: 'rgba(27, 136, 255, 0.25)' }} />
            <span style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: 'rgba(27, 136, 255, 0.50)' }} />
            <span style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: 'rgba(27, 136, 255, 0.75)' }} />
            <span style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: 'var(--accent)' }} />
          </div>
          <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>More</span>
        </div>
      </div>

      <div style={{ overflowX: 'auto', paddingBottom: 'var(--space-2)' }}>
        <div style={{ display: 'inline-flex', flexDirection: 'column', gap: '4px', minWidth: 720 }}>
          {/* Month labels header */}
          <div style={{ display: 'flex', marginLeft: 28, height: 16, position: 'relative' }}>
            {weeks.map((week, wIdx) => {
              const firstDay = week[0]?.dateObj;
              if (firstDay && firstDay.getDate() <= 7 && wIdx % 4 === 0) {
                return (
                  <span
                    key={`m-${wIdx}`}
                    style={{
                      position: 'absolute',
                      left: wIdx * 14,
                      fontSize: 10,
                      color: 'var(--text-tertiary)',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {monthNames[firstDay.getMonth()]}
                  </span>
                );
              }
              return null;
            })}
          </div>

          {/* Grid rows by day of week (Mon, Tue, Wed, Thu, Fri, Sat, Sun) */}
          <div style={{ display: 'flex', gap: '4px' }}>
            {/* Day of week labels */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '4px',
                width: 24,
                fontSize: 9,
                color: 'var(--text-tertiary)',
                lineHeight: '10px',
              }}
            >
              <span>Mon</span>
              <span style={{ visibility: 'hidden' }}>Tue</span>
              <span>Wed</span>
              <span style={{ visibility: 'hidden' }}>Thu</span>
              <span>Fri</span>
              <span style={{ visibility: 'hidden' }}>Sat</span>
              <span style={{ visibility: 'hidden' }}>Sun</span>
            </div>

            {/* Weeks columns */}
            <div style={{ display: 'flex', gap: '4px' }}>
              {weeks.map((week, wIdx) => (
                <div
                  key={`week-${wIdx}`}
                  style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}
                >
                  {week.map((day) => (
                    <div
                      key={day.date}
                      onMouseEnter={(e) => {
                        const rect = e.currentTarget.getBoundingClientRect();
                        setHoveredCell({
                          date: day.date,
                          count: day.count,
                          x: rect.left + rect.width / 2,
                          y: rect.top - 8,
                        });
                      }}
                      onMouseLeave={() => setHoveredCell(null)}
                      style={{
                        width: 10,
                        height: 10,
                        borderRadius: 2,
                        backgroundColor: getCellColor(day.count),
                        cursor: 'pointer',
                        transition: 'transform 100ms ease, box-shadow 100ms ease',
                      }}
                    />
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Floating Hover Tooltip */}
      {hoveredCell && (
        <div
          style={{
            position: 'fixed',
            left: hoveredCell.x,
            top: hoveredCell.y,
            transform: 'translate(-50%, -100%)',
            backgroundColor: 'var(--surface-overlay)',
            color: 'var(--text-primary)',
            fontSize: 'var(--text-xs)',
            padding: 'var(--space-1) var(--space-2)',
            borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--border-subtle)',
            boxShadow: 'var(--shadow-md)',
            pointerEvents: 'none',
            whiteSpace: 'nowrap',
            zIndex: 1000,
          }}
        >
          <strong>{hoveredCell.date}</strong> — {hoveredCell.count}{' '}
          {hoveredCell.count === 1 ? 'task' : 'tasks'} completed
        </div>
      )}
    </div>
  );
};

export default ActivityHeatmap;
