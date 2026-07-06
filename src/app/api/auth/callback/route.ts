import { NextRequest, NextResponse } from 'next/server';
import { waitForPlexPin, getPlexAccount, PLEX_PIN_COOKIE } from '@/lib/auth/plex';
import { findSentinelUser } from '@/lib/sentinel/client';
import { createSession } from '@/lib/auth/session';

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
// matching Sentinel user — falling back to a username match for Tautulli-imported users
// syncUsers hasn't reconciled yet (see the Auth Architecture edge case in ATRIUM_STATS.md).
export async function GET(request: NextRequest) {
  const pinIdRaw = request.cookies.get(PLEX_PIN_COOKIE)?.value;
  if (!pinIdRaw) {
    return redirectClearingPin('/login?error=session_expired', request);
  }

  const pinId = parseInt(pinIdRaw, 10);

  try {
    const authToken = await waitForPlexPin(pinId);
    if (!authToken) {
      return redirectClearingPin('/login?error=pin_timeout', request);
    }

    const account = await getPlexAccount(authToken);
    const matched = await findSentinelUser(String(account.id), account.username);

    if (!matched) {
      // Real, expected scenario for a household member with no live-captured session yet —
      // never silently fail here. The login page shows a specific message for this case.
      return redirectClearingPin('/login?error=no_history', request);
    }

    await createSession({
      sentinelUserId: matched.id,
      plexId: String(account.id),
      username: matched.username,
      isAdmin: matched.isOwner,
    });

    return redirectClearingPin('/', request);
  } catch (err) {
    console.error('[auth/callback] Plex sign-in failed:', err instanceof Error ? err.message : err);
    return redirectClearingPin('/login?error=plex_unreachable', request);
  }
}
