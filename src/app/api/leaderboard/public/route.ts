import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { setFullyPublic } from '@/lib/leaderboard';

// setFullyPublic() itself no-ops if the user hasn't opted in yet — this route doesn't
// need to duplicate that check.
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.redirect(new URL('/login', process.env.APP_URL ?? request.nextUrl.origin));
  }

  const formData = await request.formData();
  const fullyPublic = formData.get('value') === 'true';
  await setFullyPublic(session.sentinelUserId, fullyPublic);

  return NextResponse.redirect(new URL('/me/leaderboard', process.env.APP_URL ?? request.nextUrl.origin));
}
