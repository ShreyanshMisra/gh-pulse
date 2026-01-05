import { NextRequest, NextResponse } from 'next/server';

interface GitHubRepo {
  id: number;
  full_name: string;
  name: string;
  description: string | null;
  language: string | null;
  stargazers_count: number;
  forks_count: number;
  updated_at: string;
  pushed_at: string;
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

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const query = searchParams.get('q');
  const sort = searchParams.get('sort') || 'stars';
  const limit = Math.min(parseInt(searchParams.get('limit') || '30'), 100);
  const language = searchParams.get('language');

  if (!query || query.length < 2) {
    return NextResponse.json({
      query: query || '',
      results: [],
      total: 0,
      took_ms: 0,
    });
  }

  const startTime = Date.now();

  try {
    // Build search query
    let searchQuery = query;
    if (language) {
      searchQuery += ` language:${language}`;
    }

    const url = new URL('https://api.github.com/search/repositories');
    url.searchParams.set('q', searchQuery);
    url.searchParams.set('sort', sort === 'relevance' ? 'best-match' : sort);
    url.searchParams.set('order', 'desc');
    url.searchParams.set('per_page', limit.toString());

    const response = await fetch(url.toString(), {
      headers: {
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'GitHub-Activity-Stream-Analyzer',
        ...(process.env.GITHUB_TOKEN ? { 'Authorization': `token ${process.env.GITHUB_TOKEN}` } : {}),
      },
      next: { revalidate: 30 },
    });

    if (!response.ok) {
      if (response.status === 403) {
        return NextResponse.json(
          { error: 'Rate limit exceeded. Please try again later.' },
          { status: 503 }
        );
      }
      throw new Error(`GitHub API error: ${response.status}`);
    }

    const data: GitHubSearchResponse = await response.json();

    const results = data.items.map(repo => ({
      repo_id: repo.id,
      full_name: repo.full_name,
      description: repo.description,
      language: repo.language,
      total_stars: repo.stargazers_count,
      forks: repo.forks_count,
      velocity_score: calculateVelocity(repo),
      score: repo.stargazers_count,
      owner: {
        login: repo.owner.login,
        avatar_url: repo.owner.avatar_url,
      },
      updated_at: repo.updated_at,
    }));

    const tookMs = Date.now() - startTime;

    return NextResponse.json({
      query,
      results,
      total: data.total_count,
      took_ms: tookMs,
    });
  } catch (error) {
    console.error('Search API error:', error);
    return NextResponse.json(
      { error: 'Search failed', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

function calculateVelocity(repo: GitHubRepo): number {
  const now = new Date();
  const pushed = new Date(repo.pushed_at);
  const daysSincePush = Math.max(1, (now.getTime() - pushed.getTime()) / (1000 * 60 * 60 * 24));
  const recencyScore = Math.max(0, 10 - daysSincePush) / 10;
  const velocity = (repo.stargazers_count / 1000) * recencyScore + recencyScore * 2;
  return Math.round(velocity * 100) / 100;
}
