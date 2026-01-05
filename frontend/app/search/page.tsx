'use client';

import { useState, useCallback } from 'react';
import { Search, Star, GitFork, ExternalLink, Clock, AlertCircle, ChevronDown } from 'lucide-react';
import debounce from 'lodash.debounce';
import { formatDistanceToNow } from 'date-fns';

interface SearchResult {
  repo_id: number;
  full_name: string;
  description: string | null;
  language: string | null;
  total_stars: number;
  forks: number;
  velocity_score: number;
  score: number;
  owner?: {
    login: string;
    avatar_url: string;
  };
  updated_at?: string;
}

interface SearchResponse {
  query: string;
  results: SearchResult[];
  total: number;
  took_ms: number;
}

type SortOption = 'relevance' | 'stars' | 'updated';

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
};

export default function SearchPage() {
  const [query, setQuery] = useState('');
  const [language, setLanguage] = useState('');
  const [sort, setSort] = useState<SortOption>('stars');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchMeta, setSearchMeta] = useState<{ total: number; took_ms: number } | null>(null);
  const [hasSearched, setHasSearched] = useState(false);

  const performSearch = async (searchQuery: string) => {
    if (!searchQuery.trim() || searchQuery.length < 2) {
      setResults([]);
      setSearchMeta(null);
      setHasSearched(false);
      return;
    }

    setIsLoading(true);
    setError(null);
    setHasSearched(true);

    try {
      const params = new URLSearchParams({
        q: searchQuery,
        sort,
        limit: '30',
      });
      if (language) {
        params.set('language', language);
      }

      const res = await fetch(`/api/search?${params.toString()}`);

      if (!res.ok) {
        if (res.status === 503) {
          throw new Error('Rate limit exceeded. Please try again in a moment.');
        }
        throw new Error('Search failed');
      }

      const data: SearchResponse = await res.json();
      setResults(data.results);
      setSearchMeta({ total: data.total, took_ms: data.took_ms });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Search failed');
      setResults([]);
    } finally {
      setIsLoading(false);
    }
  };

  const debouncedSearch = useCallback(
    debounce((q: string) => performSearch(q), 400),
    [sort, language]
  );

  const handleInputChange = (value: string) => {
    setQuery(value);
    debouncedSearch(value);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    performSearch(query);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          Search Repositories
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Find repositories across GitHub by name, description, or topic
        </p>
      </div>

      {/* Search form */}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row">
          {/* Search input */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              value={query}
              onChange={(e) => handleInputChange(e.target.value)}
              placeholder="Search repositories..."
              className="h-10 w-full rounded-md border border-border bg-card pl-10 pr-4 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          {/* Language filter */}
          <input
            type="text"
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            placeholder="Language..."
            className="h-10 w-full rounded-md border border-border bg-card px-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary sm:w-32"
          />

          {/* Sort selector */}
          <div className="relative">
            <select
              value={sort}
              onChange={(e) => {
                setSort(e.target.value as SortOption);
                if (query) performSearch(query);
              }}
              className="h-10 appearance-none rounded-md border border-border bg-card pl-3 pr-8 text-sm font-medium text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="stars">Stars</option>
              <option value="updated">Updated</option>
              <option value="relevance">Relevance</option>
            </select>
            <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          </div>

          {/* Search button */}
          <button
            type="submit"
            disabled={isLoading}
            className="h-10 rounded-md bg-primary px-6 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
          >
            {isLoading ? 'Searching...' : 'Search'}
          </button>
        </div>
      </form>

      {/* Error message */}
      {error && (
        <div className="rounded-lg border border-danger/30 bg-danger/5 p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-danger" />
            <p className="text-sm text-danger">{error}</p>
          </div>
        </div>
      )}

      {/* Search meta */}
      {searchMeta && !error && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span className="font-mono">{searchMeta.total.toLocaleString()}</span>
          <span>results in</span>
          <span className="font-mono">{searchMeta.took_ms}ms</span>
        </div>
      )}

      {/* Loading state */}
      {isLoading && (
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="animate-pulse rounded-lg border border-border bg-card p-4">
              <div className="flex items-start gap-4">
                <div className="h-10 w-10 rounded-full bg-muted" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-1/3 rounded bg-muted" />
                  <div className="h-3 w-2/3 rounded bg-muted" />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Results */}
      {!isLoading && results.length > 0 && (
        <div className="space-y-3">
          {results.map((repo) => (
            <div
              key={repo.repo_id}
              className="group rounded-lg border border-border bg-card p-4 transition-all hover:border-primary/50"
            >
              <div className="flex items-start gap-4">
                {repo.owner?.avatar_url && (
                  <img
                    src={repo.owner.avatar_url}
                    alt={repo.owner.login}
                    className="h-10 w-10 rounded-full border border-border"
                  />
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <a
                      href={`https://github.com/${repo.full_name}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="truncate font-medium text-foreground transition-colors hover:text-primary"
                    >
                      {repo.full_name}
                    </a>
                    <ExternalLink className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                  </div>
                  {repo.description && (
                    <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                      {repo.description}
                    </p>
                  )}
                  <div className="mt-3 flex flex-wrap items-center gap-4 text-xs">
                    {repo.language && (
                      <div className="flex items-center gap-1.5">
                        <span
                          className="h-2.5 w-2.5 rounded-full"
                          style={{ backgroundColor: languageColors[repo.language] || '#6b7280' }}
                        />
                        <span className="text-foreground">{repo.language}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-1 text-muted-foreground">
                      <Star className="h-3.5 w-3.5 text-yellow-500" />
                      <span className="font-mono">{repo.total_stars.toLocaleString()}</span>
                    </div>
                    <div className="flex items-center gap-1 text-muted-foreground">
                      <GitFork className="h-3.5 w-3.5" />
                      <span className="font-mono">{repo.forks.toLocaleString()}</span>
                    </div>
                    {repo.updated_at && (
                      <div className="flex items-center gap-1 text-muted-foreground">
                        <Clock className="h-3.5 w-3.5" />
                        <span>
                          Updated {formatDistanceToNow(new Date(repo.updated_at), { addSuffix: true })}
                        </span>
                      </div>
                    )}
                    <div className="flex items-center gap-1 text-muted-foreground">
                      <span>Velocity:</span>
                      <span className="font-mono text-primary">{repo.velocity_score.toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Empty state - no results after search */}
      {!isLoading && !error && hasSearched && results.length === 0 && query && (
        <div className="rounded-lg border border-dashed border-border bg-card p-8 text-center">
          <Search className="mx-auto h-10 w-10 text-muted-foreground/30" />
          <p className="mt-3 text-sm text-muted-foreground">
            No repositories found for &quot;{query}&quot;
          </p>
          <p className="mt-1 text-xs text-muted-foreground/70">
            Try a different search term or remove filters
          </p>
        </div>
      )}

      {/* Initial state */}
      {!hasSearched && !query && !isLoading && (
        <div className="rounded-lg border border-dashed border-border bg-card p-12 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
            <Search className="h-8 w-8 text-primary" />
          </div>
          <h3 className="mt-4 text-lg font-medium text-foreground">Search GitHub</h3>
          <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">
            Enter a search term to find repositories by name, description, or topic.
            Filter by language and sort by stars, relevance, or update date.
          </p>
        </div>
      )}
    </div>
  );
}
