'use client';

import { useRouter } from 'next/navigation';

export default function BackButton() {
  const router = useRouter();

  return (
    <button
      type="button"
      onClick={() => router.back()}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.5rem',
        padding: '0.5rem 1.25rem',
        borderRadius: 'var(--radius-pill)',
        border: '1px solid var(--color-surface-border-md)',
        background: 'var(--color-bg-glass)',
        backdropFilter: 'blur(12px)',
        color: 'var(--color-text-muted)',
        fontSize: '0.875rem',
        fontWeight: 500,
        cursor: 'pointer',
        transition: 'all 0.2s var(--ease-luxury)',
        letterSpacing: '0.01em',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = 'var(--color-primary)';
        e.currentTarget.style.color = 'var(--color-text)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = 'var(--color-surface-border-md)';
        e.currentTarget.style.color = 'var(--color-text-muted)';
      }}
      aria-label="Go back"
    >
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
        <path d="M9 2L4 7L9 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      Back
    </button>
  );
}
