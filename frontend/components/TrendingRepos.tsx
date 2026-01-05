'use client';

import useSWR from 'swr';
import { formatDistanceToNow } from 'date-fns';
import { Star, GitFork, ExternalLink, TrendingUp, AlertCircle } from 'lucide-react';

interface TrendingRepo {
  repo_id: number;
  repo_name: string;
  language: string | null;
  description: string | null;
  total_stars: number;
  stars_gained: number;
  velocity_score: number;
  event_count: number;
  forks?: number;
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

// Language colors map
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
      refreshInterval: 30000,
      revalidateOnFocus: true,
    }
  );

  if (error) {
    return (
      <div className="rounded-lg border border-danger/30 bg-danger/5 p-6">
        <div className="flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-danger" />
          <div>
            <p className="text-sm font-medium text-danger">Failed to load trending repositories</p>
            <p className="mt-1 text-xs text-danger/70">{error.message}</p>
          </div>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="rounded-lg border border-border bg-card">
        <div className="border-b border-border px-4 py-3">
          <div className="h-4 w-32 animate-pulse rounded bg-muted" />
        </div>
        <div className="divide-y divide-border">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="flex items-center gap-4 px-4 py-4">
              <div className="h-8 w-8 animate-pulse rounded-full bg-muted" />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-1/3 animate-pulse rounded bg-muted" />
                <div className="h-3 w-1/2 animate-pulse rounded bg-muted" />
              </div>
              <div className="h-6 w-20 animate-pulse rounded bg-muted" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!data || data.data.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-card p-8 text-center">
        <TrendingUp className="mx-auto h-10 w-10 text-muted-foreground/30" />
        <p className="mt-3 text-sm text-muted-foreground">
          No trending repositories found
        </p>
        <p className="mt-1 text-xs text-muted-foreground/70">
          Try adjusting your filters or time window
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-card">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary/10">
            <TrendingUp className="h-3.5 w-3.5 text-primary" />
          </div>
          <div>
            <span className="text-sm font-medium text-foreground">
              Trending Repositories
            </span>
            <span className="ml-2 rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
              {data.total}
            </span>
          </div>
        </div>
        <span className="text-[10px] text-muted-foreground">
          Updated {formatDistanceToNow(new Date(data.timestamp), { addSuffix: true })}
        </span>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="data-table">
          <thead>
            <tr>
              <th className="w-12">#</th>
              <th>Repository</th>
              <th>Language</th>
              <th className="text-right">Stars</th>
              <th className="text-right">Gained</th>
              <th className="text-right">Velocity</th>
              <th className="text-right">Activity</th>
              <th className="w-10"></th>
            </tr>
          </thead>
          <tbody>
            {data.data.map((repo, index) => (
              <tr key={repo.repo_id} className="group">
                <td className="text-center text-muted-foreground">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-muted text-[10px] font-medium">
                    {index + 1}
                  </span>
                </td>
                <td>
                  <div className="flex items-center gap-3">
                    {repo.owner?.avatar_url && (
                      <img
                        src={repo.owner.avatar_url}
                        alt={repo.owner.login}
                        className="h-8 w-8 rounded-full border border-border"
                      />
                    )}
                    <div className="min-w-0">
                      <a
                        href={`https://github.com/${repo.repo_name}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block truncate font-medium text-foreground transition-colors hover:text-primary"
                      >
                        {repo.repo_name}
                      </a>
                      {repo.description && (
                        <p className="mt-0.5 max-w-md truncate text-[11px] text-muted-foreground">
                          {repo.description}
                        </p>
                      )}
                    </div>
                  </div>
                </td>
                <td>
                  {repo.language ? (
                    <div className="flex items-center gap-1.5">
                      <span
                        className="lang-dot"
                        style={{ backgroundColor: languageColors[repo.language] || '#6b7280' }}
                      />
                      <span className="text-xs text-foreground">{repo.language}</span>
                    </div>
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </td>
                <td className="text-right">
                  <div className="flex items-center justify-end gap-1">
                    <Star className="h-3 w-3 text-yellow-500" />
                    <span className="text-foreground">{repo.total_stars.toLocaleString()}</span>
                  </div>
                </td>
                <td className="text-right">
                  <span
                    className={`inline-flex items-center gap-0.5 ${
                      repo.stars_gained > 0
                        ? 'text-success'
                        : repo.stars_gained < 0
                        ? 'text-danger'
                        : 'text-muted-foreground'
                    }`}
                  >
                    {repo.stars_gained > 0 && '+'}
                    {repo.stars_gained.toLocaleString()}
                  </span>
                </td>
                <td className="text-right">
                  <div className="flex items-center justify-end gap-2">
                    <div className="h-1 w-12 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-primary to-chart-2"
                        style={{
                          width: `${Math.min(100, (repo.velocity_score / 10) * 100)}%`,
                        }}
                      />
                    </div>
                    <span className="w-10 text-right text-muted-foreground">
                      {repo.velocity_score.toFixed(1)}
                    </span>
                  </div>
                </td>
                <td className="text-right text-muted-foreground">
                  {repo.event_count.toLocaleString()}
                </td>
                <td>
                  <a
                    href={`https://github.com/${repo.repo_name}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex h-6 w-6 items-center justify-center rounded text-muted-foreground opacity-0 transition-all hover:bg-muted hover:text-foreground group-hover:opacity-100"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
