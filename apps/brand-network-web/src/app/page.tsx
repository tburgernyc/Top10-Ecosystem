import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Top 10 Prom — Luxury Boutique Network',
  description: 'The premier luxury prom and wedding boutique network. 55 locations. AI-powered styling.',
  openGraph: {
    title: 'Top 10 Prom — Luxury Boutique Network',
    description: 'The premier luxury prom and wedding boutique network. 55 locations. AI-powered styling.',
    type: 'website',
  },
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
        background: 'var(--color-bg)',
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
          <span style={{ color: 'var(--color-primary)', fontStyle: 'italic' }}>PROM</span>
        </h1>

        <p
          style={{
            color: 'var(--color-text-muted)',
            fontSize: 'clamp(1rem, 2.5vw, 1.25rem)',
            maxWidth: '560px',
            margin: '0 auto 3rem',
            lineHeight: 1.7,
          }}
        >
          Luxury prom and wedding boutiques reimagined with AI-powered styling and Virtual Try-On.
        </p>

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
            animation: 'splash-pulse 2s ease-in-out infinite',
          }}
        />
      </div>

      <style>{`
        @keyframes splash-pulse {
          0%, 100% { opacity: 1; transform: scaleY(1); }
          50%       { opacity: 0.4; transform: scaleY(0.8); }
        }
      `}</style>
    </div>
  );
}
