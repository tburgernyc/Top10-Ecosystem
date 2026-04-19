# Phase 7: Cinematic Brand Imprint, Global Page Directory & Routing

---

## [PRE-EXECUTION DIRECTIVE]
**MANDATORY FIRST ACTION:** Read `PHASE_MANIFEST.md` (Phase 0) in full. Verify Phases 1–6 are marked ✅ COMPLETE.

**Role:** Principal Staff Engineer & Lead UX Architect  
**Context:** Complete the full page directory — cinematic splash, homepage, catalog, editorial pages, and auth. Every route listed in `FloatingPillNav.tsx` must exist and be production-ready.  
**Quality Standard:** Apple / LVMH Level. Nothing is skipped. No placeholders. Bodoni Moda for all display headers. Satoshi for UI/body.  
**Execution Rules:**  
- All `params`/`searchParams` MUST be `await`ed before access — Next.js 16 mandatory.  
- Viewport-relative math (`vw`, `dvh`, `clamp()`) over hardcoded pixels.  
- Color swatches for dresses are STRICTLY FORBIDDEN — only high-resolution photography.  
- `--ease-luxury: cubic-bezier(0.16, 1, 0.3, 1)` at 600ms is mandatory for all page transitions.  
- `globals.css` from Phase 2 must NOT be modified — only new CSS can be added in this phase.

---

## [EXECUTION BLOCK 1: Cinematic Splash & Homepage]

### 1.1 — `apps/brand-network-web/src/app/page.tsx` (Root Splash)
```tsx
import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Top 10 Prom — Luxury Boutique Network',
  description: 'The premier luxury prom and wedding boutique network. 55 locations. AI-powered styling.',
};

export default function SplashPage() {
  return (
    <div
      style={{
        position: 'relative',
        minHeight: '100dvh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        background: 'var(--color-bg-noir)',
      }}
    >
      {/* Full-screen video background */}
      <video
        autoPlay
        muted
        loop
        playsInline
        aria-hidden="true"
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          opacity: 0.35,
        }}
      >
        <source src="/videos/splash-bg.mp4" type="video/mp4" />
        <source src="/videos/splash-bg.webm" type="video/webm" />
      </video>

      {/* Dark gradient overlay */}
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          inset: 0,
          background: 'linear-gradient(to bottom, rgba(11,10,14,0.4) 0%, rgba(11,10,14,0.7) 100%)',
        }}
      />

      {/* Noise texture overlay */}
      <div
        className="noise-overlay"
        aria-hidden="true"
        style={{ position: 'absolute', inset: 0, opacity: 0.04, pointerEvents: 'none' }}
      />

      {/* Center content */}
      <div
        className="slide-up"
        style={{ position: 'relative', textAlign: 'center', padding: '2rem', zIndex: 1 }}
      >
        <p className="label-luxury" style={{ marginBottom: '2rem', color: 'var(--color-brand-secondary)' }}>
          55 Boutique Locations
        </p>

        <h1
          className="heading-display"
          style={{
            fontSize: 'clamp(4rem, 14vw, 10rem)',
            lineHeight: 1.0,
            letterSpacing: '-0.03em',
            marginBottom: '3rem',
          }}
        >
          TOP 10<br />
          <span style={{ color: 'var(--color-brand-primary)', fontStyle: 'italic' }}>PROM</span>
        </h1>

        <p
          style={{
            color: 'var(--color-text-secondary)',
            fontSize: 'clamp(1rem, 2.5vw, 1.25rem)',
            maxWidth: '560px',
            margin: '0 auto 3rem',
            lineHeight: 1.7,
          }}
        >
          Luxury prom and wedding boutiques reimagined with AI-powered styling and Virtual Try-On.
        </p>

        {/* Fade-out CTA — CSS transition handles the exit animation */}
        <Link
          href="/home"
          className="btn-gold"
          style={{
            fontSize: 'clamp(0.875rem, 2vw, 1rem)',
            padding: '1.125rem 3.5rem',
            letterSpacing: '0.15em',
          }}
          aria-label="Enter the Top 10 Prom boutique network"
        >
          Enter Boutique
        </Link>
      </div>

      {/* Scroll indicator */}
      <div
        className="fade-in"
        style={{
          position: 'absolute',
          bottom: '2.5rem',
          left: '50%',
          transform: 'translateX(-50%)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '0.5rem',
          color: 'var(--color-text-tertiary)',
          fontSize: '0.6875rem',
          letterSpacing: '0.2em',
          textTransform: 'uppercase',
        }}
      >
        <span>Scroll</span>
        <div
          style={{
            width: '1px',
            height: '40px',
            background: 'linear-gradient(to bottom, var(--color-brand-secondary), transparent)',
            animation: 'pulse 2s ease-in-out infinite',
          }}
        />
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scaleY(1); }
          50%       { opacity: 0.4; transform: scaleY(0.8); }
        }
      `}</style>
    </div>
  );
}
```

### 1.2 — `apps/brand-network-web/src/app/(corporate)/home/page.tsx`
```tsx
import type { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import { db } from '@toptenprom/database';
import { tenants } from '@toptenprom/database';
import { eq, count } from 'drizzle-orm';

export const metadata: Metadata = {
  title: 'Home | Top 10 Prom — Luxury Boutique Network',
};

async function getNetworkStats() {
  'use cache';
  try {
    const [{ activeBoutiques }] = await db
      .select({ activeBoutiques: count() })
      .from(tenants)
      .where(eq(tenants.is_active, true));
    return { activeBoutiques: activeBoutiques ?? 55 };
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
        <div className="bento-card" style={{ padding: '0', overflow: 'hidden', aspectRatio: '4 / 5' }}>
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
```

---

## [EXECUTION BLOCK 2: Catalog with Photography-Only Color Discovery]

### 2.1 — `apps/brand-network-web/src/app/(corporate)/catalog/page.tsx`
```tsx
import type { Metadata } from 'next';
import { db } from '@toptenprom/database';
import { dresses } from '@toptenprom/database';
import { eq, sql } from 'drizzle-orm';
import CatalogGrid from './CatalogGrid';

export const metadata: Metadata = {
  title: 'Catalog | Top 10 Prom',
  description: 'Browse our exclusive collection of prom and wedding dresses.',
};

async function getAllDresses() {
  'use cache';
  try {
    return db.select().from(dresses).where(eq(dresses.is_active, true)).orderBy(dresses.designer, dresses.name);
  } catch {
    return [];
  }
}

export default async function CatalogPage() {
  const allDresses = await getAllDresses();

  const designers = [...new Set(allDresses.map((d) => d.designer))].sort();
  const occasions = ['prom', 'wedding', 'bridesmaid', 'homecoming', 'pageant', 'cocktail'];

  return (
    <div style={{ minHeight: '100dvh', paddingTop: '6rem' }}>
      {/* Header */}
      <div
        className="mesh-bg"
        style={{ padding: '4rem 2rem 3rem', borderBottom: '1px solid var(--color-surface-border)' }}
      >
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          <p className="label-luxury" style={{ marginBottom: '1rem' }}>Exclusive Collections</p>
          <h1 className="heading-display" style={{ fontSize: 'clamp(2.5rem, 6vw, 5rem)' }}>
            Designer Catalog
          </h1>
        </div>
      </div>

      {/* Catalog grid with client-side filtering */}
      <CatalogGrid dresses={allDresses} designers={designers} occasions={occasions} />
    </div>
  );
}
```

### 2.2 — `apps/brand-network-web/src/app/(corporate)/catalog/CatalogGrid.tsx`
```tsx
'use client';

import { useState, useMemo } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import type { dresses } from '@toptenprom/database';

type Dress = typeof dresses.$inferSelect;

interface Props {
  dresses: Dress[];
  designers: string[];
  occasions: string[];
}

export default function CatalogGrid({ dresses, designers, occasions }: Props) {
  const [selectedOccasion, setSelectedOccasion] = useState<string>('all');
  const [selectedDesigner, setSelectedDesigner] = useState<string>('all');
  const [selectedColor, setSelectedColor] = useState<string>('all');

  const filtered = useMemo(() => {
    return dresses.filter((d) => {
      if (selectedOccasion !== 'all' && d.occasion !== selectedOccasion) return false;
      if (selectedDesigner !== 'all' && d.designer !== selectedDesigner) return false;
      if (selectedColor !== 'all') {
        const colors = (d.available_colors as Array<{ name: string }>) ?? [];
        if (!colors.some((c) => c.name.toLowerCase() === selectedColor.toLowerCase())) return false;
      }
      return true;
    });
  }, [dresses, selectedOccasion, selectedDesigner, selectedColor]);

  // All unique colors across catalog — used for photography-based color filter
  const allColors = useMemo(() => {
    const colorMap = new Map<string, string>(); // name -> image_url
    dresses.forEach((d) => {
      const colors = (d.available_colors as Array<{ name: string; swatch_image_url: string }>) ?? [];
      colors.forEach((c) => {
        if (!colorMap.has(c.name)) {
          colorMap.set(c.name, c.swatch_image_url);
        }
      });
    });
    return colorMap;
  }, [dresses]);

  const FilterPill = ({ label, value, current, onSelect }: { label: string; value: string; current: string; onSelect: (v: string) => void }) => (
    <button
      type="button"
      onClick={() => onSelect(value)}
      style={{
        padding: '0.5rem 1.25rem',
        borderRadius: 'var(--radius-pill)',
        border: `1px solid ${current === value ? 'var(--color-brand-primary)' : 'var(--color-surface-border)'}`,
        background: current === value ? 'rgba(242,75,154,0.12)' : 'transparent',
        color: current === value ? 'var(--color-brand-primary)' : 'var(--color-text-secondary)',
        cursor: 'pointer',
        fontSize: '0.875rem',
        fontWeight: current === value ? 600 : 400,
        whiteSpace: 'nowrap',
        transition: 'all 0.2s ease',
      }}
    >
      {label}
    </button>
  );

  return (
    <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '0 2rem' }}>
      {/* Filter Bar */}
      <div
        style={{
          padding: '2rem 0',
          borderBottom: '1px solid var(--color-surface-border)',
          display: 'flex',
          flexDirection: 'column',
          gap: '1.25rem',
        }}
      >
        {/* Occasion filter */}
        <div>
          <p className="label-luxury" style={{ marginBottom: '0.75rem' }}>Occasion</p>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <FilterPill label="All" value="all" current={selectedOccasion} onSelect={setSelectedOccasion} />
            {occasions.map((o) => (
              <FilterPill key={o} label={o.charAt(0).toUpperCase() + o.slice(1)} value={o} current={selectedOccasion} onSelect={setSelectedOccasion} />
            ))}
          </div>
        </div>

        {/* Designer filter */}
        <div>
          <p className="label-luxury" style={{ marginBottom: '0.75rem' }}>Designer</p>
          <div style={{ display: 'flex', gap: '0.5rem', overflowX: 'auto', paddingBottom: '0.25rem' }}>
            <FilterPill label="All Designers" value="all" current={selectedDesigner} onSelect={setSelectedDesigner} />
            {designers.map((d) => (
              <FilterPill key={d} label={d} value={d} current={selectedDesigner} onSelect={setSelectedDesigner} />
            ))}
          </div>
        </div>

        {/* Color filter — PHOTOGRAPHY ONLY. No CSS swatches. */}
        {allColors.size > 0 && (
          <div>
            <p className="label-luxury" style={{ marginBottom: '0.75rem' }}>Color</p>
            <div style={{ display: 'flex', gap: '0.5rem', overflowX: 'auto', alignItems: 'center' }}>
              <button
                type="button"
                onClick={() => setSelectedColor('all')}
                style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '50%',
                  border: `2px solid ${selectedColor === 'all' ? 'var(--color-brand-primary)' : 'var(--color-surface-border)'}`,
                  background: 'var(--color-surface-glass)',
                  cursor: 'pointer',
                  fontSize: '1.25rem',
                }}
                title="All Colors"
                aria-label="Show all colors"
              >
                ✦
              </button>
              {Array.from(allColors.entries()).map(([colorName, imageUrl]) => (
                <button
                  key={colorName}
                  type="button"
                  onClick={() => setSelectedColor(colorName === selectedColor ? 'all' : colorName)}
                  style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: '50%',
                    border: `2px solid ${selectedColor === colorName ? 'var(--color-brand-primary)' : 'transparent'}`,
                    overflow: 'hidden',
                    cursor: 'pointer',
                    flexShrink: 0,
                    padding: 0,
                    // HIGH-RESOLUTION PHOTOGRAPHY — never CSS color values
                    backgroundImage: `url(${imageUrl})`,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                  }}
                  title={colorName}
                  aria-label={`Filter by ${colorName}`}
                  aria-pressed={selectedColor === colorName}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Results count */}
      <div style={{ padding: '1.5rem 0', borderBottom: '1px solid var(--color-surface-border)' }}>
        <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.875rem' }}>
          {filtered.length} {filtered.length === 1 ? 'style' : 'styles'} found
        </p>
      </div>

      {/* Dress Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
          gap: '1.5rem',
          padding: '2rem 0 4rem',
        }}
      >
        {filtered.map((dress) => {
          const images = dress.image_urls as { hero: string; gallery: string[] };
          const colors = (dress.available_colors as Array<{ name: string; swatch_image_url: string }>) ?? [];

          return (
            <article
              key={dress.id}
              className="glass-card"
              style={{ overflow: 'hidden', position: 'relative' }}
            >
              {/* Photography — hero shot */}
              <div style={{ position: 'relative', aspectRatio: '3 / 4', overflow: 'hidden' }}>
                <Image
                  src={images.hero ?? 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=600'}
                  alt={`${dress.name} by ${dress.designer}`}
                  fill
                  style={{ objectFit: 'cover', transition: 'transform 0.6s var(--ease-luxury)' }}
                  onMouseEnter={(e) => (e.currentTarget.style.transform = 'scale(1.05)')}
                  onMouseLeave={(e) => (e.currentTarget.style.transform = 'scale(1)')}
                  sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                />

                {/* Exclusive badge */}
                {dress.is_exclusive && (
                  <div
                    style={{
                      position: 'absolute',
                      top: '1rem',
                      left: '1rem',
                      background: 'var(--color-brand-secondary)',
                      color: 'var(--color-text-inverse)',
                      padding: '0.25rem 0.75rem',
                      borderRadius: 'var(--radius-pill)',
                      fontSize: '0.6875rem',
                      fontWeight: 700,
                      letterSpacing: '0.1em',
                      textTransform: 'uppercase',
                    }}
                  >
                    Exclusive
                  </div>
                )}

                {/* Quick actions overlay */}
                <div
                  style={{
                    position: 'absolute',
                    bottom: 0,
                    left: 0,
                    right: 0,
                    padding: '1.5rem 1rem 1rem',
                    background: 'linear-gradient(to top, rgba(11,10,14,0.9) 0%, transparent 100%)',
                    opacity: 0,
                    transition: 'opacity 0.3s ease',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.opacity = '1')}
                  onMouseLeave={(e) => (e.currentTarget.style.opacity = '0')}
                >
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <Link
                      href={`/try-on?dress_id=${dress.id}`}
                      className="btn-primary"
                      style={{ flex: 1, textAlign: 'center', fontSize: '0.75rem', padding: '0.5rem 1rem' }}
                    >
                      Try On
                    </Link>
                    <Link
                      href={`/book?dress=${dress.id}`}
                      className="btn-ghost"
                      style={{ flex: 1, textAlign: 'center', fontSize: '0.75rem', padding: '0.5rem 1rem' }}
                    >
                      Book
                    </Link>
                  </div>
                </div>
              </div>

              {/* Card metadata */}
              <div style={{ padding: '1.25rem' }}>
                <p className="label-luxury" style={{ marginBottom: '0.5rem' }}>
                  {dress.occasion} · {dress.designer}
                </p>
                <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.125rem', fontWeight: 600, marginBottom: '0.75rem' }}>
                  {dress.name}
                </h3>

                {/* Color photography strip — NO CSS swatches */}
                {colors.length > 0 && (
                  <div style={{ display: 'flex', gap: '0.375rem', marginBottom: '0.75rem' }}>
                    {colors.slice(0, 5).map((color) => (
                      <div
                        key={color.name}
                        title={color.name}
                        style={{
                          width: '24px',
                          height: '24px',
                          borderRadius: '50%',
                          overflow: 'hidden',
                          border: '1px solid var(--color-surface-border)',
                          backgroundImage: `url(${color.swatch_image_url})`,
                          backgroundSize: 'cover',
                          backgroundPosition: 'center',
                          flexShrink: 0,
                        }}
                        aria-label={color.name}
                      />
                    ))}
                    {colors.length > 5 && (
                      <span style={{ fontSize: '0.75rem', color: 'var(--color-text-tertiary)', alignSelf: 'center' }}>
                        +{colors.length - 5}
                      </span>
                    )}
                  </div>
                )}

                <p style={{ color: 'var(--color-brand-secondary)', fontWeight: 700, fontSize: '1.0625rem' }}>
                  ${Number(dress.retail_price).toFixed(0)}
                </p>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
```

---

## [EXECUTION BLOCK 3: Editorial Pages]

### 3.1 — `apps/brand-network-web/src/app/(corporate)/about/page.tsx`
```tsx
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
          Top 10 Prom was founded with a singular vision: that every young woman deserves a world-class styling experience for the most important nights of her life. 
          We built a network of 55 boutiques, each with hand-curated designer collections, AI-powered styling tools, and a team of experts dedicated to finding your perfect look.
        </p>
      </section>

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
              { icon: '◷', title: 'Time Honored', desc: 'From the moment you book to the moment you walk out — every interaction is designed with care.' },
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
    </div>
  );
}
```

### 3.2 — `apps/brand-network-web/src/app/(corporate)/contact/page.tsx`
```tsx
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Contact | Top 10 Prom',
  description: 'Get in touch with the Top 10 Prom network team.',
};

export default function ContactPage() {
  return (
    <div
      className="mesh-bg"
      style={{ minHeight: '100dvh', paddingTop: '8rem', paddingBottom: '4rem' }}
    >
      <div style={{ maxWidth: '720px', margin: '0 auto', padding: '0 2rem' }}>
        <p className="label-luxury" style={{ marginBottom: '1rem', textAlign: 'center' }}>Get in Touch</p>
        <h1 className="heading-display" style={{ fontSize: 'clamp(2.5rem, 6vw, 4rem)', textAlign: 'center', marginBottom: '3rem' }}>
          Contact Us
        </h1>

        <div className="glass-card" style={{ padding: '2.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {[
            { label: 'Your Name', type: 'text', placeholder: 'Jane Smith' },
            { label: 'Email', type: 'email', placeholder: 'jane@example.com' },
            { label: 'Phone (optional)', type: 'tel', placeholder: '(555) 000-0000' },
          ].map(({ label, type, placeholder }) => (
            <div key={label} style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <label style={{ color: 'var(--color-text-secondary)', fontSize: '0.875rem' }}>{label}</label>
              <input type={type} className="input-luxury" placeholder={placeholder} />
            </div>
          ))}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <label style={{ color: 'var(--color-text-secondary)', fontSize: '0.875rem' }}>Message</label>
            <textarea
              className="input-luxury"
              placeholder="How can we help you?"
              rows={5}
              style={{ resize: 'vertical', lineHeight: 1.6 }}
            />
          </div>

          <button type="button" className="btn-primary" style={{ width: '100%', marginTop: '0.5rem' }}>
            Send Message
          </button>
        </div>

        <div style={{ textAlign: 'center', marginTop: '2rem', color: 'var(--color-text-secondary)' }}>
          <p>Corporate Inquiries: <span style={{ color: 'var(--color-brand-secondary)' }}>info@toptenprom.com</span></p>
          <p style={{ marginTop: '0.5rem' }}>Press: <span style={{ color: 'var(--color-brand-secondary)' }}>press@toptenprom.com</span></p>
        </div>
      </div>
    </div>
  );
}
```

### 3.3 — `apps/brand-network-web/src/app/(corporate)/journal/page.tsx`
```tsx
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Journal | Top 10 Prom',
  description: 'Style guides, prom trends, and bridal inspiration from the Top 10 Prom editorial team.',
};

const FEATURED_POSTS = [
  { slug: 'prom-2025-trends', category: 'Trend Report', title: 'The Dresses Defining Prom 2025', excerpt: 'From sculptural bodices to liquid metallics — the silhouettes and fabrics every styling team is talking about this season.', date: 'March 15, 2025', image: 'https://images.unsplash.com/photo-1594938298603-c8148c4b4ae4?w=800&auto=format&fit=crop&q=85', readTime: '5 min' },
  { slug: 'ai-vto-guide', category: 'Style Tech', title: 'How to Use AI Virtual Try-On', excerpt: 'A step-by-step guide to getting the most realistic results from our AI Try-On — and what to look for in your results.', date: 'February 28, 2025', image: 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=800&auto=format&fit=crop&q=85', readTime: '3 min' },
  { slug: 'wedding-color-guide', category: 'Bridal', title: 'Beyond White: A Modern Bridal Color Guide', excerpt: 'Champagne, blush, noir. The contemporary bride is rewriting the rules — and our designers are here for it.', date: 'February 10, 2025', image: 'https://images.unsplash.com/photo-1519741347686-c1e0aadf4611?w=800&auto=format&fit=crop&q=85', readTime: '7 min' },
] as const;

export default function JournalPage() {
  return (
    <div style={{ paddingTop: '7rem' }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 2rem' }}>
        <div style={{ padding: 'clamp(2rem, 5vw, 4rem) 0', borderBottom: '1px solid var(--color-surface-border)', marginBottom: '3rem' }}>
          <p className="label-luxury" style={{ marginBottom: '1rem' }}>Editorial</p>
          <h1 className="heading-display" style={{ fontSize: 'clamp(2.5rem, 6vw, 5rem)' }}>The Journal</h1>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '2rem', paddingBottom: '4rem' }}>
          {FEATURED_POSTS.map((post) => (
            <article key={post.slug} className="glass-card" style={{ overflow: 'hidden' }}>
              <div style={{ position: 'relative', aspectRatio: '16 / 9', overflow: 'hidden' }}>
                <img
                  src={post.image}
                  alt={post.title}
                  style={{ width: '100%', height: '100%', objectFit: 'cover', transition: 'transform 0.6s var(--ease-luxury)' }}
                  onMouseEnter={(e) => (e.currentTarget.style.transform = 'scale(1.05)')}
                  onMouseLeave={(e) => (e.currentTarget.style.transform = 'scale(1)')}
                  loading="lazy"
                />
              </div>
              <div style={{ padding: '1.5rem' }}>
                <p className="label-luxury" style={{ marginBottom: '0.75rem' }}>
                  {post.category} · {post.readTime} read
                </p>
                <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.375rem', fontWeight: 600, marginBottom: '0.75rem', lineHeight: 1.3 }}>
                  {post.title}
                </h2>
                <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.9375rem', lineHeight: 1.6, marginBottom: '1.25rem' }}>
                  {post.excerpt}
                </p>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <p style={{ color: 'var(--color-text-tertiary)', fontSize: '0.75rem' }}>{post.date}</p>
                  <a
                    href={`/journal/${post.slug}`}
                    style={{ color: 'var(--color-brand-primary)', fontSize: '0.875rem', textDecoration: 'none', fontWeight: 600 }}
                  >
                    Read →
                  </a>
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>
    </div>
  );
}
```

---

## [EXECUTION BLOCK 4: Auth Login Page]

### 4.1 — `apps/brand-network-web/src/app/(auth)/login/page.tsx`
```tsx
import type { Metadata } from 'next';
import LoginForm from './LoginForm';

export const metadata: Metadata = {
  title: 'Sign In | Top 10 Prom',
  robots: { index: false },
};

export default function LoginPage() {
  return (
    <div
      className="mesh-bg"
      style={{
        minHeight: '100dvh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '2rem',
      }}
    >
      <div style={{ width: '100%', maxWidth: '440px' }}>
        {/* Brand mark */}
        <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
          <p
            className="heading-display"
            style={{ fontSize: '2.5rem', color: 'var(--color-brand-secondary)' }}
          >
            TOP 10
          </p>
          <p className="label-luxury" style={{ marginTop: '0.5rem' }}>Member Portal</p>
        </div>

        <div className="glass-card" style={{ padding: '2.5rem' }}>
          <h1 className="heading-section" style={{ fontSize: '1.5rem', textAlign: 'center', marginBottom: '2rem' }}>
            Welcome Back
          </h1>
          <LoginForm />
        </div>

        <p style={{ color: 'var(--color-text-tertiary)', textAlign: 'center', fontSize: '0.875rem', marginTop: '1.5rem' }}>
          New customer?{' '}
          <a href="/register" style={{ color: 'var(--color-brand-primary)', textDecoration: 'none' }}>
            Create an account
          </a>
        </p>
      </div>
    </div>
  );
}
```

### 4.2 — `apps/brand-network-web/src/app/(auth)/login/LoginForm.tsx`
```tsx
'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export default function LoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const handleLogin = () => {
    startTransition(async () => {
      setError(null);
      const supabase = createClient();
      const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
      if (authError) {
        setError('Invalid email or password. Please try again.');
        return;
      }
      router.push('/home');
      router.refresh();
    });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        <label style={{ color: 'var(--color-text-secondary)', fontSize: '0.875rem' }}>Email</label>
        <input type="email" className="input-luxury" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="jane@example.com" autoComplete="email" disabled={isPending} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        <label style={{ color: 'var(--color-text-secondary)', fontSize: '0.875rem' }}>Password</label>
        <input type="password" className="input-luxury" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••••••" autoComplete="current-password" disabled={isPending} />
      </div>
      {error && <p style={{ color: 'var(--color-error)', fontSize: '0.875rem', textAlign: 'center' }}>{error}</p>}
      <button type="button" className="btn-primary" style={{ width: '100%', marginTop: '0.5rem' }} onClick={handleLogin} disabled={isPending || !email || !password} aria-disabled={isPending}>
        {isPending ? 'Signing in…' : 'Sign In'}
      </button>
      <a href="#" style={{ color: 'var(--color-text-tertiary)', fontSize: '0.875rem', textAlign: 'center', textDecoration: 'none' }}>
        Forgot your password?
      </a>
    </div>
  );
}
```

---

## [VALIDATION CHECKPOINT — PHASE 7]

```bash
pnpm --filter @toptenprom/brand-network-web typecheck
pnpm --filter @toptenprom/brand-network-web lint
```

**Page directory verification — every route MUST exist:**
- [ ] `/` — Splash page with video background
- [ ] `/home` — Homepage with 3 scroll sections
- [ ] `/catalog` — Photography catalog with filter system
- [ ] `/try-on` — VTO form (Phase 4)
- [ ] `/locator` — Map + list (Phase 4)
- [ ] `/book` — Booking wizard (Phase 4)
- [ ] `/about` — Editorial about page
- [ ] `/contact` — Contact form
- [ ] `/journal` — Editorial blog index
- [ ] `/login` — Branded auth portal
- [ ] `/dashboard` — Role router (Phase 3)
- [ ] `/gate` — Admin entry with rate limiting (Phase 3)
- [ ] `/[subdomain]` — Tenant storefront (Phase 5)

**Design system audit:**
- [ ] Zero CSS color swatches in catalog — photography only
- [ ] `--ease-luxury` applied to all hover transitions
- [ ] Bodoni Moda on ALL h1, h2 display elements
- [ ] Satoshi on all UI, nav, body text
- [ ] All inputs have `font-size: 1rem` or greater
- [ ] FloatingPillNav routes to all built pages with no 404s

**Update PHASE_MANIFEST.md:** Mark Phase 7 as ✅ COMPLETE.

**STOP. Await human approval before executing Phase 8.**
