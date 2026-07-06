'use client';

import { usePathname } from 'next/navigation';

const PAGE_TITLES: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/dashboard/stats': 'Stats',
  '/dashboard/history': 'History',
  '/dashboard/users': 'Users',
  '/dashboard/libraries': 'Libraries',
};

export default function Topbar({ onMenuToggle }: { onMenuToggle: () => void }) {
  const pathname = usePathname();
  const pageTitle = PAGE_TITLES[pathname] ?? (pathname.startsWith('/dashboard/users/') ? 'User' : 'Atrium Stats');

  return (
    <header className="h-14 shrink-0 flex items-center gap-3 px-4 bg-(--color-navbar) border-b border-(--color-border)">
      <button
        onClick={onMenuToggle}
        className="lg:hidden flex items-center justify-center w-8 h-8 rounded-md text-(--color-text-muted) hover:text-(--color-navbar-text) hover:bg-(--color-surface) transition-colors"
        aria-label="Toggle menu"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
          <path d="M3 12h18M3 6h18M3 18h18" />
        </svg>
      </button>

      <h1 className="text-sm font-semibold text-(--color-navbar-text)">{pageTitle}</h1>
    </header>
  );
}
