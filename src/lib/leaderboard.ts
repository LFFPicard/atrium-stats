import { inArray, eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { leaderboardOptIn } from '@/lib/db/schema';

export type OptInStatus = { optedIn: boolean; fullyPublic: boolean };

/**
 * Batch-fetches opt-in status for a set of Sentinel user ids. Users with no row at all
 * are treated as not opted in (the table only ever holds an explicit choice).
 */
export async function getOptInMap(userIds: number[]): Promise<Map<number, OptInStatus>> {
  const map = new Map<number, OptInStatus>();
  if (userIds.length === 0) return map;

  const rows = await db
    .select()
    .from(leaderboardOptIn)
    .where(inArray(leaderboardOptIn.sentinelUserId, userIds));

  for (const row of rows) {
    map.set(row.sentinelUserId, { optedIn: row.optedIn, fullyPublic: row.fullyPublic });
  }
  return map;
}

export async function getOptInStatus(userId: number): Promise<OptInStatus> {
  const map = await getOptInMap([userId]);
  return map.get(userId) ?? { optedIn: false, fullyPublic: false };
}

/**
 * Opting out always clears fullyPublic too — "show my name to nearby ranks" only makes
 * sense as a stronger tier on top of being ranked at all, never independent of it. Opting
 * back in leaves any prior fullyPublic value alone (explicit branches below rather than a
 * ternary that resolves to `undefined` — Drizzle's `.set()` doesn't reliably treat an
 * `undefined` value as "leave this column alone" across drivers).
 */
export async function setOptedIn(userId: number, optedIn: boolean): Promise<void> {
  const now = Math.floor(Date.now() / 1000);

  if (!optedIn) {
    await db
      .insert(leaderboardOptIn)
      .values({ sentinelUserId: userId, optedIn: false, fullyPublic: false, updatedAt: now })
      .onConflictDoUpdate({
        target: leaderboardOptIn.sentinelUserId,
        set: { optedIn: false, fullyPublic: false, updatedAt: now },
      });
    return;
  }

  await db
    .insert(leaderboardOptIn)
    .values({ sentinelUserId: userId, optedIn: true, fullyPublic: false, updatedAt: now })
    .onConflictDoUpdate({
      target: leaderboardOptIn.sentinelUserId,
      set: { optedIn: true, updatedAt: now },
    });
}

/** No-ops if the user hasn't opted in yet — fullyPublic is only meaningful on top of that. */
export async function setFullyPublic(userId: number, fullyPublic: boolean): Promise<void> {
  const now = Math.floor(Date.now() / 1000);
  const current = await getOptInStatus(userId);
  if (!current.optedIn) return;

  await db
    .update(leaderboardOptIn)
    .set({ fullyPublic, updatedAt: now })
    .where(eq(leaderboardOptIn.sentinelUserId, userId));
}
