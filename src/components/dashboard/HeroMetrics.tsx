export default function HeroMetrics({
  totalPlays,
  totalHours,
  uniqueUsers,
  liveCount,
}: {
  totalPlays: number;
  totalHours: number;
  uniqueUsers: number;
  liveCount: number;
}) {
  const metrics = [
    { label: 'Now Playing', value: liveCount },
    { label: 'Plays (30d)', value: totalPlays.toLocaleString() },
    { label: 'Hours Watched (30d)', value: totalHours.toLocaleString() },
    { label: 'Active Users (30d)', value: uniqueUsers },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      {metrics.map((m) => (
        <div key={m.label} className="rounded-xl border border-(--color-border) bg-(--color-surface) p-4">
          <p className="text-2xl font-semibold text-(--color-text)">{m.value}</p>
          <p className="text-xs text-(--color-text-muted) mt-1">{m.label}</p>
        </div>
      ))}
    </div>
  );
}
