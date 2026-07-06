import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth/session';

// Authoritative tier check for everything under /dashboard — the admin-only surface.
// Middleware only checks for a cookie's presence; this is where isAdmin is actually verified.
export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect('/login');
  if (!session.isAdmin) redirect('/me');

  return <>{children}</>;
}
