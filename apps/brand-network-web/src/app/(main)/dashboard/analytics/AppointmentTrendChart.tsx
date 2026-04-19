'use client';

import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';
import type { AppointmentTrendRow } from '@/lib/analytics/network-queries';

interface AppointmentTrendChartProps {
  data: AppointmentTrendRow[];
}

export default function AppointmentTrendChart({ data }: AppointmentTrendChartProps) {
  if (data.length === 0) {
    return (
      <div className="bento-card" style={{ padding: '3rem', textAlign: 'center' }}>
        <p style={{ color: 'var(--color-text-tertiary)' }}>No appointment data available yet.</p>
      </div>
    );
  }

  return (
    <div className="bento-card" style={{ padding: '1.5rem' }}>
      <ResponsiveContainer width="100%" height={260}>
        <AreaChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
          <defs>
            <linearGradient id="gradTotal" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#F24B9A" stopOpacity={0.25} />
              <stop offset="95%" stopColor="#F24B9A" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="gradConfirmed" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#32D74B" stopOpacity={0.2} />
              <stop offset="95%" stopColor="#32D74B" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
          <XAxis
            dataKey="week"
            tick={{ fill: 'rgba(248,244,240,0.4)', fontSize: 11 }}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            tick={{ fill: 'rgba(248,244,240,0.4)', fontSize: 11 }}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip
            contentStyle={{
              background: '#161420',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: '12px',
              color: '#F8F4F0',
              fontSize: '0.875rem',
            }}
            cursor={{ stroke: 'rgba(255,255,255,0.08)' }}
          />
          <Area
            type="monotone"
            dataKey="appointments"
            stroke="#F24B9A"
            strokeWidth={2}
            fill="url(#gradTotal)"
            name="Total"
            dot={false}
            activeDot={{ r: 4, fill: '#F24B9A' }}
          />
          <Area
            type="monotone"
            dataKey="confirmed"
            stroke="#32D74B"
            strokeWidth={2}
            fill="url(#gradConfirmed)"
            name="Confirmed"
            dot={false}
            activeDot={{ r: 4, fill: '#32D74B' }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
