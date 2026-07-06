import { NextRequest, NextResponse } from 'next/server';

const SESSION_COOKIE = 'atrium_stats_session';

// Lightweight, cookie-presence-only redirect for fast UX. This is NOT the authorization
// boundary — Middleware runs on the Edge runtime and can't reach the SQLite-backed session
// store (better-sqlite3 is a native Node addon). The real check (session validity, expiry,
// admin vs. user tier) happens server-side in each protected layout via getSession() —
// see app/dashboard/layout.tsx and app/me/layout.tsx.
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hasSessionCookie = request.cookies.has(SESSION_COOKIE);

  const isPublicPath =
    pathname === '/login' ||
    pathname.startsWith('/api/auth') ||
    pathname.startsWith('/wrapped/share');

  if (!hasSessionCookie && !isPublicPath) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  if (hasSessionCookie && pathname === '/login') {
    return NextResponse.redirect(new URL('/', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
