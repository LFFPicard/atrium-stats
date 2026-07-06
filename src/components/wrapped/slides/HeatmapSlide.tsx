import Heatmap from '@/components/dashboard/Heatmap';
import type { HeatmapCell } from '@/lib/sentinel/stats';

export default function HeatmapSlide({ heatmap }: { heatmap: HeatmapCell[] }) {
  return (
    <div className="w-full max-w-lg">
      <p className="text-sm uppercase tracking-widest text-white/60 mb-4 text-center">When You Watched</p>
      {/* pointer-events-auto — the parent slide wrapper is pointer-events-none for the
          Stories-style tap navigation, but Heatmap's cells rely on hover/focus for their
          tooltip readout and need real pointer events to work. */}
      <div className="bg-black/25 rounded-2xl p-4 pointer-events-auto">
        <Heatmap data={heatmap} />
      </div>
    </div>
  );
}
