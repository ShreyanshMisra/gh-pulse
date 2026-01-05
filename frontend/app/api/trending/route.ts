import { NextRequest, NextResponse } from 'next/server';

interface GitHubRepo {
  id: number;
  full_name: string;
  name: string;
  description: string | null;
  language: string | null;
  stargazers_count: number;
  forks_count: number;
  watchers_count: number;
  open_issues_count: number;
  created_at: string;
  updated_at: string;
  pushed_at: string;
  topics: string[];
  owner: {
    login: string;
    avatar_url: string;
  };
}

interface GitHubSearchResponse {
  total_count: number;
  incomplete_results: boolean;
  items: GitHubRepo[];
}

// Map window param to days for GitHub search
const TIME_WINDOWS: Record<string, number> = {
  '1h': 1,
  '6h': 1,
  '12h': 1,
  '24h': 1,
  '7d': 7,
  '30d': 30,
};

// Cache for trending data
let trendingCache: {
  data: Map<string, { repos: GitHubRepo[]; timestamp: number }>;
} = { data: new Map() };

const CACHE_TTL = 60000; // 1 minute

function getDateString(daysAgo: number): string {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  return date.toISOString().split('T')[0];
}

// Calculate velocity score - higher for newer, actively updated repos
function calculateVelocity(repo: GitHubRepo): number {
  const now = new Date();
  const pushed = new Date(repo.pushed_at);
  const created = new Date(repo.created_at);

  // Days since last push (lower is better)
  const daysSincePush = Math.max(1, (now.getTime() - pushed.getTime()) / (1000 * 60 * 60 * 24));

  // Repo age in days
  const repoAge = Math.max(1, (now.getTime() - created.getTime()) / (1000 * 60 * 60 * 24));

  // Stars per day
  const starsPerDay = repo.stargazers_count / repoAge;

  // Activity score (more recent = higher)
  const recencyScore = Math.max(0, 10 - daysSincePush) / 10;

  // Combined velocity: favors new repos with high activity
  const velocity = (starsPerDay * 0.5 + recencyScore * 5) * (1 + Math.log10(repo.stargazers_count + 1) * 0.1);

  return Math.round(velocity * 100) / 100;
}

async function fetchTrendingRepos(days: number, language?: string, limit: number = 50): Promise<GitHubRepo[]> {
  const cacheKey = `${days}-${language || 'all'}`;
  const cached = trendingCache.data.get(cacheKey);
  const now = Date.now();

  if (cached && (now - cached.timestamp) < CACHE_TTL) {
    return cached.repos.slice(0, limit);
  }

  try {
    // Build search query for repos created or updated recently with stars
    const dateStr = getDateString(days);
    let query = `pushed:>${dateStr} stars:>10`;

    if (language) {
      query += ` language:${language}`;
    }

    const url = new URL('https://api.github.com/search/repositories');
    url.searchParams.set('q', query);
    url.searchParams.set('sort', 'stars');
    url.searchParams.set('order', 'desc');
    url.searchParams.set('per_page', '100');

    const response = await fetch(url.toString(), {
      headers: {
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'GitHub-Activity-Stream-Analyzer',
        ...(process.env.GITHUB_TOKEN ? { 'Authorization': `token ${process.env.GITHUB_TOKEN}` } : {}),
      },
      next: { revalidate: 60 },
    });

    if (!response.ok) {
      console.error('GitHub API error:', response.status, await response.text());
      return cached?.repos.slice(0, limit) || [];
    }

    const data: GitHubSearchResponse = await response.json();
    trendingCache.data.set(cacheKey, { repos: data.items, timestamp: now });

    return data.items.slice(0, limit);
  } catch (error) {
    console.error('Failed to fetch trending repos:', error);
    return cached?.repos.slice(0, limit) || [];
  }
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const window = searchParams.get('window') || '24h';
  const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100);
  const language = searchParams.get('language') || undefined;

  const days = TIME_WINDOWS[window] || 1;

  try {
    const repos = await fetchTrendingRepos(days, language, limit);

    const data = repos.map(repo => ({
      repo_id: repo.id,
      repo_name: repo.full_name,
      language: repo.language,
      description: repo.description,
      total_stars: repo.stargazers_count,
      forks: repo.forks_count,
      open_issues: repo.open_issues_count,
      stars_gained: Math.round(repo.stargazers_count * (1 / Math.max(1, days)) * 0.1), // Estimate
      velocity_score: calculateVelocity(repo),
      event_count: repo.watchers_count + repo.forks_count + repo.open_issues_count,
      topics: repo.topics,
      owner: {
        login: repo.owner.login,
        avatar_url: repo.owner.avatar_url,
      },
      pushed_at: repo.pushed_at,
      created_at: repo.created_at,
    }));

    // Sort by velocity score
    data.sort((a, b) => b.velocity_score - a.velocity_score);

    return NextResponse.json({
      data,
      window,
      timestamp: new Date().toISOString(),
      total: data.length,
    });
  } catch (error) {
    console.error('Trending API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch trending data' },
      { status: 500 }
    );
  }
}
