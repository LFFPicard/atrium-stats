import Poster from '@/components/ui/Poster';
import type { TopContentItem } from '@/lib/sentinel/stats';

export default function TopContent({ title, items }: { title: string; items: TopContentItem[] }) {
  if (items.length === 0) return null;

  return (
    <div>
      <h3 className="text-sm font-semibold text-(--color-text) mb-3">{title}</h3>
      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
        {items.map((item, i) => (
          <div key={item.ratingKey ?? i} className="text-center">
            <Poster
              ratingKey={item.ratingKey}
              alt={item.title ?? 'Poster'}
              className="w-full aspect-[2/3] rounded-lg object-cover mb-1.5"
            />
            <p className="text-xs text-(--color-text) truncate">{item.title ?? 'Unknown'}</p>
            <p className="text-[11px] text-(--color-text-muted)">{item.playCount} plays</p>
          </div>
        ))}
      </div>
    </div>
  );
}
