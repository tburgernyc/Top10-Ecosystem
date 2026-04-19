import type { Metadata } from 'next';
import Image from 'next/image';

export const metadata: Metadata = {
  title: 'About Us | Top 10 Prom',
  description: 'The story behind the premier luxury prom and wedding boutique network.',
};

export default function AboutPage() {
  return (
    <div style={{ paddingTop: '7rem' }}>
      {/* Hero */}
      <section
        className="mesh-bg"
        style={{ padding: 'clamp(4rem, 8vw, 8rem) clamp(2rem, 6vw, 6rem)', maxWidth: '900px', margin: '0 auto' }}
      >
        <p className="label-luxury" style={{ marginBottom: '1.5rem', color: 'var(--color-brand-secondary)' }}>
          Our Story
        </p>
        <h1 className="heading-display" style={{ fontSize: 'clamp(2.5rem, 7vw, 6rem)', lineHeight: 1.05, marginBottom: '2rem' }}>
          Built for the<br />
          <span style={{ color: 'var(--color-brand-primary)', fontStyle: 'italic' }}>Extraordinary</span><br />
          Moment.
        </h1>
        <p style={{ color: 'var(--color-text-secondary)', fontSize: '1.125rem', lineHeight: 1.8 }}>
          Top 10 Prom was founded with a singular vision: that every young woman deserves a world-class
          styling experience for the most important nights of her life. We built a network of 55 boutiques,
          each with hand-curated designer collections, AI-powered styling tools, and a team of experts
          dedicated to finding your perfect look.
        </p>
      </section>

      {/* Editorial image break */}
      <div style={{ position: 'relative', width: '100%', height: 'clamp(300px, 50vw, 600px)', overflow: 'hidden' }}>
        <Image
          src="https://images.unsplash.com/photo-1519741347686-c1e0aadf4611?w=1600&auto=format&fit=crop&q=85"
          alt="Top 10 Prom boutique experience"
          fill
          style={{ objectFit: 'cover', transition: `transform 0.8s var(--ease-luxury)` }}
          sizes="100vw"
          priority
        />
        <div
          aria-hidden="true"
          style={{
            position: 'absolute',
            inset: 0,
            background: 'linear-gradient(to bottom, rgba(11,10,14,0.3) 0%, rgba(11,10,14,0.1) 50%, rgba(11,10,14,0.5) 100%)',
          }}
        />
      </div>

      {/* Values */}
      <section style={{ padding: 'clamp(4rem, 8vw, 8rem) clamp(2rem, 6vw, 4rem)', background: 'var(--color-bg-elevated)' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          <p className="label-luxury" style={{ marginBottom: '1rem', textAlign: 'center' }}>Our Values</p>
          <h2 className="heading-section" style={{ fontSize: 'clamp(2rem, 4vw, 3rem)', textAlign: 'center', marginBottom: '4rem' }}>
            Excellence in Every Thread
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem' }}>
            {[
              { icon: '◈', title: 'Curated Excellence', desc: 'Every designer on our floor is personally vetted. We carry only collections we believe in completely.' },
              { icon: '◷', title: 'Time Honored', desc: 'From the moment you book to the moment you walk out — every interaction is designed with intentional care.' },
              { icon: '◎', title: 'Your Story First', desc: 'Your dress is the centerpiece of one of the most photographed nights of your life. We take that seriously.' },
            ].map(({ icon, title, desc }) => (
              <div key={title} className="bento-card">
                <span style={{ fontSize: '2rem', display: 'block', marginBottom: '1.25rem', color: 'var(--color-brand-secondary)' }}>{icon}</span>
                <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.375rem', fontWeight: 600, marginBottom: '0.75rem' }}>{title}</h3>
                <p style={{ color: 'var(--color-text-secondary)', lineHeight: 1.7 }}>{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Network stats */}
      <section
        style={{
          padding: 'clamp(4rem, 8vw, 8rem) 2rem',
          background: 'var(--color-bg-noir)',
          textAlign: 'center',
        }}
      >
        <p className="label-luxury" style={{ marginBottom: '3rem' }}>Our Network at a Glance</p>
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            gap: 'clamp(2rem, 8vw, 6rem)',
            flexWrap: 'wrap',
          }}
        >
          {[
            { value: '55', label: 'Boutique Locations' },
            { value: '500+', label: 'Designer Styles' },
            { value: '12+', label: 'Years of Excellence' },
            { value: '100K+', label: 'Happy Clients' },
          ].map(({ value, label }) => (
            <div key={label}>
              <p className="heading-display" style={{ fontSize: 'clamp(2.5rem, 6vw, 4rem)', color: 'var(--color-brand-secondary)', marginBottom: '0.5rem' }}>
                {value}
              </p>
              <p style={{ color: 'var(--color-text-tertiary)', fontSize: '0.875rem', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                {label}
              </p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
