import { cookies } from 'next/headers';
import { randomBytes } from 'node:crypto';
import { eq, lt } from 'drizzle-orm';
import { db } from '@/lib/db';
import { sessions } from '@/lib/db/schema';

const SESSION_COOKIE = 'atrium_stats_session';
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days

export type SessionData = {
  token: string;
  sentinelUserId: number;
  plexId: string;
  username: string;
  isAdmin: boolean;
};

/** Creates a session row + sets the session cookie. Only callable from a Route Handler or Server Action. */
export async function createSession(data: {
  sentinelUserId: number;
  plexId: string;
  username: string;
  isAdmin: boolean;
}): Promise<void> {
  const token = randomBytes(32).toString('hex');
  const now = Math.floor(Date.now() / 1000);

  // getSession() only deletes an expired row when its own cookie comes back; sweep the rest
  // here so abandoned sessions don't accumulate forever. Sign-ins are rare enough that this
  // costs nothing.
  await db.delete(sessions).where(lt(sessions.expiresAt, now));

  await db.insert(sessions).values({
    token,
    sentinelUserId: data.sentinelUserId,
    plexId: data.plexId,
    username: data.username,
    isAdmin: data.isAdmin,
    createdAt: now,
    expiresAt: now + SESSION_TTL_SECONDS,
  });

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_TTL_SECONDS,
  });
}

/** Reads the current session, if any. Safe to call from Server Components (read-only). */
export async function getSession(): Promise<SessionData | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const row = await db.query.sessions.findFirst({ where: eq(sessions.token, token) });
  if (!row) return null;

  const now = Math.floor(Date.now() / 1000);
  if (row.expiresAt < now) {
    await db.delete(sessions).where(eq(sessions.token, token));
    return null;
  }

  return {
    token: row.token,
    sentinelUserId: row.sentinelUserId,
    plexId: row.plexId,
    username: row.username,
    isAdmin: row.isAdmin,
  };
}

/** Destroys the current session, if any. Only callable from a Route Handler or Server Action. */
export async function destroySession(): Promise<void> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (token) {
    await db.delete(sessions).where(eq(sessions.token, token));
  }
  cookieStore.delete(SESSION_COOKIE);
}
