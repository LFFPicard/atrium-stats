'use client';

import { useState } from 'react';
import Sidebar, { NavItem } from '@/components/dashboard/Sidebar';
import Topbar from '@/components/dashboard/Topbar';

const userNavItems: NavItem[] = [
  {
    href: '/me',
    label: 'My Stats',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5 shrink-0">
        <path d="M3 21h18M3 21V9l6-6 6 6v12M9 21V13h6v8" />
      </svg>
    ),
  },
  {
    href: '/me/leaderboard',
    label: 'Leaderboard',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5 shrink-0">
        <path d="M8 21h8M12 17v4M7 4h10v4a5 5 0 01-10 0V4z" />
        <path d="M7 5H4v2a3 3 0 003 3M17 5h3v2a3 3 0 01-3 3" />
      </svg>
    ),
  },
];

export default function MeShell({ username, children }: { username: string; children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex h-screen bg-(--color-bg) overflow-hidden">
      <Sidebar username={username} navItems={userNavItems} mobileOpen={mobileOpen} onMobileClose={() => setMobileOpen(false)} />

      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <Topbar onMenuToggle={() => setMobileOpen((o) => !o)} />
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  );
}
