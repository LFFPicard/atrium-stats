import { NextRequest, NextResponse } from 'next/server';
import { waitForPlexPin, getPlexAccount, ownsPlexServer, PLEX_PIN_COOKIE, type PlexAccount } from '@/lib/auth/plex';
import { findSentinelUser, type SentinelUserMatch } from '@/lib/sentinel/client';
import { createSession } from '@/lib/auth/session';
import { describeError } from '@/lib/errors';

function appUrl(request: NextRequest): string {
  return process.env.APP_URL ?? request.nextUrl.origin;
}

function redirectClearingPin(url: string, request: NextRequest): NextResponse {
  const response = NextResponse.redirect(new URL(url, appUrl(request)));
  response.cookies.delete(PLEX_PIN_COOKIE);
  return response;
}

// Plex forwards the browser here once the user approves the sign-in request. We poll the
// pending pin for the resulting auth token, verify it against Plex, then look up the
// matching Sentinel user (see matchSentinelUser in lib/sentinel/client.ts for the rules):
//
//   1. exact Plex id match;
//   2. username match against an unreconciled Tautulli placeholder row — never admin
//      (the Auth Architecture edge case in ATRIUM_STATS.md);
//   3. owner fallback — username match against Sentinel's owner row, only when plex.tv
//      confirms (with this user's own token) that the account owns a Plex server.
//      Sentinel stores the owner under the server-local id "1", so the owner can never
//      match by plex.tv account id.
//
// Each step logs which service failed (Plex or Sentinel) and the underlying cause, so a
// sign-in failure is diagnosable from the log instead of a bare "fetch failed".
export async function GET(request: NextRequest) {
  const pinIdRaw = request.cookies.get(PLEX_PIN_COOKIE)?.value;
  if (!pinIdRaw) {
    return redirectClearingPin('/login?error=session_expired', request);
  }

  const pinId = parseInt(pinIdRaw, 10);

  let authToken: string | null;
  let account: PlexAccount;
  try {
    authToken = await waitForPlexPin(pinId);
    if (!authToken) {
      return redirectClearingPin('/login?error=pin_timeout', request);
    }
    account = await getPlexAccount(authToken);
  } catch (err) {
    console.error('[auth/callback] Plex sign-in failed (plex.tv pin/account):', describeError(err));
    return redirectClearingPin('/login?error=plex_unreachable', request);
  }

  // Set if the owner fallback had to ask plex.tv and that request failed — kept separate
  // so a plex.tv outage is not reported as a Sentinel one.
  let plexResourcesError: unknown = null;
  const token = authToken;
  const checkOwnsPlexServer = async (): Promise<boolean> => {
    try {
      return await ownsPlexServer(token);
    } catch (err) {
      plexResourcesError = err;
      return false; // cannot confirm ownership → the owner fallback does not apply
    }
  };

  let matched: SentinelUserMatch | null;
  try {
    matched = await findSentinelUser(String(account.id), account.username, checkOwnsPlexServer);
  } catch (err) {
    console.error('[auth/callback] Sentinel lookup failed (GET /v1/users):', describeError(err));
    return redirectClearingPin('/login?error=sentinel_unreachable', request);
  }

  if (plexResourcesError) {
    console.error(
      '[auth/callback] Plex ownership check failed (plex.tv /api/v2/resources) — owner fallback not applied:',
      describeError(plexResourcesError),
    );
    if (!matched) return redirectClearingPin('/login?error=plex_unreachable', request);
  }

  if (!matched) {
    // Real, expected scenario for a household member with no live-captured session yet —
    // never silently fail here. The login page shows a specific message for this case.
    return redirectClearingPin('/login?error=no_history', request);
  }

  try {
    await createSession({
      sentinelUserId: matched.user.id,
      plexId: String(account.id),
      username: matched.user.username,
      // Admin comes only from an exact Plex id match on an owner row or from the
      // plex.tv-backed owner fallback — never from the Tautulli placeholder fallback.
      isAdmin: matched.grantsAdmin,
    });
  } catch (err) {
    console.error('[auth/callback] Could not create the Atrium Stats session (local database):', describeError(err));
    return redirectClearingPin('/login?error=session_failed', request);
  }

  return redirectClearingPin('/', request);
}
