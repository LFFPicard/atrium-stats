import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth/session';
import MeShell from '@/components/me/MeShell';

// Any authenticated session (admin or regular user) can view their own personal stats.
export default async function MeLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect('/login');

  return <MeShell username={session.username}>{children}</MeShell>;
}
