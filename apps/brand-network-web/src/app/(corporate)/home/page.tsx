import type { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import { db } from '@toptenprom/database';
import { tenants } from '@toptenprom/database';
import { eq, count } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Home | Top 10 Prom — Luxury Boutique Network',
  description: 'From high school prom to wedding day perfection — discover designer gowns, AI-powered styling, and Virtual Try-On at 55 locations nationwide.',
};

async function getNetworkStats() {
  try {
    const [result] = await db
      .select({ activeBoutiques: count() })
      .from(tenants)
      .where(eq(tenants.is_active, true));
    return { activeBoutiques: result?.activeBoutiques ?? 55 };
  } catch {
    return { activeBoutiques: 55 };
  }
}

export default async function HomePage() {
  const { activeBoutiques } = await getNetworkStats();

  return (
    <div>
      {/* ── HERO ── */}
      <section
        className="mesh-bg"
        style={{
          minHeight: '100dvh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 'clamp(6rem, 12vw, 10rem) 2rem 4rem',
          textAlign: 'center',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <p className="label-luxury" style={{ marginBottom: '1.5rem', color: 'var(--color-brand-secondary)' }}>
          The Premier Network
        </p>
        <h1
          className="heading-display"
          style={{
            fontSize: 'clamp(3.5rem, 9vw, 8rem)',
            maxWidth: '14ch',
            lineHeight: 1.0,
            marginBottom: '2rem',
          }}
        >
          Your Perfect Dress Awaits
        </h1>
        <p
          style={{
            color: 'var(--color-text-secondary)',
            fontSize: 'clamp(1rem, 2vw, 1.25rem)',
            maxWidth: '600px',
            lineHeight: 1.7,
            marginBottom: '3rem',
          }}
        >
          From high school prom to wedding day perfection — discover designer gowns,
          AI-powered styling, and Virtual Try-On at {activeBoutiques} locations nationwide.
        </p>
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', justifyContent: 'center' }}>
          <Link href="/locator" className="btn-primary" style={{ padding: '1rem 2.5rem' }}>Find Your Boutique</Link>
          <Link href="/try-on" className="btn-ghost" style={{ padding: '1rem 2.5rem' }}>Try Virtual Styling</Link>
        </div>

        {/* Floating stats */}
        <div
          style={{
            position: 'absolute',
            bottom: '3rem',
            left: '50%',
            transform: 'translateX(-50%)',
            display: 'flex',
            gap: '4rem',
            alignItems: 'center',
          }}
        >
          {[
            { value: `${activeBoutiques}`, label: 'Boutique Locations' },
            { value: '500+', label: 'Designer Styles' },
            { value: 'AI', label: 'Virtual Try-On' },
          ].map(({ value, label }) => (
            <div key={label} style={{ textAlign: 'center' }}>
              <p className="heading-display" style={{ fontSize: '2rem', color: 'var(--color-brand-secondary)' }}>{value}</p>
              <p style={{ color: 'var(--color-text-tertiary)', fontSize: '0.75rem', letterSpacing: '0.1em', textTransform: 'uppercase' }}>{label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── VTO FEATURE SECTION ── */}
      <section
        style={{
          padding: 'clamp(4rem, 8vw, 8rem) clamp(1.5rem, 5vw, 4rem)',
          background: 'var(--color-bg-elevated)',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
          gap: '4rem',
          alignItems: 'center',
        }}
      >
        <div>
          <p className="label-luxury" style={{ marginBottom: '1rem', color: 'var(--color-brand-accent)' }}>AI Innovation</p>
          <h2 className="heading-section" style={{ fontSize: 'clamp(2rem, 5vw, 3.5rem)', marginBottom: '1.5rem' }}>
            See It On You.<br />Before You Buy.
          </h2>
          <p style={{ color: 'var(--color-text-secondary)', lineHeight: 1.7, fontSize: '1.0625rem', marginBottom: '2rem' }}>
            Our AI-powered Virtual Try-On lets you see exactly how any dress looks on your body,
            in any color — in under 10 seconds. Powered by generative diffusion technology.
          </p>
          <Link href="/try-on" className="btn-primary">Try It Now — Free</Link>
        </div>
        <div className="bento-card" style={{ padding: '0', overflow: 'hidden', aspectRatio: '4 / 5', position: 'relative' }}>
          <Image
            src="https://images.unsplash.com/photo-1594938298603-c8148c4b4ae4?w=800&auto=format&fit=crop&q=85"
            alt="AI Virtual Try-On demonstration"
            fill
            style={{ objectFit: 'cover' }}
            sizes="(max-width: 768px) 100vw, 50vw"
          />
        </div>
      </section>

      {/* ── NETWORK SCALE SECTION ── */}
      <section
        style={{
          padding: 'clamp(4rem, 8vw, 8rem) clamp(1.5rem, 5vw, 4rem)',
          background: 'var(--color-bg-noir)',
          textAlign: 'center',
        }}
      >
        <p className="label-luxury" style={{ marginBottom: '1rem' }}>Nationwide Reach</p>
        <h2 className="heading-section" style={{ fontSize: 'clamp(2.5rem, 6vw, 4.5rem)', marginBottom: '1.5rem' }}>
          {activeBoutiques} Locations.<br />
          <span style={{ color: 'var(--color-brand-primary)' }}>One Standard of Excellence.</span>
        </h2>
        <p style={{ color: 'var(--color-text-secondary)', fontSize: '1.0625rem', maxWidth: '600px', margin: '0 auto 3rem', lineHeight: 1.7 }}>
          Each boutique in our network carries exclusive designer inventory and is staffed by expert stylists trained to deliver a luxury experience.
        </p>
        <Link href="/locator" className="btn-ghost">View All Locations</Link>
      </section>

      {/* ── RETAIL EXCELLENCE SECTION ── */}
      <section
        style={{
          padding: 'clamp(4rem, 8vw, 8rem) clamp(1.5rem, 5vw, 4rem)',
          background: 'var(--color-bg-elevated)',
        }}
      >
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          <p className="label-luxury" style={{ marginBottom: '1rem', textAlign: 'center' }}>Why Top 10</p>
          <h2 className="heading-section" style={{ fontSize: 'clamp(2rem, 5vw, 3.5rem)', textAlign: 'center', marginBottom: '4rem' }}>
            Retail Excellence Redefined
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1.5rem' }}>
            {[
              { icon: '◈', title: 'No-Duplicate Guarantee', desc: 'Our registry system ensures no two students at the same school reserve the same dress in the same color and size.' },
              { icon: '◷', title: 'AI Personal Stylist', desc: 'Our conversational AI knows your preferences and only recommends dresses that are confirmed in-stock at your nearest boutique.' },
              { icon: '◎', title: 'Instant Booking', desc: 'Book an appointment at any of our 55 locations — with intelligent load-balancing to find you the earliest availability nearby.' },
              { icon: '◻', title: 'Virtual Try-On', desc: 'AI-generated try-on imagery delivers photorealistic results in under 10 seconds, so you can shortlist before you visit.' },
            ].map(({ icon, title, desc }) => (
              <div key={title} className="bento-card">
                <span style={{ fontSize: '2rem', marginBottom: '1.25rem', display: 'block', color: 'var(--color-brand-secondary)' }}>{icon}</span>
                <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.375rem', fontWeight: 600, marginBottom: '0.75rem' }}>{title}</h3>
                <p style={{ color: 'var(--color-text-secondary)', lineHeight: 1.6, fontSize: '0.9375rem' }}>{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FINAL CTA ── */}
      <section
        className="mesh-bg"
        style={{
          padding: 'clamp(5rem, 10vw, 10rem) 2rem',
          textAlign: 'center',
        }}
      >
        <p className="label-luxury" style={{ marginBottom: '1.5rem' }}>Ready to Begin?</p>
        <h2 className="heading-display" style={{ fontSize: 'clamp(2.5rem, 6vw, 5rem)', marginBottom: '2rem' }}>
          Find Your Dream Dress
        </h2>
        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
          <Link href="/catalog" className="btn-primary" style={{ padding: '1rem 3rem' }}>Browse Collection</Link>
          <Link href="/book" className="btn-ghost" style={{ padding: '1rem 3rem' }}>Book Appointment</Link>
        </div>
      </section>
    </div>
  );
}
