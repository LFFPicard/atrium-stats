'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import UserAvatar from '@/components/ui/UserAvatar';

export interface NavItem {
  href: string;
  label: string;
  icon: React.ReactNode;
}

interface SidebarProps {
  username: string;
  navItems: NavItem[];
  mobileOpen: boolean;
  onMobileClose: () => void;
}

export default function Sidebar({ username, navItems, mobileOpen, onMobileClose }: SidebarProps) {
  const pathname = usePathname();
  // Only the first item (the tier's own root — /dashboard or /me) needs an exact match;
  // every other item is itself a sub-route prefix (e.g. /dashboard/history, /me/leaderboard).
  const rootHref = navItems[0]?.href;
  const isActive = (href: string) => (href === rootHref ? pathname === href : pathname.startsWith(href));

  const navLinkClass = (active: boolean) =>
    `flex items-center gap-3 px-2.5 py-2 rounded-lg text-sm font-medium transition-colors ${
      active
        ? 'bg-(--color-surface) text-(--color-accent)'
        : 'text-(--color-sidebar-text) hover:text-(--color-text) hover:bg-(--color-surface)'
    }`;

  const sidebarContent = (
    <div className="flex flex-col h-full">
      <div className="flex items-center px-3 h-14 shrink-0 border-b border-(--color-border)">
        <span className="text-base font-bold tracking-tight text-(--color-text)">Atrium Stats</span>
      </div>

      <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-0.5">
        {navItems.map((item) => (
          <Link key={item.href} href={item.href} onClick={onMobileClose} className={navLinkClass(isActive(item.href))}>
            {item.icon}
            <span className="truncate">{item.label}</span>
          </Link>
        ))}
      </nav>

      <div className="shrink-0 border-t border-(--color-border) p-2">
        <div className="flex items-center gap-2.5 px-1 py-1.5 rounded-lg">
          <UserAvatar username={username} />
          <span className="flex-1 text-sm font-medium text-(--color-text) truncate">{username}</span>
          <form action="/api/auth/logout" method="POST">
            <button
              type="submit"
              className="text-(--color-text-muted) hover:text-(--color-text) transition-colors p-1 rounded hover:bg-(--color-surface)"
              aria-label="Sign out"
              title="Sign out"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
                <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9" />
              </svg>
            </button>
          </form>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {mobileOpen && (
        <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden" onClick={onMobileClose} aria-hidden="true" />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 bg-(--color-sidebar) border-r border-(--color-border) transform transition-transform duration-200 ease-in-out lg:hidden ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {sidebarContent}
      </aside>

      <aside className="hidden lg:flex flex-col shrink-0 w-60 bg-(--color-sidebar) border-r border-(--color-border)">
        {sidebarContent}
      </aside>
    </>
  );
}
