import { getUserStats, getLeaderboard, UserStats, TopContentItem } from '@/lib/sentinel/stats';
import { getOptInMap, computeRank } from '@/lib/leaderboard';
import { classifyPersonality, Personality } from './personality';

export type LeaderboardPlacement = { rank: number; total: number } | null;

export type WrappedData = {
  year: number;
  stats: UserStats;
  topShow: TopContentItem | null;
  topMovie: TopContentItem | null;
  personality: Personality;
  leaderboard: LeaderboardPlacement;
};

/**
 * Assembles everything a Wrapped slideshow needs for one user/year into a single shape,
 * shared by both the authenticated view (app/wrapped/[year]) and the public share view
 * (app/wrapped/share/[token]). `includeLeaderboard: false` is used for share links — a
 * share can leave the trusted app context (posted anywhere), so leaderboard placement,
 * which depends on other users' opt-in state, is never assembled for it at all.
 */
export async function assembleWrapped(
  sentinelUserId: number,
  year: number,
  options: { includeLeaderboard: boolean },
): Promise<WrappedData> {
  const stats = await getUserStats(sentinelUserId, { year });

  const personality = classifyPersonality({
    totalPlays: stats.totalPlays,
    totalHours: stats.totalHours,
    peakHour: stats.peakHour,
    heatmap: stats.heatmap,
  });

  let leaderboard: LeaderboardPlacement = null;
  if (options.includeLeaderboard) {
    const ownOptIn = await getOptInMap([sentinelUserId]);
    if (ownOptIn.get(sentinelUserId)?.optedIn) {
      const entries = await getLeaderboard({ year });
      const optInMap = await getOptInMap(entries.map((e) => e.userId));
      const result = computeRank(entries, optInMap, sentinelUserId);
      if (result) leaderboard = { rank: result.rank, total: result.total };
    }
  }

  return {
    year,
    stats,
    topShow: stats.topShows[0] ?? null,
    topMovie: stats.topMovies[0] ?? null,
    personality,
    leaderboard,
  };
}
