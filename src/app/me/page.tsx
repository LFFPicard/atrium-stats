import { getSession } from '@/lib/auth/session';

export default async function MePage() {
  const session = await getSession();

  return (
    <main className="min-h-screen flex items-center justify-center p-8 bg-[var(--color-bg)] text-[var(--color-text)]">
      <div className="text-center max-w-md">
        <h1 className="text-2xl font-semibold mb-2">Hey, {session?.username}</h1>
        <p className="text-[var(--color-text-muted)] text-sm">
          Your personal stats, leaderboard, and Wrapped slideshow land in Batch 4 and Batch 5.
          Batch 1&apos;s foundation — auth, the Sentinel client, and theming — is in place.
        </p>
      </div>
    </main>
  );
}
