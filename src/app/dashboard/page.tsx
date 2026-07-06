import { getSession } from '@/lib/auth/session';

export default async function DashboardPage() {
  const session = await getSession();

  return (
    <main className="min-h-screen flex items-center justify-center p-8 bg-[var(--color-bg)] text-[var(--color-text)]">
      <div className="text-center max-w-md">
        <h1 className="text-2xl font-semibold mb-2">Welcome back, {session?.username}</h1>
        <p className="text-[var(--color-text-muted)] text-sm">
          Live activity, history, users, libraries, and server stats land in Batch 2 and Batch 3.
          Batch 1&apos;s foundation — auth, the Sentinel client, and theming — is in place.
        </p>
      </div>
    </main>
  );
}
