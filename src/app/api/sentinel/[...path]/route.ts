import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { sentinelFetchRaw } from '@/lib/sentinel/client';

// The only way client components ever reach Sentinel — the read key lives entirely in
// lib/sentinel/client.ts, called server-side only. This route also carries the tier
// boundary between admin and regular users: the read-tier Sentinel key technically has
// access to everyone's data, so Atrium Stats (not Sentinel) is responsible for making sure
// a regular user can never pull another user's detail data through this proxy.
//
// Only GET is exposed — every Sentinel read Atrium Stats needs is a GET, and not
// implementing POST/PUT/DELETE here means admin-tier Sentinel operations are never
// reachable through this app by construction, not by an enforcement check that could drift.

type Access = 'admin' | 'self-or-admin' | 'any';

// Explicit allow-list of recognized Sentinel read paths — an unlisted path is rejected
// rather than silently forwarded, so a new Sentinel endpoint never becomes reachable here
// until someone deliberately decides its access tier.
function classify(path: string[]): { access: Access; selfIdIndex?: number } | null {
  const [first, second] = path;

  if (first === 'users' && path.length <= 2) return { access: 'admin' };
  if (first === 'libraries' && path.length === 1) return { access: 'admin' };
  if (first === 'geo' && path.length === 2) return { access: 'admin' };
  if (first === 'history' && path.length === 1) return { access: 'admin' };
  if (first === 'stats' && second === 'server' && path.length === 2) return { access: 'admin' };
  if (first === 'stats' && second === 'user' && path.length === 3) return { access: 'self-or-admin', selfIdIndex: 2 };
  // stats/leaderboard is deliberately absent — it returns every user's real numbers, and
  // the leaderboard page computes anonymized rank server-side via lib/sentinel/stats.ts
  // directly rather than through this client-facing proxy. Do not add a rule for it here.
  if (first === 'sessions' && second === 'live' && path.length === 2) return { access: 'admin' };
  // Metadata and artwork carry no per-user data — safe for either tier.
  if (first === 'metadata' && path.length === 2) return { access: 'any' };
  if (first === 'artwork' && path.length === 2) return { access: 'any' };

  return null;
}

export async function GET(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const { path } = await context.params;
  const rule = classify(path);
  if (!rule) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  if (rule.access === 'admin' && !session.isAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  if (rule.access === 'self-or-admin' && !session.isAdmin) {
    const requestedId = path[rule.selfIdIndex!];
    if (requestedId !== String(session.sentinelUserId)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
  }

  const sentinelPath = `/${path.join('/')}${request.nextUrl.search}`;

  try {
    const sentinelRes = await sentinelFetchRaw(sentinelPath);

    const headers = new Headers();
    const contentType = sentinelRes.headers.get('content-type');
    if (contentType) headers.set('content-type', contentType);
    const cacheControl = sentinelRes.headers.get('cache-control');
    if (cacheControl) headers.set('cache-control', cacheControl);

    return new NextResponse(sentinelRes.body, { status: sentinelRes.status, headers });
  } catch (err) {
    console.error('[api/sentinel] Proxy request failed:', err instanceof Error ? err.message : err);
    return NextResponse.json({ error: 'Sentinel is unreachable' }, { status: 502 });
  }
}
