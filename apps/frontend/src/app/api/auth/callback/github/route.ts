import { NextRequest, NextResponse } from 'next/server';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code');

  if (!code) {
    return NextResponse.redirect(new URL('/login?error=Missing+authorization+code', request.url));
  }

  try {
    // Proxy the callback to the backend
    const backendUrl = `${API_BASE}/api/v1/auth/github/callback?code=${encodeURIComponent(code)}`;
    const res = await fetch(backendUrl, { redirect: 'manual' });

    // The backend responds with a redirect containing the token
    const location = res.headers.get('location');
    if (location) {
      return NextResponse.redirect(new URL(location));
    }

    // Fallback: if backend returned JSON instead of redirect
    if (res.ok) {
      const data = await res.json();
      if (data.access_token) {
        return NextResponse.redirect(new URL(`/dashboard?token=${data.access_token}`, request.url));
      }
    }

    return NextResponse.redirect(new URL('/login?error=GitHub+authentication+failed', request.url));
  } catch {
    return NextResponse.redirect(new URL('/login?error=GitHub+authentication+failed', request.url));
  }
}
