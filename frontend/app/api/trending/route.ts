import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL!);

// Map window param to hours for simpler SQL
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
  const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100);
  const language = searchParams.get('language');

  const hours = TIME_WINDOWS[window] || 24;

  try {
    let rows;

    if (language) {
      rows = await sql`
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
          AND m.timestamp > NOW() - INTERVAL '1 hour' * ${hours}
        WHERE LOWER(r.language) = LOWER(${language})
        GROUP BY r.repo_id, r.full_name, r.language, r.description, r.total_stars
        HAVING COUNT(m.*) > 0
        ORDER BY velocity_score DESC, stars_gained DESC
        LIMIT ${limit}
      `;
    } else {
      rows = await sql`
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
          AND m.timestamp > NOW() - INTERVAL '1 hour' * ${hours}
        GROUP BY r.repo_id, r.full_name, r.language, r.description, r.total_stars
        HAVING COUNT(m.*) > 0
        ORDER BY velocity_score DESC, stars_gained DESC
        LIMIT ${limit}
      `;
    }

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
