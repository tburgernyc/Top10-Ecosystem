import { requireCustomerSession } from '@/lib/auth';
import { db } from '@toptenprom/database';
import { appointments, customers, dress_reservations, dresses, tenants } from '@toptenprom/database';
import { eq, desc } from 'drizzle-orm';
import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'My Account | Top 10 Prom' };

export default async function AccountPage() {
  const session = await requireCustomerSession();

  const customerRows = await db.select({ id: customers.id })
    .from(customers).where(eq(customers.user_id, session.id)).limit(1);
  const customerId = customerRows[0]?.id ?? null;

  const upcomingAppointments = customerId
    ? await db.select({
        id: appointments.id,
        appointment_date: appointments.appointment_date,
        service_type: appointments.service_type,
        status: appointments.status,
        confirmation_code: appointments.confirmation_code,
        boutique_name: tenants.name,
        boutique_city: tenants.city,
      })
      .from(appointments)
      .leftJoin(tenants, eq(appointments.tenant_id, tenants.id))
      .where(eq(appointments.customer_id, customerId))
      .orderBy(desc(appointments.appointment_date))
      .limit(5)
    : [];

  const reservations = customerId
    ? await db.select({
        id: dress_reservations.id,
        color_name: dress_reservations.color_name,
        size: dress_reservations.size,
        status: dress_reservations.reservation_status,
        dress_name: dresses.name,
        dress_designer: dresses.designer,
      })
      .from(dress_reservations)
      .leftJoin(dresses, eq(dress_reservations.dress_id, dresses.id))
      .where(eq(dress_reservations.customer_id, customerId))
      .limit(5)
    : [];

  const firstName = session.first_name || session.email.split('@')[0];

  return (
    <div style={{ padding: '1.5rem', maxWidth: '900px', margin: '0 auto' }}>
      <div style={{ marginBottom: '2rem' }}>
        <h1 className="heading-section" style={{ fontSize: '1.75rem' }}>
          Welcome back, {firstName}
        </h1>
        <p style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem', marginTop: '0.25rem' }}>
          Your prom planning hub
        </p>
      </div>

      {/* Quick actions */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '0.75rem', marginBottom: '2.5rem' }}>
        {[
          { label: 'Book Appointment', href: '/book' },
          { label: 'Virtual Try-On', href: '/try-on' },
          { label: 'Find Boutique', href: '/locator' },
          { label: 'AI Stylist', href: '/home' },
        ].map((a) => (
          <Link
            key={a.href}
            href={a.href}
            className="glass-card"
            style={{
              display: 'block',
              padding: '1.25rem 1rem',
              textAlign: 'center',
              fontSize: '0.875rem',
              color: 'var(--color-text-muted)',
              textDecoration: 'none',
              transition: 'border-color 0.2s ease',
            }}
          >
            {a.label}
          </Link>
        ))}
      </div>

      {/* Upcoming appointments */}
      <section style={{ marginBottom: '2.5rem' }}>
        <h2 className="heading-section" style={{ fontSize: '1.125rem', marginBottom: '1rem' }}>Upcoming Appointments</h2>
        {upcomingAppointments.length === 0 ? (
          <div className="glass-card" style={{ padding: '2rem', textAlign: 'center' }}>
            <p style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>No appointments yet.</p>
            <Link href="/book" style={{ color: 'var(--color-primary)', fontSize: '0.875rem', textDecoration: 'none', display: 'inline-block', marginTop: '0.75rem' }}>
              Book your first appointment →
            </Link>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {upcomingAppointments.map((a) => (
              <div key={a.id} className="glass-card" style={{ padding: '1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <p style={{ fontWeight: 600, fontSize: '0.9375rem' }}>{a.service_type}</p>
                  <p style={{ color: 'var(--color-text-muted)', fontSize: '0.8125rem', marginTop: '0.2rem' }}>
                    {a.boutique_name}{a.boutique_city ? `, ${a.boutique_city}` : ''}
                  </p>
                  <p style={{ color: 'var(--color-text-tertiary)', fontSize: '0.75rem', marginTop: '0.2rem' }}>
                    {new Date(a.appointment_date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                  </p>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span style={{
                    fontSize: '0.75rem', padding: '0.2rem 0.6rem', borderRadius: '999px',
                    background: a.status === 'confirmed' ? 'rgba(34,197,94,0.15)' : 'rgba(255,255,255,0.08)',
                    color: a.status === 'confirmed' ? '#4ade80' : 'var(--color-text-muted)',
                  }}>{a.status}</span>
                  <p style={{ color: 'var(--color-text-tertiary)', fontSize: '0.7rem', marginTop: '0.4rem' }}>{a.confirmation_code}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Dress registry */}
      <section>
        <h2 className="heading-section" style={{ fontSize: '1.125rem', marginBottom: '1rem' }}>My Dress Registry</h2>
        {reservations.length === 0 ? (
          <p style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>
            No dresses saved yet.{' '}
            <Link href="/try-on" style={{ color: 'var(--color-primary)', textDecoration: 'none' }}>Try one on virtually →</Link>
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {reservations.map((r) => (
              <div key={r.id} className="glass-card" style={{ padding: '1.25rem' }}>
                <p style={{ fontWeight: 600, fontSize: '0.9375rem' }}>{r.dress_name}</p>
                <p style={{ color: 'var(--color-text-muted)', fontSize: '0.8125rem', marginTop: '0.2rem' }}>
                  {r.dress_designer} · {r.color_name} · Size {r.size}
                </p>
                <span style={{
                  display: 'inline-block', marginTop: '0.4rem', fontSize: '0.75rem', padding: '0.2rem 0.6rem', borderRadius: '999px',
                  background: r.status === 'confirmed' ? 'rgba(34,197,94,0.15)' : 'rgba(255,255,255,0.08)',
                  color: r.status === 'confirmed' ? '#4ade80' : 'var(--color-text-muted)',
                }}>{r.status}</span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
