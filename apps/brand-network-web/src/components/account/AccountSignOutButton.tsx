'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export default function AccountSignOutButton() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const handleSignOut = () => {
    startTransition(async () => {
      const supabase = createClient();
      await supabase.auth.signOut();
      router.push('/');
      router.refresh();
    });
  };

  return (
    <button
      type="button"
      onClick={handleSignOut}
      disabled={isPending}
      aria-label="Sign out of your account"
      style={{
        padding: '0.5rem 1rem',
        borderRadius: 'var(--radius-pill)',
        background: 'transparent',
        border: '1px solid var(--color-border)',
        color: 'var(--color-text-muted)',
        fontSize: '0.8125rem',
        cursor: isPending ? 'wait' : 'pointer',
      }}
    >
      {isPending ? 'Signing out…' : 'Sign Out'}
    </button>
  );
}
