import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL!);

const TIME_WINDOWS: Record<string, string> = {
  '1h': '1 hour',
  '6h': '6 hours',
  '12h': '12 hours',
  '24h': '24 hours',
  '7d': '7 days',
  '30d': '30 days',
};

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const window = searchParams.get('window') || '24h';
  const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100);
  const language = searchParams.get('language');

  const interval = TIME_WINDOWS[window] || '24 hours';

  try {
    let query = `
      SELECT
        r.repo_id,
        r.full_name as repo_name,
        r.language,
        r.description,
        r.total_stars,
        COALESCE(SUM(m.stars_delta), 0)::int as stars_gained,
        COALESCE(AVG(m.velocity_score), 0) as velocity_score,
        COUNT(m.*)::int as event_count
      FROM repositories r
      LEFT JOIN repo_metrics m ON r.repo_id = m.repo_id
        AND m.timestamp > NOW() - INTERVAL '${interval}'
      WHERE 1=1
    `;

    if (language) {
      query += ` AND LOWER(r.language) = LOWER('${language}')`;
    }

    query += `
      GROUP BY r.repo_id, r.full_name, r.language, r.description, r.total_stars
      HAVING COUNT(m.*) > 0
      ORDER BY velocity_score DESC, stars_gained DESC
      LIMIT ${limit}
    `;

    const rows = await sql(query);

    return NextResponse.json({
      data: rows,
      window,
      timestamp: new Date().toISOString(),
      total: rows.length,
    });
  } catch (error) {
    console.error('Database error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch trending data' },
      { status: 500 }
    );
  }
}
