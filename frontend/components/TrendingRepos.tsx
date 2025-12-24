'use client';

import useSWR from 'swr';
import { formatDistanceToNow } from 'date-fns';

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

interface TrendingReposProps {
  timeWindow: string;
  language: string;
}

const fetcher = async (url: string): Promise<TrendingResponse> => {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error('Failed to fetch trending repos');
  }
  return res.json();
};

export default function TrendingRepos({
  timeWindow,
  language,
}: TrendingReposProps) {
  const queryParams = new URLSearchParams({
    window: timeWindow,
    limit: '50',
  });

  if (language) {
    queryParams.set('language', language);
  }

  const { data, error, isLoading } = useSWR<TrendingResponse>(
    `/api/trending?${queryParams.toString()}`,
    fetcher,
    {
      refreshInterval: 30000, // Refresh every 30 seconds
      revalidateOnFocus: true,
    }
  );

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-center">
        <p className="text-sm text-red-600">
          Failed to load trending repositories. Make sure the API server is
          running.
        </p>
        <p className="mt-2 text-xs text-red-400">{error.message}</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="rounded-lg border border-border bg-card">
        <div className="p-6">
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="animate-pulse">
                <div className="flex items-center gap-4">
                  <div className="h-10 w-10 rounded bg-muted"></div>
                  <div className="flex-1 space-y-2">
                    <div className="h-4 w-1/3 rounded bg-muted"></div>
                    <div className="h-3 w-1/2 rounded bg-muted"></div>
                  </div>
                  <div className="h-6 w-20 rounded bg-muted"></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!data || data.data.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-card p-6 text-center">
        <p className="text-sm text-muted-foreground">
          No trending repositories found for the selected filters.
        </p>
        <p className="mt-2 text-xs text-muted-foreground">
          This may be because the ingestion service hasn&apos;t collected enough
          data yet.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-card">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-foreground">
            {data.total} repositories
          </span>
          <span className="text-xs text-muted-foreground">
            (Last updated{' '}
            {formatDistanceToNow(new Date(data.timestamp), { addSuffix: true })})
          </span>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border bg-muted/50">
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Repository
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Language
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Stars
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Gained
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Velocity
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Events
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {data.data.map((repo, index) => (
              <tr
                key={repo.repo_id}
                className="hover:bg-muted/50 transition-colors"
              >
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-xs font-medium text-muted-foreground">
                      {index + 1}
                    </span>
                    <div>
                      <a
                        href={`https://github.com/${repo.repo_name}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-medium text-foreground hover:text-primary hover:underline"
                      >
                        {repo.repo_name}
                      </a>
                      {repo.description && (
                        <p className="mt-0.5 max-w-md truncate text-xs text-muted-foreground">
                          {repo.description}
                        </p>
                      )}
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3">
                  {repo.language ? (
                    <span className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                      {repo.language}
                    </span>
                  ) : (
                    <span className="text-xs text-muted-foreground">--</span>
                  )}
                </td>
                <td className="px-4 py-3 text-right text-sm text-foreground">
                  {repo.total_stars.toLocaleString()}
                </td>
                <td className="px-4 py-3 text-right">
                  <span
                    className={`text-sm font-medium ${
                      repo.stars_gained > 0
                        ? 'text-green-600'
                        : repo.stars_gained < 0
                        ? 'text-red-600'
                        : 'text-muted-foreground'
                    }`}
                  >
                    {repo.stars_gained > 0 ? '+' : ''}
                    {repo.stars_gained.toLocaleString()}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <div className="h-1.5 w-16 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-primary"
                        style={{
                          width: `${Math.min(
                            100,
                            (repo.velocity_score / 10) * 100
                          )}%`,
                        }}
                      />
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {repo.velocity_score.toFixed(2)}
                    </span>
                  </div>
                </td>
                <td className="px-4 py-3 text-right text-sm text-muted-foreground">
                  {repo.event_count.toLocaleString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
