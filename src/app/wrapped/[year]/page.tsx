import { notFound, redirect } from 'next/navigation';
import { getSession } from '@/lib/auth/session';
import { assembleWrapped } from '@/lib/stats/wrapped';
import { SentinelError } from '@/lib/sentinel/client';
import SlideShow, { Slide } from '@/components/wrapped/SlideShow';
import IntroSlide from '@/components/wrapped/slides/IntroSlide';
import TopContentSlide from '@/components/wrapped/slides/TopContentSlide';
import PeakTimeSlide from '@/components/wrapped/slides/PeakTimeSlide';
import HeatmapSlide from '@/components/wrapped/slides/HeatmapSlide';
import PersonalitySlide from '@/components/wrapped/slides/PersonalitySlide';
import LeaderboardSlide from '@/components/wrapped/slides/LeaderboardSlide';
import OutroSlide from '@/components/wrapped/slides/OutroSlide';

export default async function WrappedYearPage({ params }: { params: Promise<{ year: string }> }) {
  const session = await getSession();
  if (!session) redirect('/login');

  const { year: yearStr } = await params;
  const year = parseInt(yearStr, 10);
  if (isNaN(year)) notFound();

  try {
    const data = await assembleWrapped(session.sentinelUserId, year, { includeLeaderboard: true });

    const slides: Slide[] = [
      { content: <IntroSlide year={year} username={session.username} /> },
      {
        content: <TopContentSlide label="Your Top Show" item={data.topShow} emptyMessage="No shows watched this year." />,
        backdropRatingKey: data.topShow?.ratingKey,
      },
      {
        content: <TopContentSlide label="Your Top Movie" item={data.topMovie} emptyMessage="No movies watched this year." />,
        backdropRatingKey: data.topMovie?.ratingKey,
      },
      { content: <PeakTimeSlide peakDay={data.stats.peakDay} peakHour={data.stats.peakHour} /> },
      { content: <HeatmapSlide heatmap={data.stats.heatmap} /> },
      { content: <PersonalitySlide personality={data.personality} /> },
      ...(data.leaderboard ? [{ content: <LeaderboardSlide placement={data.leaderboard} /> }] : []),
      { content: <OutroSlide year={year} showShare /> },
    ];

    return <SlideShow slides={slides} exitHref="/wrapped" />;
  } catch (err) {
    const message = err instanceof SentinelError ? err.message : 'Could not reach Sentinel.';
    return (
      <div className="fixed inset-0 bg-(--color-bg) text-(--color-text) flex items-center justify-center p-8">
        <div className="rounded-xl border border-red-800 bg-red-950/40 text-red-300 text-sm p-4 max-w-sm text-center">{message}</div>
      </div>
    );
  }
}
