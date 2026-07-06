import type { LeaderboardPlacement } from '@/lib/stats/wrapped';

// Only ever rendered when the user opted in AND had a rank for this year — see
// lib/stats/wrapped.ts, which never assembles this at all for public share links.
export default function LeaderboardSlide({ placement }: { placement: LeaderboardPlacement }) {
  if (!placement) return null;

  return (
    <div className="text-center max-w-sm">
      <p className="text-sm uppercase tracking-widest text-white/60 mb-4">Your Leaderboard Rank</p>
      <p className="text-5xl font-bold mb-2">
        #{placement.rank} <span className="text-2xl text-white/60">of {placement.total}</span>
      </p>
      <p className="text-white/70">Among everyone who opted into the leaderboard this year.</p>
    </div>
  );
}
