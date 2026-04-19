import { Suspense } from 'react';
import { requireDashboardSession } from '@/lib/auth';
import AssociateTaskView from '@/components/dashboard/AssociateTaskView';
import ClientProfile from '@/components/dashboard/ClientProfile';
import ChartSkeleton from '@/components/dashboard/ChartSkeleton';

export const metadata = { title: 'My Clients | Dashboard' };

export default async function AssociateDashboardPage() {
  const user = await requireDashboardSession();

  return (
    <div className="page-enter">
      <div style={{ marginBottom: '2rem' }}>
        <p className="label-luxury">Stylist View</p>
        <h1 className="heading-display" style={{ fontSize: '2rem', marginTop: '0.5rem' }}>
          My Clients
        </h1>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.25rem' }}>
        <Suspense fallback={<ChartSkeleton />}>
          {user.tenant_id && (
            <AssociateTaskView tenantId={user.tenant_id} userId={user.id} stylistId={user.id} />
          )}
        </Suspense>

        <Suspense fallback={<ChartSkeleton />}>
          {user.tenant_id && (
            <ClientProfile tenantId={user.tenant_id} userId={user.id} />
          )}
        </Suspense>
      </div>
    </div>
  );
}
