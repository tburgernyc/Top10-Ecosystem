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
        <label htmlFor="login-email" style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>Email</label>
        <input
          id="login-email"
          type="email"
          className="input-luxury"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="jane@example.com"
          autoComplete="email"
          disabled={isPending}
          style={{ fontSize: '1rem' /* iOS zoom prevention */ }}
        />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        <label htmlFor="login-password" style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>Password</label>
        <input
          id="login-password"
          type="password"
          className="input-luxury"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••••••"
          autoComplete="current-password"
          disabled={isPending}
          style={{ fontSize: '1rem' /* iOS zoom prevention */ }}
        />
      </div>

      {error && (
        <p role="alert" style={{ color: 'var(--color-error)', fontSize: '0.875rem', textAlign: 'center' }}>{error}</p>
      )}

      <button
        id="login-submit"
        type="button"
        className="btn-primary"
        style={{ width: '100%', marginTop: '0.5rem' }}
        onClick={handleLogin}
        disabled={isPending || !email || !password}
        aria-disabled={isPending}
      >
        {isPending ? 'Signing in…' : 'Sign In'}
      </button>

      <a
        href="#"
        style={{
          color: 'var(--color-text-tertiary)',
          fontSize: '0.875rem',
          textAlign: 'center',
          textDecoration: 'none',
          transition: `color 0.2s var(--ease-luxury)`,
        }}
        onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--color-primary)')}
        onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--color-text-tertiary)')}
      >
        Forgot your password?
      </a>
    </div>
  );
}
