'use client';

import { useState } from 'react';
import TrendingRepos from '@/components/TrendingRepos';

type TimeWindow = '1h' | '6h' | '12h' | '24h' | '7d' | '30d';

const timeWindows: { label: string; value: TimeWindow }[] = [
  { label: '1 Hour', value: '1h' },
  { label: '6 Hours', value: '6h' },
  { label: '12 Hours', value: '12h' },
  { label: '24 Hours', value: '24h' },
  { label: '7 Days', value: '7d' },
  { label: '30 Days', value: '30d' },
];

export default function Dashboard() {
  const [timeWindow, setTimeWindow] = useState<TimeWindow>('24h');
  const [language, setLanguage] = useState<string>('');

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">
            Trending Repositories
          </h2>
          <p className="text-sm text-muted-foreground">
            Discover repositories gaining momentum on GitHub
          </p>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-3">
          {/* Language filter */}
          <input
            type="text"
            placeholder="Filter by language..."
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            className="h-9 rounded-md border border-border bg-background px-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
          />

          {/* Time window selector */}
          <select
            value={timeWindow}
            onChange={(e) => setTimeWindow(e.target.value as TimeWindow)}
            className="h-9 rounded-md border border-border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
          >
            {timeWindows.map((tw) => (
              <option key={tw.value} value={tw.value}>
                {tw.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatsCard
          title="Total Events"
          value="--"
          description="Events processed today"
        />
        <StatsCard
          title="Active Repos"
          value="--"
          description="Repos with activity"
        />
        <StatsCard
          title="Top Language"
          value="--"
          description="Most active language"
        />
        <StatsCard
          title="Events/min"
          value="--"
          description="Current throughput"
        />
      </div>

      {/* Trending repos table */}
      <TrendingRepos timeWindow={timeWindow} language={language} />

      {/* WebSocket connection placeholder */}
      <div className="rounded-lg border border-dashed border-border p-6 text-center">
        <p className="text-sm text-muted-foreground">
          Real-time updates via WebSocket coming soon...
        </p>
      </div>
    </div>
  );
}

function StatsCard({
  title,
  value,
  description,
}: {
  title: string;
  value: string;
  description: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <p className="text-sm text-muted-foreground">{title}</p>
      <p className="mt-1 text-2xl font-semibold text-foreground">{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{description}</p>
    </div>
  );
}
