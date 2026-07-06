type Neighbor = { rank: number; name: string | null } | null;

// Presentational only — all ranking/anonymization logic lives server-side in
// app/me/leaderboard/page.tsx so raw multi-user data never reaches the browser.
export default function LeaderboardCard({
  optedIn,
  fullyPublic,
  rank,
  total,
  above,
  below,
  ownStats,
}: {
  optedIn: boolean;
  fullyPublic: boolean;
  rank: number | null;
  total: number;
  above: Neighbor;
  below: Neighbor;
  ownStats: { totalPlays: number; totalHours: number } | null;
}) {
  if (!optedIn) {
    return (
      <div className="rounded-xl border border-(--color-border) bg-(--color-surface) p-6 text-center">
        <p className="text-sm text-(--color-text-muted) mb-4">
          The leaderboard is opt-in — join to see where you rank among other viewers.
        </p>
        <form action="/api/leaderboard/opt-in" method="POST" className="inline-block">
          <input type="hidden" name="value" value="true" />
          <button
            type="submit"
            className="bg-(--color-button) text-(--color-button-text) font-medium rounded-lg px-4 py-2 text-sm hover:opacity-90 transition-opacity"
          >
            Join the leaderboard
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-(--color-border) bg-(--color-surface) p-6 text-center">
        {rank !== null ? (
          <>
            <p className="text-3xl font-semibold text-(--color-text)">
              #{rank} <span className="text-lg text-(--color-text-muted)">of {total}</span>
            </p>
            {ownStats && (
              <p className="text-sm text-(--color-text-muted) mt-1">
                {ownStats.totalPlays.toLocaleString()} plays · {ownStats.totalHours.toLocaleString()} hours
              </p>
            )}
          </>
        ) : (
          <p className="text-sm text-(--color-text-muted)">
            No plays yet in this period — your rank will appear once you do.
          </p>
        )}
      </div>

      {rank !== null && (above || below) && (
        <div className="rounded-xl border border-(--color-border) bg-(--color-surface) divide-y divide-(--color-border)">
          {above && (
            <div className="flex items-center justify-between px-4 py-2.5 text-sm">
              <span className="text-(--color-text-muted)">Rank {above.rank}</span>
              <span className="text-(--color-text)">{above.name ?? 'Anonymous'}</span>
            </div>
          )}
          {below && (
            <div className="flex items-center justify-between px-4 py-2.5 text-sm">
              <span className="text-(--color-text-muted)">Rank {below.rank}</span>
              <span className="text-(--color-text)">{below.name ?? 'Anonymous'}</span>
            </div>
          )}
        </div>
      )}

      <div className="rounded-xl border border-(--color-border) bg-(--color-surface) p-4 flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-(--color-text)">Show my name to nearby ranks</p>
          <p className="text-xs text-(--color-text-muted) mt-0.5">
            Otherwise you appear to others only as &quot;Rank N&quot;, with no name attached.
          </p>
        </div>
        <form action="/api/leaderboard/public" method="POST">
          <input type="hidden" name="value" value={fullyPublic ? 'false' : 'true'} />
          <button
            type="submit"
            className={`shrink-0 px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
              fullyPublic
                ? 'bg-(--color-accent) text-(--color-accent-text) border-(--color-accent)'
                : 'text-(--color-text-muted) hover:text-(--color-text) border-(--color-border)'
            }`}
          >
            {fullyPublic ? 'On' : 'Off'}
          </button>
        </form>
      </div>

      <form action="/api/leaderboard/opt-in" method="POST">
        <input type="hidden" name="value" value="false" />
        <button type="submit" className="text-xs text-(--color-text-muted) hover:text-(--color-text) underline">
          Leave the leaderboard
        </button>
      </form>
    </div>
  );
}
