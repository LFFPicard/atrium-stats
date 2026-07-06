import { getHistory } from '@/lib/sentinel/history';
import { getUsers, SentinelError } from '@/lib/sentinel/client';
import HistoryTable from '@/components/dashboard/HistoryTable';

export default async function HistoryPage() {
  try {
    const [initial, users] = await Promise.all([getHistory({ limit: 50, offset: 0 }), getUsers()]);

    return (
      <HistoryTable
        initial={initial}
        users={users.map((u) => ({ id: u.id, username: u.username, displayName: u.displayName }))}
      />
    );
  } catch (err) {
    const message = err instanceof SentinelError ? err.message : 'Could not reach Sentinel.';
    return <div className="rounded-xl border border-red-800 bg-red-950/40 text-red-300 text-sm p-4">{message}</div>;
  }
}
