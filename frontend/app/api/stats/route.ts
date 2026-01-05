import { NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL!);

export async function GET() {
  try {
    // Get stats for the last hour
    const stats = await sql`
      SELECT
        COUNT(*)::int as total_events,
        COUNT(DISTINCT repo_id)::int as active_repos,
        (
          SELECT language FROM repositories
          WHERE repo_id IN (
            SELECT repo_id FROM repo_metrics
            WHERE timestamp > NOW() - INTERVAL '1 hour'
          )
          AND language IS NOT NULL
          GROUP BY language
          ORDER BY COUNT(*) DESC
          LIMIT 1
        ) as top_language
      FROM repo_metrics
      WHERE timestamp > NOW() - INTERVAL '1 hour'
    `;

    // Calculate events per minute (last 5 minutes)
    const recentEvents = await sql`
      SELECT COUNT(*)::int as count
      FROM repo_metrics
      WHERE timestamp > NOW() - INTERVAL '5 minutes'
    `;

    const eventsPerMin = Math.round((recentEvents[0]?.count || 0) / 5);

    return NextResponse.json({
      total_events: stats[0]?.total_events || 0,
      active_repos: stats[0]?.active_repos || 0,
      top_language: stats[0]?.top_language || 'Unknown',
      events_per_min: eventsPerMin,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Database error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch stats' },
      { status: 500 }
    );
  }
}
