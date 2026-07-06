import { getLibraries, SentinelError } from '@/lib/sentinel/client';

export default async function LibrariesPage() {
  try {
    const libraries = await getLibraries();
    const sorted = [...libraries].sort((a, b) => a.name.localeCompare(b.name));

    return (
      <div className="rounded-xl border border-(--color-border) bg-(--color-surface) overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-(--color-text-muted) border-b border-(--color-border)">
              <th className="px-3 py-2 font-medium">Library</th>
              <th className="px-3 py-2 font-medium">Type</th>
              <th className="px-3 py-2 font-medium">Items</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((library) => (
              <tr key={library.id} className="border-b border-(--color-border) last:border-0">
                <td className="px-3 py-2 text-(--color-text)">{library.name}</td>
                <td className="px-3 py-2 text-(--color-text-muted) capitalize">{library.type}</td>
                <td className="px-3 py-2 text-(--color-text-muted)">{library.metadataCount.toLocaleString()}</td>
              </tr>
            ))}
            {sorted.length === 0 && (
              <tr>
                <td colSpan={3} className="px-3 py-8 text-center text-(--color-text-muted)">
                  No libraries found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    );
  } catch (err) {
    const message = err instanceof SentinelError ? err.message : 'Could not reach Sentinel.';
    return <div className="rounded-xl border border-red-800 bg-red-950/40 text-red-300 text-sm p-4">{message}</div>;
  }
}
