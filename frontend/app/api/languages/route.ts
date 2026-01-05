import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL!);

const TIME_WINDOWS: Record<string, number> = {
  '1h': 1,
  '6h': 6,
  '12h': 12,
  '24h': 24,
  '7d': 168,
  '30d': 720,
};

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const window = searchParams.get('window') || '24h';
  const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 50);

  const hours = TIME_WINDOWS[window] || 24;

  try {
    const rows = await sql`
      SELECT
        r.language,
        COUNT(DISTINCT r.repo_id)::int as repo_count,
        COALESCE(SUM(m.stars_delta), 0)::int as total_stars_gained,
        COUNT(m.*)::int as event_count,
        COALESCE(AVG(m.velocity_score), 0) as avg_velocity
      FROM repositories r
      LEFT JOIN repo_metrics m ON r.repo_id = m.repo_id
        AND m.timestamp > NOW() - INTERVAL '1 hour' * ${hours}
      WHERE r.language IS NOT NULL
      GROUP BY r.language
      HAVING COUNT(m.*) > 0
      ORDER BY event_count DESC, total_stars_gained DESC
      LIMIT ${limit}
    `;

    return NextResponse.json({
      data: rows,
      window,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Database error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch language data' },
      { status: 500 }
    );
  }
}
