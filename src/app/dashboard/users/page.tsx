import Link from 'next/link';
import { getUsers, SentinelError } from '@/lib/sentinel/client';
import UserAvatar from '@/components/ui/UserAvatar';

// Sentinel's /v1/users already returns users sorted by play count descending.
export default async function UsersPage() {
  try {
    const users = await getUsers();

    return (
      <div className="rounded-xl border border-(--color-border) bg-(--color-surface) overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-(--color-text-muted) border-b border-(--color-border)">
              <th className="px-3 py-2 font-medium">User</th>
              <th className="px-3 py-2 font-medium">Plays</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id} className="border-b border-(--color-border) last:border-0">
                <td className="px-3 py-2">
                  <Link href={`/dashboard/users/${user.id}`} className="flex items-center gap-3 hover:text-(--color-accent)">
                    <UserAvatar thumb={user.thumb} username={user.displayName ?? user.username} />
                    <span className="text-(--color-text)">
                      {user.displayName ?? user.username}
                      {user.isOwner && (
                        <span className="ml-2 text-[10px] uppercase tracking-wide text-(--color-accent)">Owner</span>
                      )}
                    </span>
                  </Link>
                </td>
                <td className="px-3 py-2 text-(--color-text-muted)">{user.totalSessions ?? 0}</td>
              </tr>
            ))}
            {users.length === 0 && (
              <tr>
                <td colSpan={2} className="px-3 py-8 text-center text-(--color-text-muted)">
                  No users found.
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
