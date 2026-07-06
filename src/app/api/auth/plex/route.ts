import { NextRequest, NextResponse } from 'next/server';
import { createPlexPin, buildPlexAuthUrl, PLEX_PIN_COOKIE } from '@/lib/auth/plex';

function appUrl(request: NextRequest): string {
  return process.env.APP_URL ?? request.nextUrl.origin;
}

// Entry point for "Sign in with Plex" — a plain link/button pointing here. Creates a Plex
// pin, remembers it in a short-lived cookie, and sends the browser to app.plex.tv/auth.
// Plex forwards back to /api/auth/callback once the user approves.
export async function GET(request: NextRequest) {
  try {
    const pin = await createPlexPin();
    const forwardUrl = new URL('/api/auth/callback', appUrl(request)).toString();
    const authUrl = buildPlexAuthUrl(pin, forwardUrl);

    const response = NextResponse.redirect(authUrl);
    response.cookies.set(PLEX_PIN_COOKIE, String(pin.id), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 600, // 10 minutes — plenty of time to complete the Plex login
    });
    return response;
  } catch (err) {
    console.error('[auth/plex] Failed to start Plex OAuth:', err instanceof Error ? err.message : err);
    return NextResponse.redirect(new URL('/login?error=plex_unreachable', appUrl(request)));
  }
}
