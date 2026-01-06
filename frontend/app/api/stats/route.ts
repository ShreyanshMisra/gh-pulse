import { NextResponse } from 'next/server';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export async function GET() {
  try {
    const response = await fetch(`${API_URL}/api/stats`, {
      headers: {
        'Content-Type': 'application/json',
      },
      next: { revalidate: 10 }, // Cache for 10 seconds
    });

    if (!response.ok) {
      console.error('FastAPI stats error:', response.status);
      // Return fallback data so dashboard doesn't break
      return NextResponse.json({
        total_events: 0,
        active_repos: 0,
        top_language: 'Unknown',
        events_per_min: 0,
        star_events: 0,
        fork_events: 0,
        push_events: 0,
        pr_events: 0,
        event_breakdown: {},
        timestamp: new Date().toISOString(),
      });
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Stats API proxy error:', error);
    // Return fallback data so dashboard doesn't break
    return NextResponse.json({
      total_events: 0,
      active_repos: 0,
      top_language: 'Unknown',
      events_per_min: 0,
      star_events: 0,
      fork_events: 0,
      push_events: 0,
      pr_events: 0,
      event_breakdown: {},
      timestamp: new Date().toISOString(),
    });
  }
}
