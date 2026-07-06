'use client';

import { useState } from 'react';
import Sidebar from './Sidebar';
import Topbar from './Topbar';

export default function DashboardShell({ username, children }: { username: string; children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex h-screen bg-(--color-bg) overflow-hidden">
      <Sidebar username={username} mobileOpen={mobileOpen} onMobileClose={() => setMobileOpen(false)} />

      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <Topbar onMenuToggle={() => setMobileOpen((o) => !o)} />
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  );
}
