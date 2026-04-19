import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { adminGateLimiter } from '@/lib/rate-limit';
import GateLoginForm from './GateLoginForm';

export const metadata = { title: 'Network Access', robots: { index: false, follow: false } };

export default async function GatePage() {
  const headerStore = await headers();
  const ip = headerStore.get('x-forwarded-for') ?? headerStore.get('x-real-ip') ?? '127.0.0.1';
  const { success, remaining } = await adminGateLimiter.limit(ip);

  if (!success) {
    redirect('/');
  }

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
      <div className="glass-card" style={{ width: '100%', maxWidth: '420px', padding: '3rem' }}>
        <p className="label-luxury" style={{ marginBottom: '0.75rem', textAlign: 'center' }}>
          Network Access
        </p>
        <h1
          className="heading-display"
          style={{ fontSize: '2rem', textAlign: 'center', marginBottom: '2rem' }}
        >
          Staff Portal
        </h1>
        <GateLoginForm attemptsRemaining={remaining} />
      </div>
    </div>
  );
}
