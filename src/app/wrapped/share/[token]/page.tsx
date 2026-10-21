import { notFound } from 'next/navigation';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { shareTokens } from '@/lib/db/schema';
import { getUserById, SentinelError } from '@/lib/sentinel/client';
import { assembleWrapped } from '@/lib/stats/wrapped';
import SlideShow, { Slide } from '@/components/wrapped/SlideShow';
import IntroSlide from '@/components/wrapped/slides/IntroSlide';
import TopContentSlide from '@/components/wrapped/slides/TopContentSlide';
import PeakTimeSlide from '@/components/wrapped/slides/PeakTimeSlide';
import HeatmapSlide from '@/components/wrapped/slides/HeatmapSlide';
import PersonalitySlide from '@/components/wrapped/slides/PersonalitySlide';
import OutroSlide from '@/components/wrapped/slides/OutroSlide';

// Fully public — no session check. Only ever shows one user's own Wrapped for one year,
// resolved from the share token; never the leaderboard slide (see lib/stats/wrapped.ts)
// and never any surface that could lead to another user's data or Sentinel's admin API.
export default async function WrappedSharePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  const rows = await db.select().from(shareTokens).where(eq(shareTokens.token, token)).limit(1);
  if (rows.length === 0) notFound();

  const { sentinelUserId, year } = rows[0];

  try {
    const [user, data] = await Promise.all([
      getUserById(sentinelUserId),
      assembleWrapped(sentinelUserId, year, { includeLeaderboard: false }),
    ]);
    if (!user) notFound();

    const slides: Slide[] = [
      { content: <IntroSlide year={year} username={user.displayName ?? user.username} /> },
      {
        content: <TopContentSlide label="Top Show" item={data.topShow} emptyMessage="No shows watched this year." />,
        backdropRatingKey: data.topShow?.ratingKey,
      },
      {
        content: <TopContentSlide label="Top Movie" item={data.topMovie} emptyMessage="No movies watched this year." />,
        backdropRatingKey: data.topMovie?.ratingKey,
      },
      { content: <PeakTimeSlide peakDay={data.stats.peakDay} peakHour={data.stats.peakHour} /> },
      { content: <HeatmapSlide heatmap={data.stats.heatmap} /> },
      { content: <PersonalitySlide personality={data.personality} /> },
      { content: <OutroSlide year={year} showShare={false} /> },
    ];

    return <SlideShow slides={slides} exitHref="/" />;
  } catch (err) {
    if (err instanceof SentinelError && err.status === 404) notFound();
    // Public page — never echo SentinelError.message here: it carries Sentinel's request
    // path and raw response body. Log the detail server-side, show visitors a generic line.
    console.error('[wrapped/share] Failed to load Wrapped:', err instanceof Error ? err.message : err);
    return (
      <div className="fixed inset-0 bg-(--color-bg) text-(--color-text) flex items-center justify-center p-8">
        <div className="rounded-xl border border-red-800 bg-red-950/40 text-red-300 text-sm p-4 max-w-sm text-center">
          This Wrapped isn&apos;t available right now. Try again later.
        </div>
      </div>
    );
  }
}
