import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { sentinelFetchRaw } from '@/lib/sentinel/client';
import { classify, buildSentinelPath } from '@/lib/sentinel/proxyRules';

// The only way client components ever reach Sentinel — the read key lives entirely in
// lib/sentinel/client.ts, called server-side only. This route also carries the tier
// boundary between admin and regular users: the read-tier Sentinel key technically has
// access to everyone's data, so Atrium Stats (not Sentinel) is responsible for making sure
// a regular user can never pull another user's detail data through this proxy.
//
// Only GET is exposed — every Sentinel read Atrium Stats needs is a GET, and not
// implementing POST/PUT/DELETE here means admin-tier Sentinel operations are never
// reachable through this app by construction, not by an enforcement check that could drift.

// The allow-list itself, plus segment validation and query filtering, lives in
// lib/sentinel/proxyRules.ts so it can be unit-tested without a running server.

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

  const sentinelPath = buildSentinelPath(path, rule, request.nextUrl.searchParams);

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
