'use client';

import { useActionState, useState } from 'react';
import { signInAction, type LoginActionState } from './actions';

const INITIAL_STATE: LoginActionState = { error: null };

export default function LoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [state, formAction, isPending] = useActionState(signInAction, INITIAL_STATE);

  return (
    <form action={formAction} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        <label htmlFor="login-email" style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>Email</label>
        <input
          id="login-email"
          name="email"
          type="email"
          required
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
          name="password"
          type="password"
          required
          className="input-luxury"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••••••"
          autoComplete="current-password"
          disabled={isPending}
          style={{ fontSize: '1rem' /* iOS zoom prevention */ }}
        />
      </div>

      {state.error && (
        <p role="alert" style={{ color: 'var(--color-error)', fontSize: '0.875rem', textAlign: 'center' }}>{state.error}</p>
      )}

      <button
        id="login-submit"
        type="submit"
        className="btn-primary"
        style={{ width: '100%', marginTop: '0.5rem' }}
        disabled={isPending || !email || !password}
        aria-disabled={isPending}
      >
        {isPending ? 'Signing in…' : 'Sign In'}
      </button>
    </form>
  );
}
