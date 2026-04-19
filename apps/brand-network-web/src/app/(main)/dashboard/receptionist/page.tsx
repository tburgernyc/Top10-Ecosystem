import { Suspense } from 'react';
import { requireDashboardSession } from '@/lib/auth';
import AppointmentList from '@/components/dashboard/AppointmentList';
import WalkInQueue from '@/components/dashboard/WalkInQueue';
import ChartSkeleton from '@/components/dashboard/ChartSkeleton';

export const metadata = { title: 'Receptionist | Dashboard' };

export default async function ReceptionistPage() {
  const user = await requireDashboardSession();

  return (
    <div className="page-enter">
      <div style={{ marginBottom: '2.5rem' }}>
        <p className="label-luxury">Reception</p>
        <h1 className="heading-display" style={{ fontSize: '2.5rem', marginTop: '0.5rem' }}>
          Today&apos;s Schedule
        </h1>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
        <div className="glass-card" style={{ padding: '1.5rem' }}>
          <p className="label-luxury" style={{ marginBottom: '1.25rem' }}>Appointments</p>
          <Suspense fallback={<ChartSkeleton />}>
            {user.tenant_id && (
              <AppointmentList tenantId={user.tenant_id} userId={user.id} />
            )}
          </Suspense>
        </div>

        <div className="glass-card" style={{ padding: '1.5rem' }}>
          <p className="label-luxury" style={{ marginBottom: '1.25rem' }}>Walk-In Queue</p>
          <Suspense fallback={<ChartSkeleton />}>
            {user.tenant_id && (
              <WalkInQueue tenantId={user.tenant_id} userId={user.id} userRole={user.role} />
            )}
          </Suspense>
        </div>
      </div>
    </div>
  );
}
