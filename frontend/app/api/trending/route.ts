import { NextRequest, NextResponse } from 'next/server';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const window = searchParams.get('window') || '24h';
  const limit = searchParams.get('limit') || '50';
  const language = searchParams.get('language');

  try {
    const params = new URLSearchParams({ window, limit });
    if (language) {
      params.set('language', language);
    }

    const response = await fetch(`${API_URL}/api/trending?${params}`, {
      headers: {
        'Content-Type': 'application/json',
      },
      next: { revalidate: 30 }, // Cache for 30 seconds
    });

    if (!response.ok) {
      console.error('FastAPI trending error:', response.status);
      return NextResponse.json({
        data: [],
        window,
        timestamp: new Date().toISOString(),
        total: 0,
      });
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Trending API proxy error:', error);
    return NextResponse.json({
      data: [],
      window,
      timestamp: new Date().toISOString(),
      total: 0,
    });
  }
}
