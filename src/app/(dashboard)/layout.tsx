import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { Providers } from '@/components/providers/session-provider';
import { AppShell } from '@/components/layout/app-shell';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session) redirect('/login');

  return (
    <Providers>
      <AppShell user={session.user}>{children}</AppShell>
    </Providers>
  );
}
