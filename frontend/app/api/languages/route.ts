import { NextRequest, NextResponse } from 'next/server';

interface GitHubRepo {
  id: number;
  full_name: string;
  language: string | null;
  stargazers_count: number;
  forks_count: number;
  watchers_count: number;
  pushed_at: string;
}

interface GitHubSearchResponse {
  total_count: number;
  items: GitHubRepo[];
}

const TIME_WINDOWS: Record<string, number> = {
  '1h': 1,
  '6h': 1,
  '12h': 1,
  '24h': 1,
  '7d': 7,
  '30d': 30,
};

// Popular languages to search for
const LANGUAGES = [
  'TypeScript', 'JavaScript', 'Python', 'Rust', 'Go',
  'Java', 'C++', 'C#', 'Ruby', 'Swift', 'Kotlin',
  'PHP', 'Scala', 'Dart', 'Elixir', 'Haskell',
  'Lua', 'R', 'Julia', 'Zig'
];

// Cache for language data
let languagesCache: {
  data: Map<string, { stats: LanguageStats[]; timestamp: number }>;
} = { data: new Map() };

interface LanguageStats {
  language: string;
  repo_count: number;
  total_stars_gained: number;
  event_count: number;
  avg_velocity: number;
  top_repos: string[];
}

const CACHE_TTL = 120000; // 2 minutes

function getDateString(daysAgo: number): string {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  return date.toISOString().split('T')[0];
}

async function fetchLanguageStats(language: string, days: number): Promise<GitHubRepo[]> {
  try {
    const dateStr = getDateString(days);
    const query = `pushed:>${dateStr} language:${language} stars:>5`;

    const url = new URL('https://api.github.com/search/repositories');
    url.searchParams.set('q', query);
    url.searchParams.set('sort', 'stars');
    url.searchParams.set('order', 'desc');
    url.searchParams.set('per_page', '30');

    const response = await fetch(url.toString(), {
      headers: {
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'GitHub-Activity-Stream-Analyzer',
        ...(process.env.GITHUB_TOKEN ? { 'Authorization': `token ${process.env.GITHUB_TOKEN}` } : {}),
      },
      next: { revalidate: 120 },
    });

    if (!response.ok) {
      return [];
    }

    const data: GitHubSearchResponse = await response.json();
    return data.items;
  } catch {
    return [];
  }
}

async function getAllLanguageStats(days: number): Promise<LanguageStats[]> {
  const cacheKey = `languages-${days}`;
  const cached = languagesCache.data.get(cacheKey);
  const now = Date.now();

  if (cached && (now - cached.timestamp) < CACHE_TTL) {
    return cached.stats;
  }

  // Fetch data for all languages in parallel (limited batches to avoid rate limiting)
  const results: LanguageStats[] = [];

  // Process in batches of 5 to avoid rate limiting
  for (let i = 0; i < LANGUAGES.length; i += 5) {
    const batch = LANGUAGES.slice(i, i + 5);
    const batchPromises = batch.map(async (lang) => {
      const repos = await fetchLanguageStats(lang, days);

      if (repos.length === 0) return null;

      const totalStars = repos.reduce((sum, r) => sum + r.stargazers_count, 0);
      const totalActivity = repos.reduce((sum, r) => sum + r.forks_count + r.watchers_count, 0);

      // Calculate average velocity
      const avgVelocity = repos.reduce((sum, r) => {
        const age = Math.max(1, (Date.now() - new Date(r.pushed_at).getTime()) / (1000 * 60 * 60 * 24));
        return sum + r.stargazers_count / age;
      }, 0) / repos.length;

      return {
        language: lang,
        repo_count: repos.length,
        total_stars_gained: Math.round(totalStars * 0.1 / Math.max(1, days)), // Estimate daily gain
        event_count: totalActivity,
        avg_velocity: Math.round(avgVelocity * 100) / 100,
        top_repos: repos.slice(0, 3).map(r => r.full_name),
      };
    });

    const batchResults = await Promise.all(batchPromises);
    results.push(...batchResults.filter((r): r is LanguageStats => r !== null));

    // Small delay between batches
    if (i + 5 < LANGUAGES.length) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  // Sort by event count
  results.sort((a, b) => b.event_count - a.event_count);

  languagesCache.data.set(cacheKey, { stats: results, timestamp: now });
  return results;
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const window = searchParams.get('window') || '24h';
  const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 50);

  const days = TIME_WINDOWS[window] || 1;

  try {
    const stats = await getAllLanguageStats(days);

    return NextResponse.json({
      data: stats.slice(0, limit),
      window,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Languages API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch language data' },
      { status: 500 }
    );
  }
}
