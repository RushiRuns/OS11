import React from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceLine,
} from 'recharts';
import type { CompletionDayStat } from '@shared/types/index.js';

interface CompletionTrendProps {
  data: CompletionDayStat[];
}

export const CompletionTrend: React.FC<CompletionTrendProps> = ({ data }) => {
  // Calculate on-time rate for each day (or cumulative)
  let cumulativeCompleted = 0;
  let cumulativeOnTime = 0;

  const trendData = data.map((d) => {
    cumulativeCompleted += d.count;
    cumulativeOnTime += d.onTimeCount;

    const dailyRate = d.count > 0 ? Math.round((d.onTimeCount / d.count) * 100) : 100;
    const cumulativeRate =
      cumulativeCompleted > 0
        ? Math.round((cumulativeOnTime / cumulativeCompleted) * 100)
        : 100;

    const parts = d.date.split('-');
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const month = monthNames[parseInt(parts[1], 10) - 1] ?? '';
    const day = parseInt(parts[2], 10);

    return {
      date: d.date,
      displayDate: `${month} ${day}`,
      dailyRate,
      cumulativeRate,
      count: d.count,
      onTimeCount: d.onTimeCount,
      lateCount: d.lateCount,
    };
  });

  const averageOnTime =
    cumulativeCompleted > 0
      ? Math.round((cumulativeOnTime / cumulativeCompleted) * 100)
      : 100;

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
            On-Time Completion Trend
          </h3>
          <p
            style={{
              margin: 'var(--space-1) 0 0 0',
              fontSize: 'var(--text-xs)',
              color: 'var(--text-secondary)',
            }}
          >
            Punctuality rate of completed tasks over time
          </p>
        </div>
        <div
          style={{
            fontSize: 'var(--text-xs)',
            fontWeight: 'var(--weight-medium)',
            color: 'var(--color-success)',
            backgroundColor: 'var(--color-success-muted)',
            padding: 'var(--space-1) var(--space-3)',
            borderRadius: 'var(--radius-full)',
          }}
        >
          {averageOnTime}% on-time overall
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
            No trend data available
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={trendData} margin={{ top: 10, right: 15, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" opacity={0.6} vertical={false} />
              <XAxis
                dataKey="displayDate"
                stroke="var(--text-tertiary)"
                fontSize={11}
                tickLine={false}
                axisLine={{ stroke: 'var(--border-subtle)' }}
              />
              <YAxis
                domain={[0, 100]}
                ticks={[0, 25, 50, 75, 100]}
                unit="%"
                stroke="var(--text-tertiary)"
                fontSize={11}
                tickLine={false}
                axisLine={{ stroke: 'var(--border-subtle)' }}
              />
              <ReferenceLine
                y={100}
                stroke="var(--color-success)"
                strokeDasharray="4 4"
                label={{
                  value: '100% Target',
                  position: 'insideTopRight',
                  fill: 'var(--color-success)',
                  fontSize: 10,
                }}
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
                  if (name === 'dailyRate') return [`${value}%`, 'Daily On-Time'];
                  if (name === 'cumulativeRate') return [`${value}%`, 'Overall On-Time'];
                  return [value, name];
                }}
                labelFormatter={(label) => `Date: ${label}`}
              />
              <Line
                type="monotone"
                dataKey="cumulativeRate"
                name="Overall On-Time"
                stroke="var(--color-success)"
                strokeWidth={2.5}
                dot={false}
                activeDot={{ r: 5, fill: 'var(--color-success)' }}
              />
              <Line
                type="monotone"
                dataKey="dailyRate"
                name="Daily On-Time"
                stroke="var(--accent)"
                strokeWidth={1.5}
                strokeDasharray="3 3"
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
};

export default CompletionTrend;
