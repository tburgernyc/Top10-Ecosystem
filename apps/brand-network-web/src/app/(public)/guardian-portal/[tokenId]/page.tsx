import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { db } from '@toptenprom/database';
import {
  guardian_portal_tokens,
  guardian_profiles,
  customers,
  users,
  dress_reservations,
  appointments,
  dresses,
  tenants,
} from '@toptenprom/database';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcryptjs';

export const metadata: Metadata = {
  title: 'Guardian Portal | Top 10 Prom',
  robots: { index: false, follow: false },
};

interface GuardianPortalPageProps {
  params: Promise<{ tokenId: string }>;
  searchParams: Promise<{ token?: string }>;
}

export default async function GuardianPortalPage({ params, searchParams }: GuardianPortalPageProps) {
  const { tokenId } = await params;
  const { token } = await searchParams;

  if (!token) notFound();

  let tokenRecord:
    | {
        id: string;
        token_hash: string;
        expires_at: Date;
        used_at: Date | null;
        is_revoked: boolean;
        customer_id: string;
        guardian_profile_id: string;
      }
    | undefined;
  try {
    const result = await db
      .select()
      .from(guardian_portal_tokens)
      .where(eq(guardian_portal_tokens.id, tokenId))
      .limit(1);
    tokenRecord = result[0] as typeof tokenRecord;
  } catch {
    notFound();
  }

  if (!tokenRecord) notFound();
  if (tokenRecord.is_revoked) notFound();
  if (new Date() > new Date(tokenRecord.expires_at)) notFound();

  const isValid = await bcrypt.compare(token, tokenRecord.token_hash);
  if (!isValid) notFound();

  try {
    await db
      .update(guardian_portal_tokens)
      .set({ used_at: new Date(), updated_at: new Date() })
      .where(eq(guardian_portal_tokens.id, tokenId));
  } catch {
    // Non-fatal — continue rendering
  }

  const [guardianResult, customerResult] = await Promise.allSettled([
    db.select().from(guardian_profiles).where(eq(guardian_profiles.id, tokenRecord.guardian_profile_id)).limit(1),
    db
      .select({ id: customers.id, first_name: users.first_name })
      .from(customers)
      .innerJoin(users, eq(customers.user_id, users.id))
      .where(eq(customers.id, tokenRecord.customer_id))
      .limit(1),
  ]);

  const guardian = guardianResult.status === 'fulfilled' ? guardianResult.value[0] : null;
  const customer = customerResult.status === 'fulfilled' ? customerResult.value[0] : null;

  if (!guardian || !customer) notFound();

  let activeReservations: {
    id: string;
    color_name: string;
    size: string;
    reservation_status: string;
    dress_name: string;
    designer: string | null;
    price: string | null;
    image_urls: unknown;
  }[] = [];
  try {
    activeReservations = await db
      .select({
        id: dress_reservations.id,
        color_name: dress_reservations.color_name,
        size: dress_reservations.size,
        reservation_status: dress_reservations.reservation_status,
        dress_name: dresses.name,
        designer: dresses.designer,
        price: dresses.retail_price,
        image_urls: dresses.image_urls,
      })
      .from(dress_reservations)
      .innerJoin(dresses, eq(dress_reservations.dress_id, dresses.id))
      .where(eq(dress_reservations.customer_id, tokenRecord.customer_id));
  } catch {
    // Non-fatal
  }

  let upcomingAppointments: {
    id: string;
    appointment_date: Date;
    service_type: string | null;
    status: string;
    confirmation_code: string;
    tenant_name: string;
    tenant_address: string | null;
    tenant_phone: string | null;
  }[] = [];
  try {
    upcomingAppointments = await db
      .select({
        id: appointments.id,
        appointment_date: appointments.appointment_date,
        service_type: appointments.service_type,
        status: appointments.status,
        confirmation_code: appointments.confirmation_code,
        tenant_name: tenants.name,
        tenant_address: tenants.address,
        tenant_phone: tenants.phone,
      })
      .from(appointments)
      .innerJoin(tenants, eq(appointments.tenant_id, tenants.id))
      .where(eq(appointments.customer_id, tokenRecord.customer_id));
  } catch {
    // Non-fatal
  }

  const firstImageUrl = (imageUrls: unknown): string => {
    if (Array.isArray(imageUrls) && imageUrls.length > 0) return imageUrls[0] as string;
    return 'https://images.unsplash.com/photo-1594938298603-c8148c4b4ae4?w=800&auto=format&fit=crop&q=85';
  };

  return (
    <div className="mesh-bg" style={{ minHeight: '100dvh', padding: 'clamp(5rem, 10vw, 7rem) 1.5rem 4rem' }}>
      <div style={{ maxWidth: '760px', margin: '0 auto' }}>
        <div style={{ marginBottom: '3rem' }}>
          <p className="label-luxury" style={{ marginBottom: '0.75rem' }}>Guardian Portal · Read Only</p>
          <h1 className="heading-display" style={{ fontSize: 'clamp(1.75rem, 5vw, 3rem)', lineHeight: 1.1, marginBottom: '0.75rem' }}>
            {customer.first_name}&apos;s Top 10 Prom
          </h1>
          <p style={{ color: 'var(--color-text-secondary)' }}>
            Hi {guardian.first_name} — here&apos;s a read-only view of {customer.first_name}&apos;s reservations and appointments.
          </p>
          <div className="glass-card" style={{ padding: '0.875rem 1.25rem', marginTop: '1.25rem', display: 'inline-block' }}>
            <p style={{ color: 'var(--color-warning)', fontSize: '0.8125rem', fontFamily: 'var(--font-mono)' }}>
              ⚠ This view is read-only. This link may have been invalidated after your first visit.
            </p>
          </div>
        </div>

        {activeReservations.length > 0 && (
          <section style={{ marginBottom: '3rem' }}>
            <h2 className="heading-section" style={{ fontSize: '1.25rem', marginBottom: '1.25rem' }}>Dress Reservations</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {activeReservations.map((r) => (
                <div key={r.id} className="glass-card" style={{ padding: '1.25rem', display: 'flex', gap: '1.25rem', flexWrap: 'wrap' }}>
                  <div style={{ width: '90px', height: '110px', borderRadius: 'var(--radius-md)', overflow: 'hidden', flexShrink: 0, background: 'var(--color-bg-sunken)' }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={firstImageUrl(r.image_urls)} alt={r.dress_name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} loading="lazy" />
                  </div>
                  <div style={{ flex: 1, minWidth: '180px' }}>
                    <p className="label-luxury" style={{ marginBottom: '0.25rem' }}>{r.designer ?? 'House Collection'}</p>
                    <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.125rem', fontWeight: 600, marginBottom: '0.5rem' }}>{r.dress_name}</h3>
                    <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.875rem', marginBottom: '0.25rem' }}>{r.color_name} · Size {r.size}</p>
                    {r.price && <p style={{ color: 'var(--color-brand-secondary)', fontWeight: 600 }}>${r.price}</p>}
                    <span style={{ display: 'inline-block', marginTop: '0.5rem', padding: '0.25rem 0.75rem', borderRadius: 'var(--radius-pill)', background: r.reservation_status === 'active' ? 'rgba(50,215,75,0.15)' : 'rgba(255,69,58,0.15)', color: r.reservation_status === 'active' ? 'var(--color-success)' : 'var(--color-error)', fontSize: '0.75rem', fontWeight: 600 }}>
                      {r.reservation_status.toUpperCase()}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {upcomingAppointments.length > 0 && (
          <section>
            <h2 className="heading-section" style={{ fontSize: '1.25rem', marginBottom: '1.25rem' }}>Appointments</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {upcomingAppointments.map((a) => (
                <div key={a.id} className="glass-card" style={{ padding: '1.25rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.5rem' }}>
                    <div>
                      <p className="label-luxury" style={{ marginBottom: '0.25rem' }}>Confirmation · {a.confirmation_code}</p>
                      <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.125rem', fontWeight: 600 }}>{a.tenant_name}</h3>
                      {a.tenant_address && <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.875rem', marginTop: '0.25rem' }}>{a.tenant_address}</p>}
                      {a.tenant_phone && <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.875rem' }}>{a.tenant_phone}</p>}
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <p style={{ color: 'var(--color-text-primary)', fontWeight: 600 }}>
                        {new Date(a.appointment_date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                      </p>
                      <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.875rem' }}>
                        {new Date(a.appointment_date).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {activeReservations.length === 0 && upcomingAppointments.length === 0 && (
          <div className="glass-card" style={{ padding: '3rem', textAlign: 'center' }}>
            <p style={{ color: 'var(--color-text-secondary)' }}>No reservations or appointments found yet.</p>
          </div>
        )}
      </div>
    </div>
  );
}
