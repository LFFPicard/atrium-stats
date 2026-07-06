import { NextRequest, NextResponse } from 'next/server';
import { randomBytes } from 'node:crypto';
import { eq, and } from 'drizzle-orm';
import { getSession } from '@/lib/auth/session';
import { db } from '@/lib/db';
import { shareTokens } from '@/lib/db/schema';

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const body = (await request.json().catch(() => null)) as { year?: number } | null;
  const year = body?.year;
  if (!year || !Number.isInteger(year)) {
    return NextResponse.json({ error: 'Invalid year' }, { status: 400 });
  }

  // Reuse an existing token for this user+year rather than minting a new one on every
  // click — keeps a single stable, shareable link per year.
  const existing = await db
    .select()
    .from(shareTokens)
    .where(and(eq(shareTokens.sentinelUserId, session.sentinelUserId), eq(shareTokens.year, year)))
    .limit(1);

  let token: string;
  if (existing.length > 0) {
    token = existing[0].token;
  } else {
    token = randomBytes(16).toString('hex');
    await db.insert(shareTokens).values({
      token,
      sentinelUserId: session.sentinelUserId,
      year,
      createdAt: Math.floor(Date.now() / 1000),
    });
  }

  const appUrl = process.env.APP_URL ?? request.nextUrl.origin;
  return NextResponse.json({ url: `${appUrl}/wrapped/share/${token}` });
}
