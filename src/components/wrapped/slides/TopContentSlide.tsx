import Poster from '@/components/ui/Poster';
import type { TopContentItem } from '@/lib/sentinel/stats';
import EmptySlide from './EmptySlide';

// Shared shape for the "Top Show" and "Top Movie" slides — same layout, different label.
export default function TopContentSlide({ label, item, emptyMessage }: { label: string; item: TopContentItem | null; emptyMessage: string }) {
  if (!item) {
    return <EmptySlide title={label} message={emptyMessage} />;
  }

  return (
    <div className="text-center max-w-sm flex flex-col items-center">
      <p className="text-sm uppercase tracking-widest text-white/60 mb-4">{label}</p>
      <Poster
        ratingKey={item.ratingKey}
        alt={item.title ?? label}
        className="w-40 aspect-[2/3] rounded-xl object-cover shadow-2xl mb-5"
      />
      <h2 className="text-2xl font-bold">{item.title ?? 'Unknown'}</h2>
      <p className="text-white/70 mt-1.5">
        {item.playCount} {item.playCount === 1 ? 'play' : 'plays'}
      </p>
    </div>
  );
}
