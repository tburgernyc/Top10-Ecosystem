import { Suspense } from 'react';
import { requireDashboardSession } from '@/lib/auth';
import { withTenant } from '@toptenprom/database';
import { appointments, walk_ins, dress_reservations } from '@toptenprom/database';
import { eq, count, sql } from 'drizzle-orm';
import ChartSkeleton from '@/components/dashboard/ChartSkeleton';
import StylistUtilizationChart from '@/components/dashboard/StylistUtilizationChart';

export const metadata = { title: 'Network Overview | Dashboard' };

async function getOwnerAnalytics(tenantId: string, userId: string) {

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return withTenant(tenantId, userId, 'owner', async (tx) => {
    const [appointmentStats] = await tx
      .select({
        total_today: count(),
        confirmed: sql<number>`count(*) filter (where status = 'confirmed')`,
        in_progress: sql<number>`count(*) filter (where status = 'in_progress')`,
        completed: sql<number>`count(*) filter (where status = 'completed')`,
      })
      .from(appointments)
      .where(sql`tenant_id = ${tenantId} AND appointment_date >= ${today}`);

    const [walkInStats] = await tx
      .select({ active_queue: count() })
      .from(walk_ins)
      .where(sql`tenant_id = ${tenantId} AND status IN ('waiting', 'called', 'with_stylist')`);

    const [reservationStats] = await tx
      .select({ total: count() })
      .from(dress_reservations)
      .where(eq(dress_reservations.tenant_id, tenantId));

    return { appointmentStats, walkInStats, reservationStats };
  });
}

function getTimeOfDay(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'morning';
  if (hour < 17) return 'afternoon';
  return 'evening';
}

function BentoMetricCard({
  label,
  value,
  sub,
  accentColor,
}: {
  label: string;
  value: string;
  sub: string;
  accentColor: string;
}) {
  return (
    <div className="bento-card">
      <p className="label-luxury" style={{ marginBottom: '1rem' }}>{label}</p>
      <p
        style={{
          fontFamily: 'var(--font-display)',
          fontSize: '3rem',
          fontWeight: 700,
          color: accentColor,
          lineHeight: 1,
          marginBottom: '0.5rem',
        }}
      >
        {value}
      </p>
      <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.875rem' }}>{sub}</p>
    </div>
  );
}

export default async function OwnerDashboardPage() {
  const user = await requireDashboardSession();

  let analytics: Awaited<ReturnType<typeof getOwnerAnalytics>> | null = null;

  try {
    if (user.tenant_id) {
      analytics = await getOwnerAnalytics(user.tenant_id, user.id);
    }
  } catch (error) {
    console.error('[OwnerDashboard] Analytics query failed:', error);
  }

  const apptStats = analytics?.appointmentStats;
  const walkStats = analytics?.walkInStats;
  const resStats = analytics?.reservationStats;

  return (
    <div className="page-enter">
      <div style={{ marginBottom: '2.5rem' }}>
        <p className="label-luxury">Dashboard</p>
        <h1 className="heading-display" style={{ fontSize: '2.5rem', marginTop: '0.5rem' }}>
          Network Overview
        </h1>
        <p className="text-muted" style={{ marginTop: '0.5rem' }}>
          Good {getTimeOfDay()}, {user.first_name}. Here&apos;s your boutique at a glance.
        </p>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: '1.25rem',
          marginBottom: '2rem',
        }}
      >
        <BentoMetricCard
          label="Today's Appointments"
          value={apptStats?.total_today?.toString() ?? '—'}
          sub={`${apptStats?.confirmed ?? 0} confirmed · ${apptStats?.in_progress ?? 0} active`}
          accentColor="var(--color-brand-primary)"
        />
        <BentoMetricCard
          label="Active Walk-In Queue"
          value={walkStats?.active_queue?.toString() ?? '—'}
          sub="Customers currently waiting"
          accentColor="var(--color-brand-accent)"
        />
        <BentoMetricCard
          label="Prom Reservations"
          value={resStats?.total?.toString() ?? '—'}
          sub="Active registry holds"
          accentColor="var(--color-brand-secondary)"
        />
        <BentoMetricCard
          label="Completed Today"
          value={apptStats?.completed?.toString() ?? '—'}
          sub="Appointments fulfilled"
          accentColor="var(--color-success)"
        />
      </div>

      <div className="bento-card" style={{ marginBottom: '2rem' }}>
        <p className="label-luxury" style={{ marginBottom: '1rem' }}>Stylist Utilization</p>
        <Suspense fallback={<ChartSkeleton />}>
          {user.tenant_id && (
            <StylistUtilizationChart tenantId={user.tenant_id} userId={user.id} />
          )}
        </Suspense>
      </div>
    </div>
  );
}
