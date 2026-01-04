'use client';

import { useState } from 'react';
import useSWR from 'swr';
import LanguageDistribution from '@/components/LanguageDistribution';

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
  total_stars: number;
  event_count: number;
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

export default function LanguagesPage() {
  const [timeWindow, setTimeWindow] = useState<TimeWindow>('24h');

  const { data, error, isLoading } = useSWR<LanguagesResponse>(
    `/api/languages?window=${timeWindow}&limit=50`,
    fetcher,
    {
      refreshInterval: 60000, // Refresh every minute
      revalidateOnFocus: true,
    }
  );

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">
            Language Statistics
          </h2>
          <p className="text-sm text-muted-foreground">
            Programming language activity across GitHub
          </p>
        </div>

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

      {/* Error state */}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-center">
          <p className="text-sm text-red-600">
            Failed to load language statistics. Make sure the API server is
            running.
          </p>
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
          {/* Charts */}
          <div className="grid gap-6 lg:grid-cols-2">
            <LanguageDistribution data={data.data} maxItems={8} />

            {/* Top languages list */}
            <div className="rounded-lg border border-border bg-card">
              <div className="border-b border-border px-4 py-3">
                <h3 className="text-sm font-medium text-foreground">
                  Top Languages by Activity
                </h3>
              </div>
              <div className="divide-y divide-border">
                {data.data.slice(0, 10).map((lang, index) => (
                  <div
                    key={lang.language}
                    className="flex items-center justify-between px-4 py-3"
                  >
                    <div className="flex items-center gap-3">
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-muted text-xs font-medium text-muted-foreground">
                        {index + 1}
                      </span>
                      <span className="font-medium text-foreground">
                        {lang.language}
                      </span>
                    </div>
                    <div className="flex items-center gap-6 text-sm">
                      <div className="text-right">
                        <div className="text-foreground">
                          {lang.event_count.toLocaleString()}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          events
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-foreground">
                          {lang.repo_count.toLocaleString()}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          repos
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-foreground">
                          {lang.total_stars.toLocaleString()}
                        </div>
                        <div className="text-xs text-muted-foreground">
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
            <div className="border-b border-border px-4 py-3">
              <h3 className="text-sm font-medium text-foreground">
                All Languages ({data.data.length})
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border bg-muted/50">
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      Rank
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      Language
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      Events
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      Repos
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      Stars Gained
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      Activity Share
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {data.data.map((lang, index) => {
                    const totalEvents = data.data.reduce(
                      (sum, l) => sum + l.event_count,
                      0
                    );
                    const share = ((lang.event_count / totalEvents) * 100).toFixed(
                      1
                    );

                    return (
                      <tr
                        key={lang.language}
                        className="transition-colors hover:bg-muted/50"
                      >
                        <td className="px-4 py-3 text-sm text-muted-foreground">
                          {index + 1}
                        </td>
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                            {lang.language}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right text-sm text-foreground">
                          {lang.event_count.toLocaleString()}
                        </td>
                        <td className="px-4 py-3 text-right text-sm text-foreground">
                          {lang.repo_count.toLocaleString()}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span
                            className={`text-sm font-medium ${
                              lang.total_stars > 0
                                ? 'text-green-600'
                                : 'text-muted-foreground'
                            }`}
                          >
                            {lang.total_stars > 0 ? '+' : ''}
                            {lang.total_stars.toLocaleString()}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <div className="h-1.5 w-16 overflow-hidden rounded-full bg-muted">
                              <div
                                className="h-full rounded-full bg-primary"
                                style={{ width: `${Math.min(100, parseFloat(share))}%` }}
                              />
                            </div>
                            <span className="text-xs text-muted-foreground">
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
