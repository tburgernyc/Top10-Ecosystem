import { requireDashboardSession } from '@/lib/auth';
import DashboardNav from '@/components/dashboard/DashboardNav';

export const metadata = { title: 'Dashboard', robots: { index: false, follow: false } };

export const dynamic = 'force-dynamic';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const authUser = await requireDashboardSession();

  return (
    <div style={{ display: 'flex', minHeight: '100dvh', background: 'var(--color-bg)' }}>
      <DashboardNav user={authUser} />
      <main
        style={{
          flex: 1,
          marginLeft: 'clamp(0px, 240px, 240px)',
          padding: '2rem',
          overflowY: 'auto',
        }}
      >
        {children}
      </main>
    </div>
  );
}
