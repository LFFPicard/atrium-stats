import { getServerStats } from '@/lib/sentinel/stats';
import { sentinelFetch, SentinelError } from '@/lib/sentinel/client';
import HeroMetrics from '@/components/dashboard/HeroMetrics';
import LiveActivity from '@/components/dashboard/LiveActivity';

export default async function DashboardPage() {
  try {
    const [stats, live] = await Promise.all([
      getServerStats({ period: '30d' }),
      sentinelFetch<{ sessions: unknown[] }>('/sessions/live'),
    ]);

    return (
      <div>
        <HeroMetrics
          totalPlays={stats.totalPlays}
          totalHours={stats.totalHours}
          uniqueUsers={stats.uniqueUsers}
          liveCount={live.sessions.length}
        />

        <h2 className="text-sm font-semibold text-(--color-text) mb-3">Live Activity</h2>
        <LiveActivity />
      </div>
    );
  } catch (err) {
    const message = err instanceof SentinelError ? err.message : 'Could not reach Sentinel.';
    return (
      <div className="rounded-xl border border-red-800 bg-red-950/40 text-red-300 text-sm p-4">
        {message}
      </div>
    );
  }
}
