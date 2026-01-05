'use client';

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import { Zap } from 'lucide-react';

interface TrendingRepo {
  repo_name: string;
  velocity_score: number;
  stars_gained: number;
  event_count: number;
  total_stars?: number;
  language?: string | null;
}

interface VelocityChartProps {
  data: TrendingRepo[];
  maxItems?: number;
}

// Gradient colors for bars
const COLORS = [
  '#06b6d4', // cyan-500
  '#0ea5e9', // sky-500
  '#3b82f6', // blue-500
  '#6366f1', // indigo-500
  '#8b5cf6', // violet-500
  '#a855f7', // purple-500
  '#d946ef', // fuchsia-500
  '#ec4899', // pink-500
  '#f43f5e', // rose-500
  '#ef4444', // red-500
];

const CustomTooltip = ({ active, payload }: any) => {
  if (!active || !payload || !payload.length) return null;

  const data = payload[0].payload;
  return (
    <div className="rounded-md border border-border bg-card p-3 shadow-lg">
      <p className="font-medium text-foreground">{data.fullName}</p>
      <div className="mt-2 space-y-1 text-xs">
        <div className="flex justify-between gap-4">
          <span className="text-muted-foreground">Velocity</span>
          <span className="font-mono text-primary">{data.velocity.toFixed(2)}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-muted-foreground">Stars</span>
          <span className="font-mono text-foreground">{data.stars?.toLocaleString() ?? '—'}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-muted-foreground">Activity</span>
          <span className="font-mono text-foreground">{data.events?.toLocaleString() ?? '—'}</span>
        </div>
        {data.language && (
          <div className="flex justify-between gap-4">
            <span className="text-muted-foreground">Language</span>
            <span className="font-mono text-foreground">{data.language}</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default function VelocityChart({ data, maxItems = 10 }: VelocityChartProps) {
  const chartData = data.slice(0, maxItems).map((repo) => ({
    name: repo.repo_name.split('/')[1] || repo.repo_name,
    fullName: repo.repo_name,
    velocity: repo.velocity_score,
    stars: repo.total_stars,
    gained: repo.stars_gained,
    events: repo.event_count,
    language: repo.language,
  }));

  if (chartData.length === 0) {
    return (
      <div className="flex h-[350px] flex-col items-center justify-center rounded-lg border border-border bg-card">
        <Zap className="h-8 w-8 text-muted-foreground/50" />
        <p className="mt-2 text-sm text-muted-foreground">No velocity data available</p>
        <p className="mt-1 text-xs text-muted-foreground/70">Waiting for trending repositories...</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/10">
            <Zap className="h-4 w-4 text-primary" />
          </div>
          <div>
            <h3 className="text-sm font-medium text-foreground">Velocity Rankings</h3>
            <p className="text-[10px] text-muted-foreground">Top repositories by momentum</p>
          </div>
        </div>
        <span className="rounded bg-muted px-2 py-0.5 font-mono text-[10px] text-muted-foreground">
          TOP {chartData.length}
        </span>
      </div>

      <ResponsiveContainer width="100%" height={280}>
        <BarChart
          data={chartData}
          layout="vertical"
          margin={{ top: 0, right: 20, left: 0, bottom: 0 }}
        >
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="hsl(var(--border))"
            horizontal={false}
          />
          <XAxis
            type="number"
            tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            type="category"
            dataKey="name"
            tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            width={100}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: 'hsl(var(--muted) / 0.5)' }} />
          <Bar
            dataKey="velocity"
            radius={[0, 4, 4, 0]}
            maxBarSize={24}
          >
            {chartData.map((_, index) => (
              <Cell
                key={`cell-${index}`}
                fill={COLORS[index % COLORS.length]}
                fillOpacity={0.85}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
