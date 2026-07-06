import { sentinelFetch } from './client';

export type Period = '7d' | '30d' | '90d' | '365d' | 'all';

export type HeatmapCell = { dayOfWeek: number; hour: number; count: number };

export type TopContentItem = {
  metadataId: number | null;
  title: string | null;
  thumb: string | null;
  playCount: number;
};

export type ServerStats = {
  totalPlays: number;
  totalHours: number;
  uniqueUsers: number;
  topMovies: TopContentItem[];
  topShows: (TopContentItem & { grandparentTitle: string | null })[];
  dailyPlayCounts: { date: string; count: number }[];
  heatmap: HeatmapCell[];
  libraryBreakdown: { type: string; count: number }[];
};

export type UserStats = {
  totalPlays: number;
  totalHours: number;
  topShows: TopContentItem[];
  topMovies: TopContentItem[];
  // Always [] today — the `genres` column doesn't exist in Sentinel's schema yet.
  // Don't build UI that assumes this has data; design it to degrade gracefully instead.
  genreBreakdown: { genre: string; count: number }[];
  peakDay: string | null;
  peakHour: number | null;
  heatmap: HeatmapCell[];
};

function scopeParams(scope: { year?: number; period?: Period }): string {
  const params = new URLSearchParams();
  if (scope.year !== undefined) params.set('year', String(scope.year));
  else if (scope.period) params.set('period', scope.period);
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

export async function getServerStats(scope: { year?: number; period?: Period } = {}): Promise<ServerStats> {
  return sentinelFetch<ServerStats>(`/stats/server${scopeParams(scope)}`);
}

export async function getUserStats(
  userId: number,
  scope: { year?: number; period?: Period } = {},
): Promise<UserStats> {
  return sentinelFetch<UserStats>(`/stats/user/${userId}${scopeParams(scope)}`);
}
