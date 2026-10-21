import { isIP } from 'node:net';

// Access rules for the client-facing /api/sentinel/[...path] proxy. Kept free of Next.js /
// session imports so it can be unit-tested directly (see tests/proxyRules.test.mjs).
//
// Every segment is validated against a strict per-route shape BEFORE the path is rebuilt.
// Next.js hands catch-all params over already URL-decoded, so a request like
// `/api/sentinel/metadata/..%2Fhistory` arrives as ['metadata', '../history'] — if that
// were joined back together unchecked, fetch() would normalize `/v1/metadata/../history`
// to `/v1/history` and an 'any'-tier route would become a tunnel to admin-only data.

export type Access = 'admin' | 'self-or-admin' | 'any';

export type ProxyRule = {
  access: Access;
  // Index of the path segment holding a Sentinel user id that a non-admin may only
  // request for themselves.
  selfIdIndex?: number;
  // Query params forwarded to Sentinel for this route — anything else is dropped.
  query: readonly string[];
};

const INTEGER = /^\d+$/;
// Plex rating keys are numeric.
const RATING_KEY = INTEGER;

const HISTORY_QUERY = ['user_id', 'from', 'to', 'year', 'limit', 'offset', 'complete'] as const;
const STATS_QUERY = ['year', 'period'] as const;
const ARTWORK_QUERY = ['type'] as const;

// Explicit allow-list of recognized Sentinel read paths — an unlisted path is rejected
// rather than silently forwarded, so a new Sentinel endpoint never becomes reachable here
// until someone deliberately decides its access tier.
export function classify(path: string[]): ProxyRule | null {
  const [first, second, third] = path;

  if (first === 'users' && path.length === 1) return { access: 'admin', query: [] };
  if (first === 'users' && path.length === 2 && INTEGER.test(second)) return { access: 'admin', query: [] };
  if (first === 'libraries' && path.length === 1) return { access: 'admin', query: [] };
  if (first === 'geo' && path.length === 2 && isIP(second) !== 0) return { access: 'admin', query: [] };
  if (first === 'history' && path.length === 1) return { access: 'admin', query: HISTORY_QUERY };
  if (first === 'stats' && second === 'server' && path.length === 2) return { access: 'admin', query: STATS_QUERY };
  if (first === 'stats' && second === 'user' && path.length === 3 && INTEGER.test(third)) {
    return { access: 'self-or-admin', selfIdIndex: 2, query: STATS_QUERY };
  }
  // stats/leaderboard is deliberately absent — it returns every user's real numbers, and
  // the leaderboard page computes anonymized rank server-side via lib/sentinel/stats.ts
  // directly rather than through this client-facing proxy. Do not add a rule for it here.
  if (first === 'sessions' && second === 'live' && path.length === 2) return { access: 'admin', query: [] };
  // Metadata and artwork carry no per-user data — safe for either tier.
  if (first === 'metadata' && path.length === 2 && RATING_KEY.test(second)) return { access: 'any', query: [] };
  if (first === 'artwork' && path.length === 2 && RATING_KEY.test(second)) return { access: 'any', query: ARTWORK_QUERY };

  return null;
}

/** Rebuilds the Sentinel path (no `/v1` prefix) from already-classified segments. */
export function buildSentinelPath(path: string[], rule: ProxyRule, search: URLSearchParams): string {
  // Segments are already validated by classify(); encoding is a second, independent guard.
  const pathname = `/${path.map(encodeURIComponent).join('/')}`;

  const forwarded = new URLSearchParams();
  for (const key of rule.query) {
    const value = search.get(key);
    if (value !== null) forwarded.set(key, value);
  }
  const qs = forwarded.toString();
  return qs ? `${pathname}?${qs}` : pathname;
}
