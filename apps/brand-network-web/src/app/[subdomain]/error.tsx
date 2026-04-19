'use client';

import { useEffect } from 'react';
import Link from 'next/link';

interface Props {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function SubdomainError({ error, reset }: Props) {
  useEffect(() => {
    console.error('[SubdomainError]', error);
  }, [error]);

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
      <div className="glass-card" style={{ maxWidth: '480px', width: '100%', padding: '3rem' }}>
        <p className="label-luxury" style={{ color: 'var(--color-error)', marginBottom: '1rem' }}>
          Something Went Wrong
        </p>
        <h2 className="heading-display" style={{ fontSize: '2rem', marginBottom: '1rem' }}>
          Boutique Unavailable
        </h2>
        <p style={{ color: 'var(--color-text-secondary)', lineHeight: 1.7, marginBottom: '2rem' }}>
          We had trouble loading this boutique. Your data is safe. Please retry or contact us if the issue continues.
        </p>
        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
          <button type="button" className="btn-primary" onClick={reset}>Try Again</button>
          <Link href="/locator" className="btn-ghost">Find Another Boutique</Link>
        </div>
      </div>
    </div>
  );
}
