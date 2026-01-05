'use client';

import { useState } from 'react';
import useSWR from 'swr';
import TrendingRepos from '@/components/TrendingRepos';
import VelocityChart from '@/components/VelocityChart';
import ActivityTimeline from '@/components/ActivityTimeline';
import { RefreshCw, TrendingUp, Activity, Star, GitFork, GitPullRequest, GitCommit, ChevronDown } from 'lucide-react';

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
  owner?: {
    login: string;
    avatar_url: string;
  };
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
  star_events?: number;
  fork_events?: number;
  push_events?: number;
  pr_events?: number;
  event_breakdown?: Record<string, number>;
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
  const [isRefreshing, setIsRefreshing] = useState(false);

  const { data: stats, mutate: refreshStats } = useSWR<StatsResponse>(
    '/api/stats',
    fetcher,
    { refreshInterval: 30000 }
  );

  const { data: trendingData, mutate: refreshTrending } = useSWR<TrendingResponse>(
    `/api/trending?window=${timeWindow}&limit=50`,
    fetcher,
    {
      refreshInterval: 30000,
      revalidateOnFocus: true,
    }
  );

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await Promise.all([refreshStats(), refreshTrending()]);
    setTimeout(() => setIsRefreshing(false), 500);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Page header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Activity Dashboard
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Real-time GitHub activity and trending repositories
          </p>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-3">
          {/* Refresh button */}
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="flex items-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-sm font-medium text-foreground transition-all hover:bg-card-hover disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>

          {/* Language filter */}
          <div className="relative">
            <input
              type="text"
              placeholder="Filter language..."
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              className="h-9 w-40 rounded-md border border-border bg-card px-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          {/* Time window selector */}
          <div className="relative">
            <select
              value={timeWindow}
              onChange={(e) => setTimeWindow(e.target.value as TimeWindow)}
              className="h-9 appearance-none rounded-md border border-border bg-card pl-3 pr-8 text-sm font-medium text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            >
              {timeWindows.map((tw) => (
                <option key={tw.value} value={tw.value}>
                  {tw.label}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          </div>
        </div>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <MetricCard
          icon={Activity}
          label="Total Events"
          value={stats?.total_events?.toLocaleString() ?? '—'}
          subtitle="Last hour"
          trend={stats?.events_per_min ? `${stats.events_per_min}/min` : undefined}
          color="primary"
        />
        <MetricCard
          icon={TrendingUp}
          label="Active Repos"
          value={stats?.active_repos?.toLocaleString() ?? '—'}
          subtitle="With activity"
          color="chart-2"
        />
        <MetricCard
          icon={Star}
          label="Top Language"
          value={stats?.top_language ?? '—'}
          subtitle="Most active"
          color="chart-4"
        />
        <MetricCard
          icon={GitCommit}
          label="Events/min"
          value={stats?.events_per_min?.toLocaleString() ?? '—'}
          subtitle="Current rate"
          color="success"
        />
      </div>

      {/* Event breakdown */}
      {stats?.event_breakdown && (
        <div className="grid grid-cols-4 gap-3">
          <EventTypeCard
            icon={Star}
            label="Stars"
            value={stats.star_events ?? 0}
            color="text-yellow-500"
          />
          <EventTypeCard
            icon={GitFork}
            label="Forks"
            value={stats.fork_events ?? 0}
            color="text-blue-500"
          />
          <EventTypeCard
            icon={GitCommit}
            label="Pushes"
            value={stats.push_events ?? 0}
            color="text-green-500"
          />
          <EventTypeCard
            icon={GitPullRequest}
            label="Pull Requests"
            value={stats.pr_events ?? 0}
            color="text-purple-500"
          />
        </div>
      )}

      {/* Charts section */}
      <div className="grid gap-6 lg:grid-cols-2">
        <VelocityChart data={trendingData?.data || []} maxItems={10} />
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

function MetricCard({
  icon: Icon,
  label,
  value,
  subtitle,
  trend,
  color = 'primary',
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  subtitle: string;
  trend?: string;
  color?: string;
}) {
  const colorClasses: Record<string, string> = {
    primary: 'text-primary bg-primary/10',
    'chart-2': 'text-chart-2 bg-chart-2/10',
    'chart-4': 'text-chart-4 bg-chart-4/10',
    success: 'text-success bg-success/10',
  };

  return (
    <div className="group relative overflow-hidden rounded-lg border border-border bg-card p-4 transition-all hover:border-primary/50">
      <div className="flex items-start justify-between">
        <div className={`flex h-10 w-10 items-center justify-center rounded-md ${colorClasses[color]}`}>
          <Icon className="h-5 w-5" />
        </div>
        {trend && (
          <span className="rounded bg-success/10 px-1.5 py-0.5 font-mono text-xs text-success">
            {trend}
          </span>
        )}
      </div>
      <div className="mt-4">
        <p className="font-mono text-2xl font-bold tracking-tight text-foreground">
          {value}
        </p>
        <p className="mt-0.5 text-xs font-medium uppercase tracking-wider text-muted-foreground">
          {label}
        </p>
        <p className="mt-1 text-[10px] text-muted-foreground">{subtitle}</p>
      </div>
      {/* Subtle glow on hover */}
      <div className="absolute inset-0 -z-10 opacity-0 transition-opacity group-hover:opacity-100">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent" />
      </div>
    </div>
  );
}

function EventTypeCard({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: React.ElementType;
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-md border border-border bg-card p-3">
      <Icon className={`h-4 w-4 ${color}`} />
      <div className="flex-1 min-w-0">
        <p className="truncate text-xs text-muted-foreground">{label}</p>
        <p className="font-mono text-sm font-semibold text-foreground">{value.toLocaleString()}</p>
      </div>
    </div>
  );
}
