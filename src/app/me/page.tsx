import { getSession } from '@/lib/auth/session';
import { getUserStats, Period } from '@/lib/sentinel/stats';
import { SentinelError } from '@/lib/sentinel/client';
import Heatmap from '@/components/dashboard/Heatmap';
import TopContent from '@/components/dashboard/TopContent';
import PeriodSelect from '@/components/dashboard/PeriodSelect';

const VALID_PERIODS: Period[] = ['7d', '30d', '90d', '365d', 'all'];

function isPeriod(value: string | undefined): value is Period {
  return !!value && (VALID_PERIODS as string[]).includes(value);
}

export default async function MePage({ searchParams }: { searchParams: Promise<{ period?: string }> }) {
  const session = await getSession();
  if (!session) return null; // unreachable in practice — app/me/layout.tsx already redirects

  const { period: rawPeriod } = await searchParams;
  const period: Period = isPeriod(rawPeriod) ? rawPeriod : '30d';

  try {
    const stats = await getUserStats(session.sentinelUserId, { period });

    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <h2 className="text-lg font-semibold text-(--color-text)">Hey, {session.username}</h2>
          <PeriodSelect current={period} />
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {(
            [
              ['Plays', stats.totalPlays.toLocaleString()],
              ['Hours', stats.totalHours.toLocaleString()],
              ['Peak Day', stats.peakDay ?? '—'],
              ['Peak Hour', stats.peakHour !== null ? `${stats.peakHour}:00` : '—'],
            ] as const
          ).map(([label, value]) => (
            <div key={label} className="rounded-xl border border-(--color-border) bg-(--color-surface) p-4">
              <p className="text-xl font-semibold text-(--color-text)">{value}</p>
              <p className="text-xs text-(--color-text-muted) mt-1">{label}</p>
            </div>
          ))}
        </div>

        <div className="rounded-xl border border-(--color-border) bg-(--color-surface) p-4">
          <h3 className="text-sm font-semibold text-(--color-text) mb-3">Your Activity</h3>
          <Heatmap data={stats.heatmap} />
        </div>

        <div className="rounded-xl border border-(--color-border) bg-(--color-surface) p-4">
          <TopContent title="Your Top Shows" items={stats.topShows} />
        </div>
        <div className="rounded-xl border border-(--color-border) bg-(--color-surface) p-4">
          <TopContent title="Your Top Movies" items={stats.topMovies} />
        </div>

        {/*
          genreBreakdown intentionally omitted — Sentinel's `genres` column doesn't exist yet,
          so this is always []. See ATRIUM_STATS.md's Known Gotchas: build genre UI once
          Sentinel actually populates it, not before.
        */}
      </div>
    );
  } catch (err) {
    const message = err instanceof SentinelError ? err.message : 'Could not reach Sentinel.';
    return <div className="rounded-xl border border-red-800 bg-red-950/40 text-red-300 text-sm p-4">{message}</div>;
  }
}
