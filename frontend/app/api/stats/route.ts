import { NextResponse } from 'next/server';

interface GitHubEvent {
  id: string;
  type: string;
  repo: {
    id: number;
    name: string;
  };
  created_at: string;
  payload?: {
    action?: string;
    ref_type?: string;
    size?: number;
  };
}

// Cache for GitHub events to reduce API calls
let eventsCache: {
  data: GitHubEvent[];
  timestamp: number;
} | null = null;

const CACHE_TTL = 30000; // 30 seconds

async function fetchGitHubEvents(): Promise<GitHubEvent[]> {
  const now = Date.now();

  if (eventsCache && (now - eventsCache.timestamp) < CACHE_TTL) {
    return eventsCache.data;
  }

  try {
    const response = await fetch('https://api.github.com/events?per_page=100', {
      headers: {
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'GitHub-Activity-Stream-Analyzer',
        ...(process.env.GITHUB_TOKEN ? { 'Authorization': `token ${process.env.GITHUB_TOKEN}` } : {}),
      },
      next: { revalidate: 30 },
    });

    if (!response.ok) {
      console.error('GitHub API error:', response.status);
      return eventsCache?.data || [];
    }

    const data: GitHubEvent[] = await response.json();
    eventsCache = { data, timestamp: now };
    return data;
  } catch (error) {
    console.error('Failed to fetch GitHub events:', error);
    return eventsCache?.data || [];
  }
}

// Detect language from repo name (heuristic)
function inferLanguage(repoName: string): string {
  const name = repoName.toLowerCase();
  if (name.includes('typescript') || name.includes('-ts') || name.endsWith('.ts')) return 'TypeScript';
  if (name.includes('javascript') || name.includes('-js') || name.endsWith('.js')) return 'JavaScript';
  if (name.includes('python') || name.includes('-py')) return 'Python';
  if (name.includes('rust') || name.includes('-rs')) return 'Rust';
  if (name.includes('golang') || name.includes('-go')) return 'Go';
  if (name.includes('java') && !name.includes('javascript')) return 'Java';
  if (name.includes('csharp') || name.includes('dotnet')) return 'C#';
  if (name.includes('ruby') || name.includes('-rb')) return 'Ruby';
  if (name.includes('swift')) return 'Swift';
  if (name.includes('kotlin')) return 'Kotlin';
  if (name.includes('cpp') || name.includes('c++')) return 'C++';
  if (name.includes('react')) return 'TypeScript';
  if (name.includes('vue')) return 'JavaScript';
  if (name.includes('angular')) return 'TypeScript';
  if (name.includes('next')) return 'TypeScript';
  if (name.includes('node')) return 'JavaScript';
  if (name.includes('django') || name.includes('flask')) return 'Python';
  if (name.includes('rails')) return 'Ruby';
  if (name.includes('spring')) return 'Java';
  return 'Unknown';
}

export async function GET() {
  try {
    const events = await fetchGitHubEvents();

    // Calculate stats
    const totalEvents = events.length;
    const uniqueRepos = new Set(events.map(e => e.repo.id)).size;

    // Calculate events per minute based on event timestamps
    const now = new Date();
    const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);
    const recentEvents = events.filter(e => new Date(e.created_at) > fiveMinutesAgo);
    const eventsPerMin = Math.round(recentEvents.length / 5);

    // Infer top language from repo names
    const languageCounts: Record<string, number> = {};
    events.forEach(event => {
      const lang = inferLanguage(event.repo.name);
      if (lang !== 'Unknown') {
        languageCounts[lang] = (languageCounts[lang] || 0) + 1;
      }
    });

    const topLanguage = Object.entries(languageCounts)
      .sort((a, b) => b[1] - a[1])[0]?.[0] || 'TypeScript';

    // Event type breakdown
    const eventTypeCounts: Record<string, number> = {};
    events.forEach(event => {
      eventTypeCounts[event.type] = (eventTypeCounts[event.type] || 0) + 1;
    });

    // Calculate stars (WatchEvents)
    const starEvents = events.filter(e => e.type === 'WatchEvent').length;
    const forkEvents = events.filter(e => e.type === 'ForkEvent').length;
    const pushEvents = events.filter(e => e.type === 'PushEvent').length;
    const prEvents = events.filter(e => e.type === 'PullRequestEvent').length;

    return NextResponse.json({
      total_events: totalEvents,
      active_repos: uniqueRepos,
      top_language: topLanguage,
      events_per_min: eventsPerMin,
      star_events: starEvents,
      fork_events: forkEvents,
      push_events: pushEvents,
      pr_events: prEvents,
      event_breakdown: eventTypeCounts,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Stats API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch stats' },
      { status: 500 }
    );
  }
}
