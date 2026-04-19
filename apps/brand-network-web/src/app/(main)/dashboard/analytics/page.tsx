import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import { requireDashboardSession } from '@/lib/auth';
import {
  getNetworkKPISnapshot,
  getTenantKPITable,
  getNetworkAppointmentTrend,
} from '@/lib/analytics/network-queries';
import NetworkKPICards from './NetworkKPICards';
import TenantKPITable from './TenantKPITable';
import AppointmentTrendChart from './AppointmentTrendChart';
import AnalyticsSkeleton from './AnalyticsSkeleton';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Analytics | Top 10 Prom Dashboard',
  robots: { index: false },
};

export default async function AnalyticsPage() {
  let session: Awaited<ReturnType<typeof requireDashboardSession>>;
  try {
    session = await requireDashboardSession();
  } catch {
    redirect('/login');
  }

  const isSuperAdmin = session.role === 'super_admin';
  const tenantFilter = isSuperAdmin ? undefined : session.tenant_id ?? undefined;

  const [kpi, tenantRows, trend] = await Promise.all([
    getNetworkKPISnapshot(),
    getTenantKPITable(tenantFilter),
    getNetworkAppointmentTrend(tenantFilter),
  ]);

  return (
    <div style={{ padding: 'clamp(1.5rem, 4vw, 3rem)' }}>
      <div style={{ marginBottom: '2.5rem' }}>
        <p className="label-luxury" style={{ marginBottom: '0.5rem' }}>
          {isSuperAdmin ? 'Franchise Network' : (tenantRows[0]?.tenantName ?? 'Dashboard')} · Analytics
        </p>
        <h1 className="heading-section" style={{ fontSize: 'clamp(1.75rem, 4vw, 2.5rem)' }}>
          {isSuperAdmin ? 'Network Intelligence' : 'Location Performance'}
        </h1>
      </div>

      <Suspense fallback={<AnalyticsSkeleton type="cards" />}>
        <NetworkKPICards kpi={kpi} isSuperAdmin={isSuperAdmin} />
      </Suspense>

      <div style={{ marginTop: '2.5rem' }}>
        <h2 className="heading-section" style={{ fontSize: '1.25rem', marginBottom: '1.25rem' }}>
          Appointment Trend — Last 12 Weeks
        </h2>
        <Suspense fallback={<AnalyticsSkeleton type="chart" />}>
          <AppointmentTrendChart data={trend} />
        </Suspense>
      </div>

      {isSuperAdmin && (
        <div style={{ marginTop: '2.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
            <h2 className="heading-section" style={{ fontSize: '1.25rem' }}>
              Location Breakdown ({tenantRows.length} locations)
            </h2>
            <Link
              href="/dashboard/analytics/export"
              className="btn-ghost"
              style={{ fontSize: '0.875rem', padding: '0.625rem 1.25rem' }}
            >
              Export PDF Report
            </Link>
          </div>
          <Suspense fallback={<AnalyticsSkeleton type="table" />}>
            <TenantKPITable rows={tenantRows} />
          </Suspense>
        </div>
      )}
    </div>
  );
}
