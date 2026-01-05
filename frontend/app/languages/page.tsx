'use client';

import { useState } from 'react';
import useSWR from 'swr';
import LanguageDistribution from '@/components/LanguageDistribution';
import { ChevronDown, Code, TrendingUp, Star, AlertCircle, BarChart3 } from 'lucide-react';

type TimeWindow = '1h' | '6h' | '12h' | '24h' | '7d' | '30d';

const timeWindows: { label: string; value: TimeWindow }[] = [
  { label: '1 Hour', value: '1h' },
  { label: '6 Hours', value: '6h' },
  { label: '12 Hours', value: '12h' },
  { label: '24 Hours', value: '24h' },
  { label: '7 Days', value: '7d' },
  { label: '30 Days', value: '30d' },
];

interface LanguageData {
  language: string;
  repo_count: number;
  total_stars_gained: number;
  event_count: number;
  avg_velocity?: number;
  top_repos?: string[];
}

interface LanguagesResponse {
  data: LanguageData[];
  window: string;
  timestamp: string;
}

const fetcher = async (url: string): Promise<LanguagesResponse> => {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error('Failed to fetch languages');
  }
  return res.json();
};

// Language colors
const languageColors: Record<string, string> = {
  TypeScript: '#3178c6',
  JavaScript: '#f1e05a',
  Python: '#3572A5',
  Rust: '#dea584',
  Go: '#00ADD8',
  Java: '#b07219',
  'C#': '#178600',
  'C++': '#f34b7d',
  Ruby: '#701516',
  Swift: '#F05138',
  Kotlin: '#A97BFF',
  PHP: '#4F5D95',
  Scala: '#c22d40',
  Dart: '#00B4AB',
  Elixir: '#6e4a7e',
};

export default function LanguagesPage() {
  const [timeWindow, setTimeWindow] = useState<TimeWindow>('24h');

  const { data, error, isLoading } = useSWR<LanguagesResponse>(
    `/api/languages?window=${timeWindow}&limit=50`,
    fetcher,
    {
      refreshInterval: 60000,
      revalidateOnFocus: true,
    }
  );

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Page header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Language Analytics
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Programming language activity and trends across GitHub
          </p>
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

      {/* Error state */}
      {error && (
        <div className="rounded-lg border border-danger/30 bg-danger/5 p-6">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-danger" />
            <div>
              <p className="text-sm font-medium text-danger">Failed to load language data</p>
              <p className="mt-1 text-xs text-danger/70">{error.message}</p>
            </div>
          </div>
        </div>
      )}

      {/* Loading state */}
      {isLoading && (
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="h-[350px] animate-pulse rounded-lg border border-border bg-muted" />
          <div className="h-[350px] animate-pulse rounded-lg border border-border bg-muted" />
        </div>
      )}

      {/* Data display */}
      {data && !error && (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-3 gap-4">
            <SummaryCard
              icon={Code}
              label="Languages"
              value={data.data.length.toString()}
              color="primary"
            />
            <SummaryCard
              icon={TrendingUp}
              label="Total Activity"
              value={data.data.reduce((sum, l) => sum + l.event_count, 0).toLocaleString()}
              color="chart-2"
            />
            <SummaryCard
              icon={Star}
              label="Stars Gained"
              value={`+${data.data.reduce((sum, l) => sum + l.total_stars_gained, 0).toLocaleString()}`}
              color="chart-4"
            />
          </div>

          {/* Charts */}
          <div className="grid gap-6 lg:grid-cols-2">
            <LanguageDistribution data={data.data} maxItems={8} />

            {/* Top languages list */}
            <div className="rounded-lg border border-border bg-card">
              <div className="flex items-center gap-2 border-b border-border px-4 py-3">
                <div className="flex h-7 w-7 items-center justify-center rounded-md bg-chart-4/10">
                  <BarChart3 className="h-3.5 w-3.5 text-chart-4" />
                </div>
                <div>
                  <h3 className="text-sm font-medium text-foreground">Top Languages</h3>
                  <p className="text-[10px] text-muted-foreground">By activity count</p>
                </div>
              </div>
              <div className="divide-y divide-border">
                {data.data.slice(0, 10).map((lang, index) => (
                  <div
                    key={lang.language}
                    className="flex items-center justify-between px-4 py-3 transition-colors hover:bg-card-hover"
                  >
                    <div className="flex items-center gap-3">
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-muted text-[10px] font-medium text-muted-foreground">
                        {index + 1}
                      </span>
                      <div className="flex items-center gap-2">
                        <span
                          className="h-3 w-3 rounded-full"
                          style={{ backgroundColor: languageColors[lang.language] || '#6b7280' }}
                        />
                        <span className="font-medium text-foreground">
                          {lang.language}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-6">
                      <div className="text-right">
                        <div className="font-mono text-sm text-foreground">
                          {lang.event_count.toLocaleString()}
                        </div>
                        <div className="text-[10px] text-muted-foreground">
                          events
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-mono text-sm text-foreground">
                          {lang.repo_count.toLocaleString()}
                        </div>
                        <div className="text-[10px] text-muted-foreground">
                          repos
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-mono text-sm text-success">
                          +{lang.total_stars_gained.toLocaleString()}
                        </div>
                        <div className="text-[10px] text-muted-foreground">
                          stars
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Full table */}
          <div className="rounded-lg border border-border bg-card">
            <div className="flex items-center gap-2 border-b border-border px-4 py-3">
              <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary/10">
                <Code className="h-3.5 w-3.5 text-primary" />
              </div>
              <div>
                <h3 className="text-sm font-medium text-foreground">All Languages</h3>
                <p className="text-[10px] text-muted-foreground">{data.data.length} languages tracked</p>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th className="w-12">#</th>
                    <th>Language</th>
                    <th className="text-right">Events</th>
                    <th className="text-right">Repos</th>
                    <th className="text-right">Stars Gained</th>
                    <th className="text-right">Velocity</th>
                    <th className="text-right">Share</th>
                  </tr>
                </thead>
                <tbody>
                  {data.data.map((lang, index) => {
                    const totalEvents = data.data.reduce(
                      (sum, l) => sum + l.event_count,
                      0
                    );
                    const share = ((lang.event_count / totalEvents) * 100).toFixed(1);

                    return (
                      <tr key={lang.language}>
                        <td className="text-center text-muted-foreground">
                          {index + 1}
                        </td>
                        <td>
                          <div className="flex items-center gap-2">
                            <span
                              className="h-3 w-3 rounded-full"
                              style={{ backgroundColor: languageColors[lang.language] || '#6b7280' }}
                            />
                            <span className="font-medium text-foreground">
                              {lang.language}
                            </span>
                          </div>
                        </td>
                        <td className="text-right text-foreground">
                          {lang.event_count.toLocaleString()}
                        </td>
                        <td className="text-right text-foreground">
                          {lang.repo_count.toLocaleString()}
                        </td>
                        <td className="text-right">
                          <span className="text-success">
                            +{lang.total_stars_gained.toLocaleString()}
                          </span>
                        </td>
                        <td className="text-right text-muted-foreground">
                          {(lang.avg_velocity ?? 0).toFixed(1)}
                        </td>
                        <td className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <div className="h-1 w-16 overflow-hidden rounded-full bg-muted">
                              <div
                                className="h-full rounded-full bg-gradient-to-r from-primary to-chart-2"
                                style={{ width: `${Math.min(100, parseFloat(share))}%` }}
                              />
                            </div>
                            <span className="w-10 text-right text-muted-foreground">
                              {share}%
                            </span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function SummaryCard({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  color: string;
}) {
  const colorClasses: Record<string, string> = {
    primary: 'text-primary bg-primary/10',
    'chart-2': 'text-chart-2 bg-chart-2/10',
    'chart-4': 'text-chart-4 bg-chart-4/10',
  };

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-center gap-3">
        <div className={`flex h-10 w-10 items-center justify-center rounded-md ${colorClasses[color]}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <p className="font-mono text-xl font-bold text-foreground">{value}</p>
          <p className="text-xs text-muted-foreground">{label}</p>
        </div>
      </div>
    </div>
  );
}
