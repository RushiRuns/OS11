import React from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';
import type { CompletionDayStat } from '@shared/types/index.js';

interface CompletionBarChartProps {
  data: CompletionDayStat[];
}

export const CompletionBarChart: React.FC<CompletionBarChartProps> = ({ data }) => {
  const formattedData = data.map((d) => {
    // Format YYYY-MM-DD into "MMM D" e.g. "Sep 12"
    const parts = d.date.split('-');
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const month = monthNames[parseInt(parts[1], 10) - 1] ?? '';
    const day = parseInt(parts[2], 10);
    return {
      ...d,
      displayDate: `${month} ${day}`,
    };
  });

  const totalCompleted = data.reduce((acc, curr) => acc + curr.count, 0);

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
            Daily Completions
          </h3>
          <p
            style={{
              margin: 'var(--space-1) 0 0 0',
              fontSize: 'var(--text-xs)',
              color: 'var(--text-secondary)',
            }}
          >
            Tasks completed per day across the selected range
          </p>
        </div>
        <div
          style={{
            fontSize: 'var(--text-xs)',
            fontWeight: 'var(--weight-medium)',
            color: 'var(--accent)',
            backgroundColor: 'var(--accent-muted)',
            padding: 'var(--space-1) var(--space-3)',
            borderRadius: 'var(--radius-full)',
          }}
        >
          {totalCompleted} completed
        </div>
      </div>

      <div style={{ width: '100%', height: 260 }}>
        {data.length === 0 ? (
          <div
            style={{
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--text-tertiary)',
              fontSize: 'var(--text-sm)',
            }}
          >
            No completion data in this period
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={formattedData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
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
                  if (name === 'onTimeCount') return [value, 'On Time'];
                  if (name === 'lateCount') return [value, 'Late'];
                  return [value, 'Total Completed'];
                }}
                labelFormatter={(label) => `Date: ${label}`}
              />
              <Bar
                dataKey="count"
                name="Total Completed"
                fill="var(--accent)"
                radius={[4, 4, 0, 0]}
                maxBarSize={32}
              />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
};

export default CompletionBarChart;
