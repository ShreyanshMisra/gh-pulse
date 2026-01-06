import { NextRequest, NextResponse } from 'next/server';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const query = searchParams.get('q');
  const sort = searchParams.get('sort') || 'relevance';
  const limit = searchParams.get('limit') || '30';
  const language = searchParams.get('language');

  // Return empty results for short queries
  if (!query || query.length < 2) {
    return NextResponse.json({
      query: query || '',
      results: [],
      total: 0,
      took_ms: 0,
    });
  }

  try {
    const params = new URLSearchParams({ q: query, sort, limit });
    if (language) {
      params.set('language', language);
    }

    const response = await fetch(`${API_URL}/api/search?${params}`, {
      headers: {
        'Content-Type': 'application/json',
      },
      next: { revalidate: 30 }, // Cache for 30 seconds
    });

    if (!response.ok) {
      // Handle 503 (Elasticsearch unavailable) gracefully
      if (response.status === 503) {
        return NextResponse.json({
          query,
          results: [],
          total: 0,
          took_ms: 0,
          error: 'Search service unavailable',
        });
      }
      console.error('FastAPI search error:', response.status);
      return NextResponse.json({
        query,
        results: [],
        total: 0,
        took_ms: 0,
      });
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Search API proxy error:', error);
    return NextResponse.json({
      query,
      results: [],
      total: 0,
      took_ms: 0,
    });
  }
}
