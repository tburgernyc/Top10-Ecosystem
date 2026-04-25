import Link from 'next/link';
import type { Metadata } from 'next';
import LoginForm from './LoginForm';

export const metadata: Metadata = {
  title: 'Sign In | Top 10 Prom',
  robots: { index: false },
};

export const dynamic = 'force-dynamic';

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
          <Link href="/register" style={{ color: 'var(--color-primary)', textDecoration: 'none', transition: `opacity 0.2s var(--ease-luxury)` }}>
            Create an account
          </Link>
        </p>
      </div>
    </div>
  );
}
