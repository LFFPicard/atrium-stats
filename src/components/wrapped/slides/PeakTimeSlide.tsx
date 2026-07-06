import { formatHour } from '@/lib/stats/personality';
import EmptySlide from './EmptySlide';

export default function PeakTimeSlide({ peakDay, peakHour }: { peakDay: string | null; peakHour: number | null }) {
  if (!peakDay || peakHour === null) {
    return <EmptySlide title="Peak Time" message="Not enough plays yet to find a pattern." />;
  }

  return (
    <div className="text-center max-w-sm">
      <p className="text-sm uppercase tracking-widest text-white/60 mb-4">Your Peak Time</p>
      <p className="text-4xl font-bold mb-2">
        {peakDay}s at {formatHour(peakHour)}
      </p>
      <p className="text-white/70">That&apos;s when you were most likely to be watching something.</p>
    </div>
  );
}
