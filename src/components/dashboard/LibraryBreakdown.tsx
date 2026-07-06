'use client';

import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';

// Fixed, entity-keyed categorical mapping (validated dark-mode steps from the dataviz
// palette) — color follows the media type, never its rank/order in the data.
// NOTE: despite the "library breakdown" name, /v1/stats/server groups by metadata.type
// (the per-item Plex media type: movie | episode | track) — not by library section type
// (movie | show | music | photo). Episode counts are what "shows" breaks down to here.
const TYPE_COLORS: Record<string, string> = {
  movie: '#3987e5', // slot 1 — blue
  episode: '#199e70', // slot 2 — aqua
  track: '#c98500', // slot 3 — yellow
};
const FALLBACK_COLOR = '#9085e9'; // slot 5 — violet, for any future/unknown media type

const TYPE_LABELS: Record<string, string> = {
  movie: 'Movies',
  episode: 'TV Episodes',
  track: 'Music',
};

export default function LibraryBreakdown({ data }: { data: { type: string; count: number }[] }) {
  if (data.length === 0) {
    return <p className="text-sm text-(--color-text-muted)">No library data for this range.</p>;
  }

  const total = data.reduce((sum, d) => sum + d.count, 0);

  return (
    <ResponsiveContainer width="100%" height={220}>
      <PieChart>
        <Pie data={data} dataKey="count" nameKey="type" innerRadius={55} outerRadius={80} paddingAngle={2} strokeWidth={2} stroke="var(--color-surface)">
          {data.map((entry) => (
            <Cell key={entry.type} fill={TYPE_COLORS[entry.type] ?? FALLBACK_COLOR} />
          ))}
        </Pie>
        <Tooltip
          formatter={(value, _name, item) => {
            const numValue = typeof value === 'number' ? value : 0;
            const pct = total > 0 ? Math.round((numValue / total) * 100) : 0;
            const type = (item?.payload as { type?: string } | undefined)?.type ?? '';
            return [`${numValue} (${pct}%)`, TYPE_LABELS[type] ?? type];
          }}
          contentStyle={{
            background: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            borderRadius: 8,
            fontSize: 12,
          }}
          labelStyle={{ color: 'var(--color-text)' }}
          itemStyle={{ color: 'var(--color-text)' }}
        />
        <Legend
          formatter={(value: string) => (
            <span style={{ color: 'var(--color-text-muted)', fontSize: 12 }}>{TYPE_LABELS[value] ?? value}</span>
          )}
          iconType="circle"
          iconSize={8}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}
