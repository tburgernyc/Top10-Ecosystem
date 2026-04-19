import { withTenant } from '@toptenprom/database';
import { appointments, customers, users } from '@toptenprom/database';
import { eq, sql } from 'drizzle-orm';

interface Props {
  tenantId: string;
  userId: string;
  stylistId: string;
}

export default async function AssociateTaskView({ tenantId, userId, stylistId }: Props) {
  let todayAppointments: Array<{
    id: string;
    appointment_date: Date;
    service_type: string;
    status: string;
    customer_first_name: string | null;
    customer_last_name: string | null;
  }> = [];

  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    todayAppointments = await withTenant(tenantId, userId, 'stylist', async (tx) => {
      return tx
        .select({
          id: appointments.id,
          appointment_date: appointments.appointment_date,
          service_type: appointments.service_type,
          status: appointments.status,
          customer_first_name: users.first_name,
          customer_last_name: users.last_name,
        })
        .from(appointments)
        .leftJoin(customers, eq(appointments.customer_id, customers.id))
        .leftJoin(users, eq(customers.user_id, users.id))
        .where(
          sql`appointments.stylist_id = ${stylistId}
          AND appointments.appointment_date >= ${today}
          AND appointments.appointment_date < ${tomorrow}`
        )
        .orderBy(appointments.appointment_date);
    });
  } catch (error) {
    console.error('[AssociateTaskView] Query failed:', error);
    return (
      <div className="glass-card" style={{ padding: '1.5rem' }}>
        <p style={{ color: 'var(--color-text-tertiary)' }}>Schedule unavailable</p>
      </div>
    );
  }

  return (
    <div className="glass-card" style={{ padding: '1.5rem' }}>
      <p className="label-luxury" style={{ marginBottom: '1.25rem' }}>Today&apos;s Schedule</p>
      {todayAppointments.length === 0 ? (
        <p style={{ color: 'var(--color-text-muted)', textAlign: 'center', padding: '2rem 0' }}>
          No appointments today
        </p>
      ) : (
        <ul style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', listStyle: 'none' }}>
          {todayAppointments.map((appt) => (
            <li
              key={appt.id}
              style={{
                padding: '1rem',
                borderRadius: 'var(--radius-md)',
                background: 'var(--color-bg-glass)',
                border: '1px solid var(--color-border)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <p style={{ fontWeight: 600, fontSize: '1rem' }}>
                    {appt.customer_first_name} {appt.customer_last_name}
                  </p>
                  <p style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem', marginTop: '0.25rem' }}>
                    {appt.service_type} · {new Date(appt.appointment_date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
                <span
                  style={{
                    padding: '0.25rem 0.75rem',
                    borderRadius: 'var(--radius-pill)',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    background: appt.status === 'confirmed' ? 'rgba(50, 215, 75, 0.15)' : 'rgba(255, 214, 10, 0.15)',
                    color: appt.status === 'confirmed' ? 'var(--color-success)' : 'var(--color-warning)',
                  }}
                >
                  {appt.status}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
