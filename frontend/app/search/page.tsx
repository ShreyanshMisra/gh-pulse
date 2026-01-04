'use client';

import { useState, useEffect, useCallback } from 'react';
import { Search, Star, GitFork, ExternalLink } from 'lucide-react';
import debounce from 'lodash.debounce';

interface SearchResult {
  repo_id: number;
  full_name: string;
  description: string | null;
  language: string | null;
  total_stars: number;
  velocity_score: number;
  score: number;
}

interface SearchResponse {
  query: string;
  results: SearchResult[];
  total: number;
  took_ms: number;
}

interface Suggestion {
  name: string;
  language: string | null;
  stars: number;
}

type SortOption = 'relevance' | 'stars' | 'velocity';

export default function SearchPage() {
  const [query, setQuery] = useState('');
  const [language, setLanguage] = useState('');
  const [sort, setSort] = useState<SortOption>('relevance');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchMeta, setSearchMeta] = useState<{ total: number; took_ms: number } | null>(null);

  // Debounced search for suggestions
  const fetchSuggestions = useCallback(
    debounce(async (q: string) => {
      if (q.length < 2) {
        setSuggestions([]);
        return;
      }

      try {
        const res = await fetch(`/api/search/suggest?q=${encodeURIComponent(q)}&limit=5`);
        if (res.ok) {
          const data = await res.json();
          setSuggestions(data.suggestions || []);
        }
      } catch {
        // Silently fail for suggestions
      }
    }, 300),
    []
  );

  // Main search
  const performSearch = async () => {
    if (!query.trim()) {
      setResults([]);
      setSearchMeta(null);
      return;
    }

    setIsLoading(true);
    setError(null);
    setShowSuggestions(false);

    try {
      const params = new URLSearchParams({
        q: query,
        sort,
        limit: '50',
      });
      if (language) {
        params.set('language', language);
      }

      const res = await fetch(`/api/search?${params.toString()}`);

      if (!res.ok) {
        if (res.status === 503) {
          throw new Error('Search service unavailable. Elasticsearch may not be connected.');
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

  // Handle input change
  const handleInputChange = (value: string) => {
    setQuery(value);
    fetchSuggestions(value);
    setShowSuggestions(true);
  };

  // Handle suggestion click
  const handleSuggestionClick = (suggestion: Suggestion) => {
    setQuery(suggestion.name);
    setShowSuggestions(false);
    // Trigger search after setting query
    setTimeout(() => performSearch(), 0);
  };

  // Handle form submit
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    performSearch();
  };

  // Handle Enter key
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      performSearch();
    }
    if (e.key === 'Escape') {
      setShowSuggestions(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h2 className="text-2xl font-bold text-foreground">Search Repositories</h2>
        <p className="text-sm text-muted-foreground">
          Find repositories by name or description
        </p>
      </div>

      {/* Search form */}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="flex flex-col gap-4 sm:flex-row">
          {/* Search input with suggestions */}
          <div className="relative flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                value={query}
                onChange={(e) => handleInputChange(e.target.value)}
                onKeyDown={handleKeyDown}
                onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
                onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                placeholder="Search repositories..."
                className="h-10 w-full rounded-md border border-border bg-background pl-10 pr-4 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>

            {/* Suggestions dropdown */}
            {showSuggestions && suggestions.length > 0 && (
              <div className="absolute top-full z-10 mt-1 w-full rounded-md border border-border bg-card shadow-lg">
                {suggestions.map((suggestion) => (
                  <button
                    key={suggestion.name}
                    type="button"
                    onClick={() => handleSuggestionClick(suggestion)}
                    className="flex w-full items-center justify-between px-4 py-2 text-left text-sm hover:bg-muted"
                  >
                    <span className="text-foreground">{suggestion.name}</span>
                    <span className="flex items-center gap-2 text-muted-foreground">
                      {suggestion.language && (
                        <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">
                          {suggestion.language}
                        </span>
                      )}
                      <span className="flex items-center gap-1">
                        <Star className="h-3 w-3" />
                        {suggestion.stars.toLocaleString()}
                      </span>
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Language filter */}
          <input
            type="text"
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            placeholder="Language..."
            className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 sm:w-32"
          />

          {/* Sort selector */}
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortOption)}
            className="h-10 rounded-md border border-border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
          >
            <option value="relevance">Relevance</option>
            <option value="stars">Stars</option>
            <option value="velocity">Velocity</option>
          </select>

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
        <div className="rounded-lg border border-red-200 bg-red-50 p-4">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      {/* Search meta */}
      {searchMeta && !error && (
        <div className="text-sm text-muted-foreground">
          Found {searchMeta.total.toLocaleString()} results in {searchMeta.took_ms}ms
        </div>
      )}

      {/* Results */}
      {results.length > 0 && (
        <div className="space-y-4">
          {results.map((repo) => (
            <div
              key={repo.repo_id}
              className="rounded-lg border border-border bg-card p-4 transition-colors hover:bg-muted/50"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <a
                      href={`https://github.com/${repo.full_name}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-lg font-medium text-foreground hover:text-primary hover:underline"
                    >
                      {repo.full_name}
                    </a>
                    <ExternalLink className="h-4 w-4 text-muted-foreground" />
                  </div>
                  {repo.description && (
                    <p className="mt-1 text-sm text-muted-foreground line-clamp-2">
                      {repo.description}
                    </p>
                  )}
                  <div className="mt-3 flex items-center gap-4 text-sm">
                    {repo.language && (
                      <span className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                        {repo.language}
                      </span>
                    )}
                    <span className="flex items-center gap-1 text-muted-foreground">
                      <Star className="h-4 w-4" />
                      {repo.total_stars.toLocaleString()}
                    </span>
                    <span className="text-muted-foreground">
                      Velocity: {repo.velocity_score.toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Empty state */}
      {!isLoading && !error && query && results.length === 0 && searchMeta && (
        <div className="rounded-lg border border-border bg-card p-6 text-center">
          <p className="text-sm text-muted-foreground">
            No repositories found for &quot;{query}&quot;
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            Try a different search term or remove filters
          </p>
        </div>
      )}

      {/* Initial state */}
      {!query && !isLoading && (
        <div className="rounded-lg border border-dashed border-border p-12 text-center">
          <Search className="mx-auto h-12 w-12 text-muted-foreground/50" />
          <h3 className="mt-4 text-lg font-medium text-foreground">Search repositories</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            Enter a search term to find repositories by name or description
          </p>
        </div>
      )}
    </div>
  );
}
