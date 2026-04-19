import { withTenant } from '@toptenprom/database';
import { boutique_staff, appointments } from '@toptenprom/database';
import { eq, sql, count } from 'drizzle-orm';

interface Props {
  tenantId: string;
  userId: string;
}

export default async function StylistUtilizationChart({ tenantId, userId }: Props) {
  let stylistData: Array<{ name: string; appointments: number; utilization: number }> = [];

  try {
    const result = await withTenant(tenantId, userId, 'owner', async (tx) => {
      return tx
        .select({
          first_name: sql<string>`users.first_name`,
          last_name: sql<string>`users.last_name`,
          appointment_count: count(appointments.id),
        })
        .from(boutique_staff)
        .leftJoin(appointments, eq(boutique_staff.id, appointments.stylist_id))
        .where(sql`boutique_staff.tenant_id = ${tenantId} AND boutique_staff.role = 'stylist'`)
        .groupBy(sql`users.first_name, users.last_name, boutique_staff.id`);
    });

    const maxCount = Math.max(...result.map((r) => r.appointment_count ?? 0), 1);
    stylistData = result.map((r) => ({
      name: `${r.first_name} ${r.last_name}`,
      appointments: r.appointment_count ?? 0,
      utilization: Math.round(((r.appointment_count ?? 0) / maxCount) * 100),
    }));
  } catch (error) {
    console.error('[StylistUtilizationChart] Query failed:', error);
    return <p style={{ color: 'var(--color-text-tertiary)', fontSize: '0.875rem' }}>Chart unavailable</p>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      {stylistData.map(({ name, appointments: appts, utilization }) => (
        <div key={name} style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <p style={{ width: '120px', fontSize: '0.875rem', color: 'var(--color-text-secondary)', flexShrink: 0 }}>
            {name}
          </p>
          <div
            style={{
              flex: 1,
              height: '8px',
              background: 'var(--color-surface-glass-md)',
              borderRadius: 'var(--radius-pill)',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                width: `${utilization}%`,
                height: '100%',
                background: 'linear-gradient(90deg, var(--color-brand-primary), var(--color-brand-accent))',
                borderRadius: 'var(--radius-pill)',
                transition: 'width 0.8s var(--ease-luxury)',
              }}
            />
          </div>
          <p style={{ width: '30px', fontSize: '0.75rem', color: 'var(--color-text-tertiary)', textAlign: 'right' }}>
            {appts}
          </p>
        </div>
      ))}
    </div>
  );
}
