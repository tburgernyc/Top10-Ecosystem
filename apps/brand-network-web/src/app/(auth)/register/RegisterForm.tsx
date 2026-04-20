'use client';

import { useState, useTransition } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';

export default function RegisterForm() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState('');
  const [form, setForm] = useState({ email: '', password: '', firstName: '', lastName: '', phone: '' });

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      setError('');
      const supabase = createClient();

      const { data, error: signUpError } = await supabase.auth.signUp({
        email: form.email,
        password: form.password,
        options: { data: { first_name: form.firstName, last_name: form.lastName } },
      });

      if (signUpError) { setError(signUpError.message); return; }

      if (data.user) {
        await supabase.from('users').upsert({
          id: data.user.id,
          email: form.email,
          first_name: form.firstName,
          last_name: form.lastName,
          phone: form.phone || null,
        });
        await supabase.from('customers').upsert({ user_id: data.user.id });
      }

      router.push('/home');
      router.refresh();
    });
  };

  const inputStyle: React.CSSProperties = {
    fontSize: '1rem',
    width: '100%',
  };

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <label htmlFor="reg-first" style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>First Name</label>
          <input id="reg-first" required className="input-luxury" value={form.firstName} onChange={set('firstName')} style={inputStyle} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <label htmlFor="reg-last" style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>Last Name</label>
          <input id="reg-last" required className="input-luxury" value={form.lastName} onChange={set('lastName')} style={inputStyle} />
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        <label htmlFor="reg-email" style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>Email</label>
        <input id="reg-email" type="email" required className="input-luxury" value={form.email} onChange={set('email')} placeholder="jane@example.com" autoComplete="email" style={inputStyle} />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        <label htmlFor="reg-password" style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>Password</label>
        <input id="reg-password" type="password" required minLength={8} className="input-luxury" value={form.password} onChange={set('password')} placeholder="Min 8 characters" autoComplete="new-password" style={inputStyle} />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        <label htmlFor="reg-phone" style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>Phone <span style={{ color: 'var(--color-text-tertiary)' }}>(optional)</span></label>
        <input id="reg-phone" type="tel" className="input-luxury" value={form.phone} onChange={set('phone')} placeholder="+1 (555) 000-0000" autoComplete="tel" style={inputStyle} />
      </div>

      {error && <p role="alert" style={{ color: 'var(--color-error)', fontSize: '0.875rem', textAlign: 'center' }}>{error}</p>}

      <button
        type="submit"
        className="btn-primary"
        disabled={isPending}
        aria-disabled={isPending}
        style={{ width: '100%', marginTop: '0.5rem' }}
      >
        {isPending ? 'Creating account…' : 'Create Account'}
      </button>

      <p style={{ textAlign: 'center', color: 'var(--color-text-tertiary)', fontSize: '0.875rem' }}>
        Already have an account?{' '}
        <a href="/login" style={{ color: 'var(--color-primary)', textDecoration: 'none' }}>Sign in</a>
      </p>
    </form>
  );
}
