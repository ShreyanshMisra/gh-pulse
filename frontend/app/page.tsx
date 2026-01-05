'use client';

import { useState } from 'react';
import useSWR from 'swr';
import TrendingRepos from '@/components/TrendingRepos';
import VelocityChart from '@/components/VelocityChart';
import ActivityTimeline from '@/components/ActivityTimeline';
import { RefreshCw } from 'lucide-react';

type TimeWindow = '1h' | '6h' | '12h' | '24h' | '7d' | '30d';

const timeWindows: { label: string; value: TimeWindow }[] = [
  { label: '1 Hour', value: '1h' },
  { label: '6 Hours', value: '6h' },
  { label: '12 Hours', value: '12h' },
  { label: '24 Hours', value: '24h' },
  { label: '7 Days', value: '7d' },
  { label: '30 Days', value: '30d' },
];

interface TrendingRepo {
  repo_id: number;
  repo_name: string;
  language: string | null;
  description: string | null;
  total_stars: number;
  stars_gained: number;
  velocity_score: number;
  event_count: number;
}

interface TrendingResponse {
  data: TrendingRepo[];
  window: string;
  timestamp: string;
  total: number;
}

interface StatsResponse {
  total_events: number;
  active_repos: number;
  top_language: string;
  events_per_min: number;
}

const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error('Failed to fetch');
  }
  return res.json();
};

export default function Dashboard() {
  const [timeWindow, setTimeWindow] = useState<TimeWindow>('24h');
  const [language, setLanguage] = useState<string>('');

  // Fetch stats with polling
  const { data: stats, mutate: refreshStats } = useSWR<StatsResponse>(
    '/api/stats',
    fetcher,
    { refreshInterval: 30000 }
  );

  // Fetch trending data for charts
  const { data: trendingData } = useSWR<TrendingResponse>(
    `/api/trending?window=${timeWindow}&limit=50`,
    fetcher,
    {
      refreshInterval: 30000,
      revalidateOnFocus: true,
    }
  );

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
          {/* Refresh button */}
          <button
            onClick={() => refreshStats()}
            className="flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-1 text-xs text-primary hover:bg-primary/20"
            title="Refresh stats"
          >
            <RefreshCw className="h-3 w-3" />
            Refresh
          </button>

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
          value={stats?.total_events?.toLocaleString() || '--'}
          description="Events in last hour"
        />
        <StatsCard
          title="Active Repos"
          value={stats?.active_repos?.toLocaleString() || '--'}
          description="Repos with activity"
        />
        <StatsCard
          title="Top Language"
          value={stats?.top_language || '--'}
          description="Most active language"
        />
        <StatsCard
          title="Events/min"
          value={stats?.events_per_min?.toLocaleString() || '--'}
          description="Current throughput"
        />
      </div>

      {/* Charts section */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Velocity chart */}
        <VelocityChart data={trendingData?.data || []} maxItems={10} />

        {/* Activity timeline */}
        <ActivityTimeline
          eventsPerMin={stats?.events_per_min || 0}
          isConnected={true}
        />
      </div>

      {/* Trending repos table */}
      <TrendingRepos timeWindow={timeWindow} language={language} />
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
