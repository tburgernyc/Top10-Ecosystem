'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

interface Props {
  attemptsRemaining: number;
}

export default function GateLoginForm({ attemptsRemaining }: Props) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const supabase = createClient();

  const handleSubmit = () => {
    startTransition(async () => {
      setError(null);
      const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
      if (authError) {
        setError('Invalid credentials. Please try again.');
        return;
      }
      router.push('/dashboard');
    });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {attemptsRemaining <= 2 && (
        <p style={{ color: 'var(--color-warning)', fontSize: '0.75rem', textAlign: 'center' }}>
          {attemptsRemaining} attempt{attemptsRemaining !== 1 ? 's' : ''} remaining
        </p>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        <label style={{ color: 'var(--color-text-secondary)', fontSize: '0.875rem' }}>Email</label>
        <input
          type="email"
          className="input-luxury"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="staff@toptenprom.com"
          autoComplete="email"
          disabled={isPending}
        />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        <label style={{ color: 'var(--color-text-secondary)', fontSize: '0.875rem' }}>Password</label>
        <input
          type="password"
          className="input-luxury"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••••"
          autoComplete="current-password"
          disabled={isPending}
        />
      </div>

      {error && (
        <p style={{ color: 'var(--color-error)', fontSize: '0.875rem', textAlign: 'center' }}>
          {error}
        </p>
      )}

      <button
        type="button"
        className="btn-primary"
        onClick={handleSubmit}
        disabled={isPending || !email || !password}
        style={{ marginTop: '0.5rem', width: '100%' }}
        aria-disabled={isPending}
      >
        {isPending ? 'Signing in…' : 'Access Portal'}
      </button>
    </div>
  );
}
