import type { Metadata } from 'next';
import RegisterForm from './RegisterForm';

export const metadata: Metadata = {
  title: 'Create Account | Top 10 Prom',
  robots: { index: false },
};

export const dynamic = 'force-dynamic';

export default function RegisterPage() {
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
        <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
          <p className="heading-display" style={{ fontSize: '2.5rem', color: 'var(--color-brand-secondary)' }}>
            TOP 10
          </p>
          <p className="label-luxury" style={{ marginTop: '0.5rem' }}>Create Your Account</p>
        </div>

        <div className="glass-card" style={{ padding: '2.5rem' }}>
          <h1 className="heading-section" style={{ fontSize: '1.5rem', textAlign: 'center', marginBottom: '2rem' }}>
            Join Top 10 Prom
          </h1>
          <RegisterForm />
        </div>
      </div>
    </div>
  );
}
