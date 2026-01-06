import { NextRequest, NextResponse } from 'next/server';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const window = searchParams.get('window') || '24h';
  const limit = searchParams.get('limit') || '20';

  try {
    const params = new URLSearchParams({ window, limit });

    const response = await fetch(`${API_URL}/api/languages?${params}`, {
      headers: {
        'Content-Type': 'application/json',
      },
      next: { revalidate: 60 }, // Cache for 60 seconds
    });

    if (!response.ok) {
      console.error('FastAPI languages error:', response.status);
      return NextResponse.json({
        data: [],
        window,
        timestamp: new Date().toISOString(),
      });
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Languages API proxy error:', error);
    return NextResponse.json({
      data: [],
      window,
      timestamp: new Date().toISOString(),
    });
  }
}
