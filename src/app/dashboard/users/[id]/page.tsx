import { notFound } from 'next/navigation';
import UserAvatar from '@/components/ui/UserAvatar';
import TopContent from '@/components/dashboard/TopContent';
import { getUserById, SentinelError } from '@/lib/sentinel/client';
import { getUserStats, UserStats } from '@/lib/sentinel/stats';
import { getHistory, HistoryResult } from '@/lib/sentinel/history';

function ErrorBox({ message }: { message: string }) {
  return <div className="rounded-xl border border-red-800 bg-red-950/40 text-red-300 text-sm p-4">{message}</div>;
}

export default async function UserDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const userId = parseInt(id, 10);
  if (isNaN(userId)) notFound();

  // notFound() throws a Next.js-internal sentinel error that must NOT be swallowed by a
  // generic catch block, so each await that can 404 is isolated in its own try/catch rather
  // than one big block wrapping the whole function.
  let user;
  try {
    user = await getUserById(userId);
  } catch (err) {
    return <ErrorBox message={err instanceof SentinelError ? err.message : 'Could not reach Sentinel.'} />;
  }
  if (!user) notFound();

  let stats: UserStats;
  let recentHistory: HistoryResult;
  try {
    [stats, recentHistory] = await Promise.all([
      getUserStats(userId, { period: '30d' }),
      getHistory({ userId, limit: 10 }),
    ]);
  } catch (err) {
    return <ErrorBox message={err instanceof SentinelError ? err.message : 'Could not reach Sentinel.'} />;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <UserAvatar thumb={user.thumb} username={user.displayName ?? user.username} className="w-14 h-14 text-xl" />
        <div>
          <h2 className="text-lg font-semibold text-(--color-text)">
            {user.displayName ?? user.username}
            {user.isOwner && (
              <span className="ml-2 text-[10px] uppercase tracking-wide text-(--color-accent) align-middle">Owner</span>
            )}
          </h2>
          <p className="text-sm text-(--color-text-muted)">@{user.username}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {(
          [
            ['Plays (30d)', stats.totalPlays],
            ['Hours (30d)', stats.totalHours],
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

      <TopContent title="Top Shows (30d)" items={stats.topShows} />
      <TopContent title="Top Movies (30d)" items={stats.topMovies} />

      <div>
        <h3 className="text-sm font-semibold text-(--color-text) mb-3">Recent History</h3>
        <div className="rounded-xl border border-(--color-border) bg-(--color-surface) divide-y divide-(--color-border)">
          {recentHistory.history.length === 0 && <p className="p-4 text-sm text-(--color-text-muted)">No history yet.</p>}
          {recentHistory.history.map((entry) => (
            <div key={entry.id} className="flex items-center justify-between px-4 py-2.5 text-sm">
              <span className="text-(--color-text) truncate">
                {entry.media?.type === 'episode'
                  ? [entry.media.grandparentTitle, entry.media.parentTitle, entry.media.title].filter(Boolean).join(' · ')
                  : (entry.media?.title ?? 'Unknown')}
              </span>
              <span className="text-(--color-text-muted) shrink-0 ml-4">
                {entry.startedAt ? new Date(entry.startedAt * 1000).toLocaleString() : '—'}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
