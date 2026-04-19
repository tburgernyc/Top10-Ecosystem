'use client';

import { useEffect } from 'react';

interface Props {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function DashboardError({ error, reset }: Props) {
  useEffect(() => {
    console.error('[Dashboard Error Boundary]', error);
  }, [error]);

  return (
    <div
      className="mesh-bg"
      style={{
        minHeight: '60dvh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '2rem',
      }}
    >
      <div
        className="glass-card"
        style={{
          maxWidth: '480px',
          width: '100%',
          padding: '3rem',
          textAlign: 'center',
        }}
      >
        <div
          style={{
            width: '64px',
            height: '64px',
            borderRadius: '50%',
            background: 'rgba(255, 69, 58, 0.12)',
            border: '1px solid rgba(255, 69, 58, 0.25)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 1.5rem',
            fontSize: '1.5rem',
          }}
        >
          ⚠
        </div>

        <p className="label-luxury" style={{ color: 'var(--color-error)', marginBottom: '0.75rem' }}>
          Recovery Required
        </p>
        <h2 className="heading-display" style={{ fontSize: '1.75rem', marginBottom: '1rem' }}>
          Dashboard Error
        </h2>
        <p style={{ color: 'var(--color-text-muted)', lineHeight: 1.7, marginBottom: '2rem' }}>
          A database query encountered an error. Your data is safe. Please retry or contact support if the issue persists.
        </p>

        {process.env.NODE_ENV === 'development' && (
          <pre
            style={{
              background: 'var(--color-bg-sunken)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-md)',
              padding: '1rem',
              fontSize: '0.75rem',
              color: 'var(--color-error)',
              textAlign: 'left',
              overflow: 'auto',
              marginBottom: '1.5rem',
            }}
          >
            {error.message}
          </pre>
        )}

        <button
          type="button"
          className="btn-primary"
          onClick={reset}
          style={{ width: '100%' }}
        >
          Retry
        </button>
      </div>
    </div>
  );
}
