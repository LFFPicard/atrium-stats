import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { setOptedIn } from '@/lib/leaderboard';

// Plain form POST (see components/leaderboard/LeaderboardCard.tsx) — no client JS needed
// for a simple boolean toggle, consistent with the sign-out form pattern in the sidebar.
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.redirect(new URL('/login', process.env.APP_URL ?? request.nextUrl.origin));
  }

  const formData = await request.formData();
  const optedIn = formData.get('value') === 'true';
  await setOptedIn(session.sentinelUserId, optedIn);

  return NextResponse.redirect(new URL('/me/leaderboard', process.env.APP_URL ?? request.nextUrl.origin));
}
