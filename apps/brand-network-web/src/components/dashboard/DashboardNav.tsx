'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import type { AuthUser } from '@/lib/auth';
import { createClient } from '@/lib/supabase/client';

interface Props {
  user: AuthUser;
}

const NAV_ITEMS_BY_ROLE: Record<string, Array<{ label: string; href: string; icon: string }>> = {
  super_admin: [
    { label: 'Network Overview', href: '/dashboard/owner', icon: '◈' },
    { label: 'Appointments', href: '/dashboard/receptionist', icon: '◷' },
    { label: 'Clients', href: '/dashboard/associate', icon: '◻' },
    { label: 'Analytics', href: '/dashboard/analytics', icon: '◈' },
  ],
  owner: [
    { label: 'Overview', href: '/dashboard/owner', icon: '◈' },
    { label: 'Appointments', href: '/dashboard/receptionist', icon: '◷' },
    { label: 'Analytics', href: '/dashboard/analytics', icon: '◈' },
  ],
  manager: [
    { label: 'Overview', href: '/dashboard/owner', icon: '◈' },
    { label: 'Appointments', href: '/dashboard/receptionist', icon: '◷' },
  ],
  receptionist: [
    { label: 'Appointments', href: '/dashboard/receptionist', icon: '◷' },
  ],
  stylist: [
    { label: 'My Clients', href: '/dashboard/associate', icon: '◻' },
  ],
};

export default function DashboardNav({ user }: Props) {
  const pathname = usePathname();
  const router = useRouter();
  const navItems = NAV_ITEMS_BY_ROLE[user.role] ?? [];

  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/');
  };

  return (
    <>
      {/* DESKTOP: Glassmorphism vertical sidebar */}
      <aside
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '240px',
          height: '100dvh',
          background: 'var(--color-bg-elevated)',
          borderRight: '1px solid var(--color-border)',
          display: 'flex',
          flexDirection: 'column',
          padding: '1.5rem 1rem',
          zIndex: 50,
          overflowY: 'auto',
        }}
        className="dashboard-sidebar"
        aria-label="Dashboard navigation"
      >
        <div style={{ marginBottom: '2rem', paddingLeft: '0.5rem' }}>
          <p className="heading-display" style={{ fontSize: '1.25rem', color: 'var(--color-brand-secondary)' }}>
            TOP 10
          </p>
          <p style={{ color: 'var(--color-text-tertiary)', fontSize: '0.75rem', marginTop: '0.25rem' }}>
            {user.role.replace('_', ' ').toUpperCase()}
          </p>
        </div>

        <nav style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          {navItems.map(({ label, href, icon }) => {
            const isActive = pathname === href || pathname.startsWith(`${href}/`);
            return (
              <Link
                key={href}
                href={href}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  padding: '0.75rem 1rem',
                  borderRadius: 'var(--radius-md)',
                  color: isActive ? 'var(--color-primary)' : 'var(--color-text-muted)',
                  background: isActive ? 'var(--color-surface-glass-md)' : 'transparent',
                  border: isActive ? '1px solid var(--color-surface-border-md)' : '1px solid transparent',
                  textDecoration: 'none',
                  fontSize: '0.875rem',
                  fontWeight: isActive ? 600 : 400,
                  transition: 'all 0.2s ease',
                }}
              >
                <span aria-hidden="true">{icon}</span>
                {label}
              </Link>
            );
          })}
        </nav>

        <div style={{ marginTop: 'auto' }}>
          <div className="glass-card" style={{ padding: '1rem' }}>
            <p style={{ color: 'var(--color-text)', fontSize: '0.875rem', fontWeight: 600 }}>
              {user.first_name} {user.last_name}
            </p>
            <p style={{ color: 'var(--color-text-tertiary)', fontSize: '0.75rem', marginTop: '0.125rem' }}>
              {user.email}
            </p>
          </div>
          <button
            onClick={handleSignOut}
            style={{
              width: '100%',
              marginTop: '0.5rem',
              padding: '0.625rem 1rem',
              borderRadius: 'var(--radius-md)',
              background: 'transparent',
              border: '1px solid var(--color-border)',
              color: 'var(--color-text-muted)',
              fontSize: '0.8125rem',
              cursor: 'pointer',
              textAlign: 'left',
            }}
          >
            ← Sign Out
          </button>
        </div>
      </aside>

      {/* MOBILE: Horizontally scrolling top nav — prevents iOS viewport layout breaks */}
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          zIndex: 50,
          background: 'rgba(11, 10, 14, 0.92)',
          borderBottom: '1px solid var(--color-border)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          padding: '0.75rem 1rem',
          overflowX: 'auto',           // Horizontal scroll — critical for iOS
          overflowY: 'hidden',          // NO vertical overflow on iOS
          whiteSpace: 'nowrap',         // Prevents wrapping
          WebkitOverflowScrolling: 'touch' as React.CSSProperties['WebkitOverflowScrolling'], // Momentum scroll on iOS
        }}
        className="dashboard-mobile-nav"
        role="navigation"
        aria-label="Mobile dashboard navigation"
      >
        <div style={{ display: 'inline-flex', gap: '0.5rem', alignItems: 'center' }}>
          <span className="heading-display" style={{ fontSize: '1rem', color: 'var(--color-brand-secondary)', marginRight: '0.75rem' }}>
            TOP 10
          </span>
          {navItems.map(({ label, href }) => {
            const isActive = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  padding: '0.5rem 1rem',
                  borderRadius: 'var(--radius-pill)',
                  color: isActive ? 'var(--color-primary)' : 'var(--color-text-muted)',
                  background: isActive ? 'var(--color-surface-glass-md)' : 'transparent',
                  border: `1px solid ${isActive ? 'var(--color-surface-border-md)' : 'transparent'}`,
                  textDecoration: 'none',
                  fontSize: '0.875rem',
                  fontWeight: isActive ? 600 : 400,
                  whiteSpace: 'nowrap',
                }}
              >
                {label}
              </Link>
            );
          })}
          <button
            onClick={handleSignOut}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              padding: '0.5rem 1rem',
              borderRadius: 'var(--radius-pill)',
              background: 'transparent',
              border: '1px solid var(--color-border)',
              color: 'var(--color-text-muted)',
              fontSize: '0.875rem',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            Sign Out
          </button>
        </div>
      </div>
    </>
  );
}
