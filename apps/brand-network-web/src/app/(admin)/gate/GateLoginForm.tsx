'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { verifyStaffAccess } from '@/actions/verify-staff-access';

interface Props {
  attemptsRemaining: number;
}

export default function GateLoginForm({ attemptsRemaining }: Props) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      setError(null);
      const supabase = createClient();
      const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
      if (authError) {
        setError('Invalid credentials. Please try again.');
        return;
      }

      const access = await verifyStaffAccess();
      if (!access.ok) {
        setError('This account does not have staff access.');
        return;
      }

      router.push('/dashboard');
      router.refresh();
    });
  };

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {attemptsRemaining <= 2 && (
        <p style={{ color: 'var(--color-warning)', fontSize: '0.75rem', textAlign: 'center' }}>
          {attemptsRemaining} attempt{attemptsRemaining !== 1 ? 's' : ''} remaining
        </p>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        <label htmlFor="gate-email" style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>Email</label>
        <input
          id="gate-email"
          type="email"
          required
          className="input-luxury"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="staff@toptenprom.com"
          autoComplete="email"
          disabled={isPending}
          style={{ fontSize: '1rem' /* iOS zoom prevention */ }}
        />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        <label htmlFor="gate-password" style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>Password</label>
        <input
          id="gate-password"
          type="password"
          required
          className="input-luxury"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••••"
          autoComplete="current-password"
          disabled={isPending}
          style={{ fontSize: '1rem' /* iOS zoom prevention */ }}
        />
      </div>

      {error && (
        <p role="alert" style={{ color: 'var(--color-error)', fontSize: '0.875rem', textAlign: 'center' }}>
          {error}
        </p>
      )}

      <button
        type="submit"
        className="btn-primary"
        disabled={isPending || !email || !password}
        style={{ marginTop: '0.5rem', width: '100%' }}
        aria-disabled={isPending}
      >
        {isPending ? 'Signing in…' : 'Access Portal'}
      </button>
    </form>
  );
}
