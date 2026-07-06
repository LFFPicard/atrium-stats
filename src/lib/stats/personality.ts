import type { HeatmapCell } from '@/lib/sentinel/stats';

export type Personality = {
  type: string;
  description: string;
};

const NO_DATA: Personality = {
  type: 'Blank Slate',
  description: "You didn't watch anything this year — next year's Wrapped has nowhere to go but up.",
};

/**
 * Derives a single personality label from viewing patterns. Genre variety is deliberately
 * not a signal here — Sentinel's `genres` column doesn't exist yet, so genreBreakdown is
 * always empty (see ATRIUM_STATS.md's Known Gotchas). This only uses what's actually
 * derivable today: peak hour (time-of-day), weekend-vs-weekday split from the heatmap
 * (a proxy for "binge frequency" / consistency), and total volume.
 *
 * Checked in order, first match wins, with a guaranteed fallback — not mutually exclusive
 * traits, just a ranked read of the strongest signal in the data.
 */
export function classifyPersonality(input: {
  totalPlays: number;
  totalHours: number;
  peakHour: number | null;
  heatmap: HeatmapCell[];
}): Personality {
  const { totalPlays, totalHours, peakHour, heatmap } = input;

  if (totalPlays === 0 || heatmap.length === 0) return NO_DATA;

  const totalCount = heatmap.reduce((sum, cell) => sum + cell.count, 0);
  if (totalCount === 0) return NO_DATA;

  const weekendCount = heatmap
    .filter((cell) => cell.dayOfWeek === 0 || cell.dayOfWeek === 6)
    .reduce((sum, cell) => sum + cell.count, 0);
  const weekendFraction = weekendCount / totalCount;

  if (weekendFraction >= 0.55) {
    return {
      type: 'Weekend Warrior',
      description: `${Math.round(weekendFraction * 100)}% of your watching happened on a weekend — weekdays are just the waiting room.`,
    };
  }

  if (peakHour !== null && (peakHour >= 22 || peakHour <= 3)) {
    return {
      type: 'Night Owl',
      description: `Your peak hour was ${formatHour(peakHour)} — the rest of the house was asleep and you were not.`,
    };
  }

  if (peakHour !== null && peakHour >= 5 && peakHour <= 8) {
    return {
      type: 'Early Riser',
      description: `Your peak hour was ${formatHour(peakHour)} — up before most people's alarms.`,
    };
  }

  if (totalHours >= 150) {
    return {
      type: 'Binge Master',
      description: `${Math.round(totalHours).toLocaleString()} hours watched — that's a serious commitment to the screen.`,
    };
  }

  if (peakHour !== null && peakHour >= 18 && peakHour <= 22) {
    return {
      type: 'Prime Timer',
      description: `Your peak hour was ${formatHour(peakHour)} — right on schedule with everyone else's evening.`,
    };
  }

  return {
    type: 'Steady Viewer',
    description: 'No single pattern dominates — you just watch what you want, whenever you want.',
  };
}

export function formatHour(hour: number): string {
  const period = hour < 12 ? 'AM' : 'PM';
  const displayHour = hour % 12 === 0 ? 12 : hour % 12;
  return `${displayHour}${period}`;
}
