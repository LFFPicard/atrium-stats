'use client';

import { Fragment, useState } from 'react';
import type { HeatmapCell } from '@/lib/sentinel/stats';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const HOURS = Array.from({ length: 24 }, (_, i) => i);

// Sequential magnitude ramp, one hue (the app's own accent violet), light→dark via alpha
// over the surface — monotonic in perceived lightness without hand-authoring hex steps.
function cellColor(intensity: number): string {
  const alpha = 0.08 + intensity * 0.82;
  return `rgba(124, 106, 247, ${alpha.toFixed(3)})`; // #7c6af7
}

export default function Heatmap({ data }: { data: HeatmapCell[] }) {
  const [hovered, setHovered] = useState<{ day: number; hour: number; count: number } | null>(null);

  const grid = new Map<string, number>();
  let max = 0;
  for (const cell of data) {
    grid.set(`${cell.dayOfWeek}-${cell.hour}`, cell.count);
    if (cell.count > max) max = cell.count;
  }

  if (data.length === 0 || max === 0) {
    return <p className="text-sm text-(--color-text-muted)">No activity data for this range.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <div className="inline-block min-w-full">
        <div className="grid gap-[2px]" style={{ gridTemplateColumns: '28px repeat(24, minmax(16px, 1fr))' }}>
          <div />
          {HOURS.map((h) => (
            <div key={h} className="text-[9px] text-(--color-text-muted) text-center">
              {h % 3 === 0 ? h : ''}
            </div>
          ))}

          {DAYS.map((label, day) => (
            <Fragment key={day}>
              <div className="text-[10px] text-(--color-text-muted) flex items-center">{label}</div>
              {HOURS.map((hour) => {
                const count = grid.get(`${day}-${hour}`) ?? 0;
                const intensity = max > 0 ? count / max : 0;
                return (
                  <div
                    key={hour}
                    className="aspect-square rounded-[2px] cursor-default focus:outline-none focus:ring-1 focus:ring-(--color-accent) hover:ring-1 hover:ring-(--color-accent)"
                    style={{ background: count > 0 ? cellColor(intensity) : 'var(--color-border)' }}
                    onMouseEnter={() => setHovered({ day, hour, count })}
                    onMouseLeave={() => setHovered(null)}
                    onFocus={() => setHovered({ day, hour, count })}
                    onBlur={() => setHovered(null)}
                    tabIndex={0}
                    role="button"
                    aria-label={`${label} ${hour}:00 — ${count} plays`}
                  />
                );
              })}
            </Fragment>
          ))}
        </div>

        <div className="flex items-center justify-between mt-3 text-[11px] text-(--color-text-muted)">
          <span>
            {hovered
              ? `${DAYS[hovered.day]} ${String(hovered.hour).padStart(2, '0')}:00 — ${hovered.count} play${hovered.count === 1 ? '' : 's'}`
              : 'Hover or focus a cell for details'}
          </span>
          <span className="flex items-center gap-1.5 shrink-0">
            Less
            <span className="flex gap-[2px]">
              {[0.1, 0.3, 0.55, 0.8, 1].map((i) => (
                <span key={i} className="w-2.5 h-2.5 rounded-[2px] inline-block" style={{ background: cellColor(i) }} />
              ))}
            </span>
            More
          </span>
        </div>
      </div>
    </div>
  );
}
