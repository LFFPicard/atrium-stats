import { NextRequest, NextResponse } from 'next/server';

const SESSION_COOKIE = 'atrium_stats_session';

// Lightweight, cookie-presence-only redirect for fast UX. This is NOT the authorization
// boundary — Middleware is kept on its default (Edge) runtime, where the SQLite-backed
// session store (better-sqlite3, a native Node addon) isn't reachable. The real check (session validity, expiry,
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
    // API routes get a JSON 401 matching the shape route handlers return for an
    // invalid cookie; only page routes redirect to /login.
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }
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
