const ERROR_MESSAGES: Record<string, string> = {
  plex_unreachable: "Couldn't reach Plex. Please try again in a moment.",
  session_expired: 'Your sign-in attempt expired before finishing. Please try again.',
  pin_timeout: "Didn't hear back from Plex in time. Please try again.",
  no_history:
    "We couldn't find any Plex history for your account yet. This can happen if Sentinel hasn't " +
    "synced your user — ask the server admin to check, or try again later once you've streamed something.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const message = error ? (ERROR_MESSAGES[error] ?? 'Something went wrong signing in.') : null;

  return (
    <main className="min-h-screen flex items-center justify-center p-4 bg-[var(--color-bg)]">
      <div className="w-full max-w-sm text-center">
        <h1 className="text-3xl font-bold tracking-tight text-[var(--color-text)]">Atrium Stats</h1>
        <p className="text-[var(--color-text-muted)] mt-1.5 text-sm mb-8">
          Your personal Plex stats &amp; year-in-review
        </p>

        <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-8">
          {message && (
            <div className="bg-red-950/40 border border-red-800 text-red-300 text-sm rounded-lg px-3 py-2.5 mb-5 text-left">
              {message}
            </div>
          )}

          <a
            href="/api/auth/plex"
            className="block w-full bg-[var(--color-button)] text-[var(--color-button-text)] font-medium rounded-lg py-2.5 text-sm transition-opacity hover:opacity-90"
          >
            Sign in with Plex
          </a>
        </div>

        <p className="text-center text-xs text-[var(--color-text-muted)] mt-6">
          Ask your server admin if you don&apos;t have access yet.
        </p>
      </div>
    </main>
  );
}
