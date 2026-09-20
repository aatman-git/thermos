import { useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, CartesianGrid } from 'recharts';
import { generateEventHistory } from '../../data/mockData';

export default function EventHistoryChart({ event }) {
  const data = useMemo(() => {
    if (!event || !event.properties) return [];
    return generateEventHistory(event);
  }, [event?.properties?.id]);

  if (!data || data.length === 0) {
    return (
      <div className="h-[180px] w-full bg-[var(--color-surface)] border border-[var(--color-border-subtle)] rounded-[var(--radius-lg)] p-4 flex flex-col items-center justify-center text-center">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--color-text-tertiary)" strokeWidth="1.5" className="mb-1 opacity-70">
          <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
        </svg>
        <span className="text-scale-sm font-medium text-[var(--color-text-secondary)]">No Observation History</span>
        <span className="text-scale-xs text-[var(--color-text-tertiary)]">Single-pass detection without historical passes</span>
      </div>
    );
  }

  return (
    <div className="h-[230px] w-full bg-[var(--color-surface)] border border-[var(--color-border-subtle)] rounded-[var(--radius-lg)] p-3.5">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 12, right: 16, bottom: 20, left: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" vertical={false} />
          <XAxis
            dataKey="hour"
            tick={{ fontSize: 10.5, fill: '#6B7280', fontFamily: "'JetBrains Mono', monospace" }}
            tickLine={false}
            axisLine={{ stroke: '#E5E7EB' }}
            tickFormatter={(v) => `${v}h`}
            label={{ value: 'Observation Time (Hours Ago)', position: 'insideBottom', offset: -12, fill: '#4B5563', fontSize: 10.5, fontWeight: 500 }}
          />
          <YAxis
            tick={{ fontSize: 10.5, fill: '#6B7280', fontFamily: "'JetBrains Mono', monospace" }}
            tickLine={false}
            axisLine={{ stroke: '#E5E7EB' }}
            domain={['auto', 'auto']}
            width={34}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: 'rgba(15, 18, 24, 0.95)',
              backdropFilter: 'blur(8px)',
              border: '1px solid rgba(255, 255, 255, 0.14)',
              borderRadius: '8px',
              fontSize: '12px',
              fontFamily: "'JetBrains Mono', monospace",
              color: '#F5F6F7',
              boxShadow: '0 8px 24px rgba(0, 0, 0, 0.25)',
              padding: '8px 12px',
            }}
            itemStyle={{ color: '#F5F6F7', padding: '2px 0' }}
            labelStyle={{ color: '#8B929E', fontWeight: 600, marginBottom: '4px' }}
            labelFormatter={(v) => `T-${v} Hours Ago`}
            formatter={(value, name) => {
              if (name === 'Temp (K)') return [`${value} K`, 'Brightness Temp'];
              if (name === 'FRP (MW)') return [`${value} MW`, 'Radiative Power'];
              return [value, name];
            }}
          />
          <Legend
            verticalAlign="top"
            align="right"
            iconSize={8}
            wrapperStyle={{ fontSize: '11px', paddingBottom: '6px' }}
          />
          <Line
            type="monotone"
            dataKey="temp"
            stroke="#D97706"
            strokeWidth={1.8}
            dot={false}
            activeDot={{ r: 4, strokeWidth: 0 }}
            name="Temp (K)"
            animationDuration={600}
            animationEasing="ease-out"
          />
          <Line
            type="monotone"
            dataKey="frp"
            stroke="#7C3AED"
            strokeWidth={1.8}
            dot={false}
            activeDot={{ r: 4, strokeWidth: 0 }}
            name="FRP (MW)"
            animationDuration={600}
            animationEasing="ease-out"
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

