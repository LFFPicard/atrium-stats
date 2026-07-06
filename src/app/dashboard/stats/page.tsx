import { getServerStats, Period } from '@/lib/sentinel/stats';
import { SentinelError } from '@/lib/sentinel/client';
import ActivityChart from '@/components/dashboard/ActivityChart';
import Heatmap from '@/components/dashboard/Heatmap';
import LibraryBreakdown from '@/components/dashboard/LibraryBreakdown';
import TopContent from '@/components/dashboard/TopContent';
import PeriodSelect from '@/components/dashboard/PeriodSelect';

const VALID_PERIODS: Period[] = ['7d', '30d', '90d', '365d', 'all'];

function isPeriod(value: string | undefined): value is Period {
  return !!value && (VALID_PERIODS as string[]).includes(value);
}

export default async function StatsPage({ searchParams }: { searchParams: Promise<{ period?: string }> }) {
  const { period: rawPeriod } = await searchParams;
  const period: Period = isPeriod(rawPeriod) ? rawPeriod : '30d';

  try {
    const stats = await getServerStats({ period });

    return (
      <div className="space-y-6">
        <PeriodSelect current={period} />

        <div className="grid grid-cols-3 gap-4">
          {(
            [
              ['Total Plays', stats.totalPlays.toLocaleString()],
              ['Total Hours', stats.totalHours.toLocaleString()],
              ['Unique Users', stats.uniqueUsers],
            ] as const
          ).map(([label, value]) => (
            <div key={label} className="rounded-xl border border-(--color-border) bg-(--color-surface) p-4">
              <p className="text-2xl font-semibold text-(--color-text)">{value}</p>
              <p className="text-xs text-(--color-text-muted) mt-1">{label}</p>
            </div>
          ))}
        </div>

        <div className="rounded-xl border border-(--color-border) bg-(--color-surface) p-4">
          <h3 className="text-sm font-semibold text-(--color-text) mb-3">Daily Plays</h3>
          <ActivityChart data={stats.dailyPlayCounts} />
        </div>

        <div className="grid lg:grid-cols-2 gap-4">
          <div className="rounded-xl border border-(--color-border) bg-(--color-surface) p-4">
            <h3 className="text-sm font-semibold text-(--color-text) mb-3">Activity Heatmap</h3>
            <Heatmap data={stats.heatmap} />
          </div>
          <div className="rounded-xl border border-(--color-border) bg-(--color-surface) p-4">
            <h3 className="text-sm font-semibold text-(--color-text) mb-3">Library Breakdown</h3>
            <LibraryBreakdown data={stats.libraryBreakdown} />
          </div>
        </div>

        <div className="rounded-xl border border-(--color-border) bg-(--color-surface) p-4">
          <TopContent title="Top Movies" items={stats.topMovies} />
        </div>
        <div className="rounded-xl border border-(--color-border) bg-(--color-surface) p-4">
          <TopContent title="Top Shows" items={stats.topShows} />
        </div>
      </div>
    );
  } catch (err) {
    const message = err instanceof SentinelError ? err.message : 'Could not reach Sentinel.';
    return <div className="rounded-xl border border-red-800 bg-red-950/40 text-red-300 text-sm p-4">{message}</div>;
  }
}
