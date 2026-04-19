import { notFound } from 'next/navigation';
import { resolveTenant } from '@/lib/tenant';
import { db } from '@toptenprom/database';
import { dress_inventory, dresses } from '@toptenprom/database';
import { eq, sql, and } from 'drizzle-orm';
import Link from 'next/link';
import Image from 'next/image';

interface Props {
  params: Promise<{ subdomain: string }>; // MANDATORY async params — Next.js 16
}

async function getFeaturedDresses(tenantId: string) {
  try {
    return db
      .select({
        id: dresses.id,
        name: dresses.name,
        designer: dresses.designer,
        occasion: dresses.occasion,
        retail_price: dresses.retail_price,
        hero_image: sql<string>`dresses.image_urls->>'hero'`,
        color_name: dress_inventory.color_name,
      })
      .from(dress_inventory)
      .leftJoin(dresses, eq(dress_inventory.dress_id, dresses.id))
      .where(
        and(
          eq(dress_inventory.tenant_id, tenantId),
          eq(dress_inventory.in_stock, true),
          eq(dresses.is_active, true)
        )
      )
      .limit(6)
      .orderBy(sql`RANDOM()`);
  } catch {
    return [];
  }
}

export default async function SubdomainPage({ params }: Props) {
  // MANDATORY: await params — Next.js 16 breaking change
  const { subdomain } = await params;
  let tenant = null;

  try {
    tenant = await resolveTenant(subdomain);
  } catch {
    // fail through to notFound()
  }

  if (!tenant) notFound();

  const featuredDresses = await getFeaturedDresses(tenant!.id);

  return (
    <div>
      {/* ── HERO SECTION ── */}
      <section
        className="mesh-bg noise-overlay"
        style={{
          minHeight: '100dvh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '8rem 2rem 4rem',
          textAlign: 'center',
          position: 'relative',
        }}
      >
        <p className="label-luxury" style={{ marginBottom: '1.5rem' }}>
          {tenant!.city}, {tenant!.state}
        </p>

        <h1
          className="heading-display"
          style={{
            fontSize: 'clamp(3rem, 8vw, 7rem)',
            maxWidth: '900px',
            marginBottom: '2rem',
            lineHeight: 1.05,
          }}
        >
          {tenant!.name}
        </h1>

        <p
          style={{
            color: 'var(--color-text-muted)',
            fontSize: '1.25rem',
            maxWidth: '560px',
            marginBottom: '3rem',
            lineHeight: 1.7,
          }}
        >
          Discover your perfect prom or wedding look with our expert stylists and exclusive designer collections.
        </p>

        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', justifyContent: 'center' }}>
          <Link href={`/${subdomain}/book`} className="btn-primary" style={{ fontSize: '1.0625rem', padding: '0.875rem 2.5rem' }}>
            Book an Appointment
          </Link>
          <Link href={`/${subdomain}/try-on`} className="btn-ghost" style={{ fontSize: '1.0625rem', padding: '0.875rem 2.5rem' }}>
            Virtual Try-On
          </Link>
        </div>

        {/* Scroll indicator */}
        <div
          style={{
            position: 'absolute',
            bottom: '2rem',
            left: '50%',
            transform: 'translateX(-50%)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '0.5rem',
            color: 'var(--color-text-tertiary)',
            fontSize: '0.75rem',
            letterSpacing: '0.15em',
            textTransform: 'uppercase',
            animation: 'fadeIn 1s ease 1.5s forwards',
            opacity: 0,
          }}
        >
          <span>Scroll</span>
          <div style={{ width: '1px', height: '32px', background: 'var(--color-surface-border-md)' }} />
        </div>
      </section>

      {/* ── BOUTIQUE DETAILS ── */}
      <section style={{ padding: '4rem 2rem', maxWidth: '1200px', margin: '0 auto' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1.5rem' }}>
          {/* Hours */}
          {tenant!.business_hours && (
            <div className="glass-card" style={{ padding: '2rem' }}>
              <p className="label-luxury" style={{ marginBottom: '1.25rem' }}>Hours</p>
              {Object.entries(tenant!.business_hours).map(([day, hours]) => (
                <div
                  key={day}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    padding: '0.5rem 0',
                    borderBottom: '1px solid var(--color-border)',
                    fontSize: '0.875rem',
                    color: 'var(--color-text-muted)',
                  }}
                >
                  <span style={{ textTransform: 'capitalize' }}>{day}</span>
                  <span>{hours.closed ? 'Closed' : `${hours.open} – ${hours.close}`}</span>
                </div>
              ))}
            </div>
          )}

          {/* Contact */}
          <div className="glass-card" style={{ padding: '2rem' }}>
            <p className="label-luxury" style={{ marginBottom: '1.25rem' }}>Visit Us</p>
            <p style={{ color: 'var(--color-text-muted)', marginBottom: '0.5rem', lineHeight: 1.6 }}>
              {tenant!.address}<br />
              {tenant!.city}, {tenant!.state} {tenant!.zip}
            </p>
            <p style={{ color: 'var(--color-brand-secondary)', fontSize: '0.875rem' }}>
              {tenant!.phone}
            </p>
            <p style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem', marginTop: '0.25rem' }}>
              {tenant!.email}
            </p>
          </div>

          {/* CTA Card */}
          <div
            className="bento-card"
            style={{
              padding: '2rem',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              gap: '1.5rem',
            }}
          >
            <div>
              <p className="label-luxury" style={{ marginBottom: '0.75rem' }}>Ready to Find Your Dress?</p>
              <p style={{ color: 'var(--color-text-muted)', lineHeight: 1.6, fontSize: '0.9375rem' }}>
                Book a personal styling session with one of our expert stylists today.
              </p>
            </div>
            <Link href={`/${subdomain}/book`} className="btn-gold" style={{ textAlign: 'center' }}>
              Book Now
            </Link>
          </div>
        </div>
      </section>

      {/* ── FEATURED COLLECTION ── */}
      {featuredDresses.length > 0 && (
        <section style={{ padding: '4rem 2rem', background: 'var(--color-bg-elevated)' }}>
          <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
            <p className="label-luxury" style={{ marginBottom: '1rem', textAlign: 'center' }}>In Store Now</p>
            <h2 className="heading-section" style={{ fontSize: 'clamp(2rem, 4vw, 3rem)', textAlign: 'center', marginBottom: '3rem' }}>
              Featured Collection
            </h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1.5rem' }}>
              {featuredDresses.map((dress) => (
                <div key={dress.id} className="glass-card" style={{ overflow: 'hidden' }}>
                  {dress.hero_image && (
                    <div style={{ position: 'relative', aspectRatio: '3 / 4', overflow: 'hidden' }}>
                      <Image
                        src={dress.hero_image}
                        alt={`${dress.name ?? 'Dress'} by ${dress.designer ?? 'Designer'}`}
                        fill
                        style={{ objectFit: 'cover', transition: 'transform 0.6s var(--ease-luxury)' }}
                        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                      />
                    </div>
                  )}
                  <div style={{ padding: '1.25rem' }}>
                    <p className="label-luxury" style={{ marginBottom: '0.5rem' }}>
                      {dress.occasion} · {dress.color_name}
                    </p>
                    <p style={{ fontFamily: 'var(--font-display)', fontSize: '1.125rem', fontWeight: 600 }}>
                      {dress.name}
                    </p>
                    <p style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem', marginTop: '0.25rem' }}>
                      {dress.designer}
                    </p>
                    <p style={{ color: 'var(--color-brand-secondary)', fontWeight: 700, marginTop: '0.75rem' }}>
                      ${Number(dress.retail_price).toFixed(0)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
            <div style={{ textAlign: 'center', marginTop: '3rem' }}>
              <Link href={`/${subdomain}/catalog`} className="btn-ghost">
                View Full Collection
              </Link>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
