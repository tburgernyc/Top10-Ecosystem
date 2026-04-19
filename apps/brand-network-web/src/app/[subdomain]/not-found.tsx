import Link from 'next/link';

export default function SubdomainNotFound() {
  return (
    <div
      className="mesh-bg"
      style={{
        minHeight: '100dvh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '2rem',
        textAlign: 'center',
      }}
    >
      <div>
        <p className="label-luxury" style={{ color: 'var(--color-brand-secondary)', marginBottom: '1.5rem' }}>
          Boutique Not Found
        </p>
        <h1
          className="heading-display"
          style={{ fontSize: 'clamp(3rem, 8vw, 6rem)', marginBottom: '1.5rem' }}
        >
          404
        </h1>
        <p
          style={{
            color: 'var(--color-text-muted)',
            fontSize: '1.125rem',
            maxWidth: '480px',
            margin: '0 auto 2.5rem',
            lineHeight: 1.7,
          }}
        >
          We couldn&apos;t find this boutique location. Use our store locator to find the nearest Top 10 Prom near you.
        </p>
        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
          <Link href="/locator" className="btn-primary">Find a Boutique</Link>
          <Link href="/home" className="btn-ghost">Return Home</Link>
        </div>
      </div>
    </div>
  );
}
