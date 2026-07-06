import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth/session';
import { getUserStats } from '@/lib/sentinel/stats';

const YEARS_BACK = 6;

export default async function WrappedYearSelectPage() {
  const session = await getSession();
  if (!session) redirect('/login');

  const currentYear = new Date().getFullYear();
  const candidateYears = Array.from({ length: YEARS_BACK }, (_, i) => currentYear - i);

  const summaries = await Promise.all(
    candidateYears.map(async (year) => {
      try {
        const stats = await getUserStats(session.sentinelUserId, { year });
        return { year, totalPlays: stats.totalPlays };
      } catch {
        return { year, totalPlays: 0 };
      }
    }),
  );

  const backHref = session.isAdmin ? '/dashboard' : '/me';

  return (
    <div className="min-h-screen bg-(--color-bg) text-(--color-text) flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold">Your Wrapped</h1>
          <p className="text-sm text-(--color-text-muted) mt-1">Pick a year to relive it.</p>
        </div>

        <div className="space-y-2">
          {summaries.map(({ year, totalPlays }) => (
            <Link
              key={year}
              href={`/wrapped/${year}`}
              className="flex items-center justify-between rounded-xl border border-(--color-border) bg-(--color-surface) px-4 py-3 hover:border-(--color-accent) transition-colors"
            >
              <span className="text-lg font-semibold">{year}</span>
              <span className="text-sm text-(--color-text-muted)">
                {totalPlays > 0 ? `${totalPlays.toLocaleString()} plays` : 'No plays yet'}
              </span>
            </Link>
          ))}
        </div>

        <div className="text-center mt-6">
          <Link href={backHref} className="text-xs text-(--color-text-muted) hover:text-(--color-text) underline">
            Back
          </Link>
        </div>
      </div>
    </div>
  );
}
