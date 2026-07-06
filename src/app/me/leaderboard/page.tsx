import { getSession } from '@/lib/auth/session';
import { getLeaderboard, Period } from '@/lib/sentinel/stats';
import { SentinelError } from '@/lib/sentinel/client';
import { getOptInMap, getOptInStatus } from '@/lib/leaderboard';
import LeaderboardCard from '@/components/leaderboard/LeaderboardCard';
import PeriodSelect from '@/components/dashboard/PeriodSelect';

const VALID_PERIODS: Period[] = ['7d', '30d', '90d', '365d', 'all'];

function isPeriod(value: string | undefined): value is Period {
  return !!value && (VALID_PERIODS as string[]).includes(value);
}

export default async function LeaderboardPage({ searchParams }: { searchParams: Promise<{ period?: string }> }) {
  const session = await getSession();
  if (!session) return null; // unreachable in practice — app/me/layout.tsx already redirects

  const { period: rawPeriod } = await searchParams;
  const period: Period = isPeriod(rawPeriod) ? rawPeriod : '30d';

  const status = await getOptInStatus(session.sentinelUserId);

  if (!status.optedIn) {
    return (
      <div className="space-y-4">
        <PeriodSelect current={period} />
        <LeaderboardCard optedIn={false} fullyPublic={false} rank={null} total={0} above={null} below={null} ownStats={null} />
      </div>
    );
  }

  try {
    const entries = await getLeaderboard({ period });
    const optInMap = await getOptInMap(entries.map((e) => e.userId));

    // Only users who've opted in are ranked or counted at all — a true opt-in leaderboard,
    // not opt-out visibility. See lib/leaderboard.ts.
    const ranked = entries.filter((e) => optInMap.get(e.userId)?.optedIn);
    const index = ranked.findIndex((e) => e.userId === session.sentinelUserId);

    const rank = index === -1 ? null : index + 1;
    const total = ranked.length;
    const own = index === -1 ? null : ranked[index];

    function neighborAt(i: number) {
      if (i < 0 || i >= ranked.length) return null;
      const entry = ranked[i];
      const isPublic = optInMap.get(entry.userId)?.fullyPublic ?? false;
      return { rank: i + 1, name: isPublic ? (entry.displayName ?? entry.username) : null };
    }

    const above = index === -1 ? null : neighborAt(index - 1);
    const below = index === -1 ? null : neighborAt(index + 1);

    return (
      <div className="space-y-4">
        <PeriodSelect current={period} />
        <LeaderboardCard
          optedIn
          fullyPublic={status.fullyPublic}
          rank={rank}
          total={total}
          above={above}
          below={below}
          ownStats={own ? { totalPlays: own.totalPlays, totalHours: own.totalHours } : null}
        />
      </div>
    );
  } catch (err) {
    const message = err instanceof SentinelError ? err.message : 'Could not reach Sentinel.';
    return <div className="rounded-xl border border-red-800 bg-red-950/40 text-red-300 text-sm p-4">{message}</div>;
  }
}
