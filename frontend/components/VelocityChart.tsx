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

interface TrendingRepo {
  repo_name: string;
  velocity_score: number;
  stars_gained: number;
  event_count: number;
}

interface VelocityChartProps {
  data: TrendingRepo[];
  maxItems?: number;
}

const COLORS = [
  'hsl(222, 47%, 31%)',
  'hsl(222, 47%, 41%)',
  'hsl(222, 47%, 51%)',
  'hsl(222, 47%, 61%)',
  'hsl(222, 47%, 71%)',
];

export default function VelocityChart({ data, maxItems = 10 }: VelocityChartProps) {
  const chartData = data.slice(0, maxItems).map((repo) => ({
    name: repo.repo_name.split('/')[1] || repo.repo_name,
    fullName: repo.repo_name,
    velocity: repo.velocity_score,
    stars: repo.stars_gained,
    events: repo.event_count,
  }));

  if (chartData.length === 0) {
    return (
      <div className="flex h-[300px] items-center justify-center rounded-lg border border-border bg-card">
        <p className="text-sm text-muted-foreground">No data available</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <h3 className="mb-4 text-sm font-medium text-foreground">
        Top Repositories by Velocity
      </h3>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart
          data={chartData}
          layout="vertical"
          margin={{ top: 5, right: 30, left: 100, bottom: 5 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <XAxis
            type="number"
            tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
            tickLine={{ stroke: 'hsl(var(--border))' }}
          />
          <YAxis
            type="category"
            dataKey="name"
            tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
            tickLine={{ stroke: 'hsl(var(--border))' }}
            width={90}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: 'hsl(var(--card))',
              border: '1px solid hsl(var(--border))',
              borderRadius: '8px',
              fontSize: '12px',
            }}
            formatter={(value: number, name: string) => [
              value.toFixed(2),
              name === 'velocity' ? 'Velocity Score' : name,
            ]}
            labelFormatter={(label, payload) =>
              payload?.[0]?.payload?.fullName || label
            }
          />
          <Bar dataKey="velocity" radius={[0, 4, 4, 0]}>
            {chartData.map((_, index) => (
              <Cell
                key={`cell-${index}`}
                fill={COLORS[index % COLORS.length]}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
