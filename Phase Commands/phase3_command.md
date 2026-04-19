# Phase 3: The Unified Enterprise Dashboard

---

## [PRE-EXECUTION DIRECTIVE]
**MANDATORY FIRST ACTION:** Read `PHASE_MANIFEST.md` (Phase 0) in full. Verify Phases 1 and 2 are marked ✅ COMPLETE.

**Role:** Principal Staff Engineer & Lead UX Architect  
**Context:** Build the complete administrative dashboard under `src/app/(main)/dashboard`.  
**Quality Standard:** Institutional Grade. Wrap EVERY database query in `try/catch`. No white-background admin templates. Every component uses the Pearled Velvet Glass design system.  
**Execution Rules:**  
- `redirect()` calls MUST be placed OUTSIDE `try/catch` blocks — Next.js `redirect()` throws `NEXT_REDIRECT` internally and will be swallowed if caught.  
- Every analytics RSC must use `<Suspense>` with a skeleton fallback.  
- All `params` must be `await`ed before access.  
- Mobile nav must be horizontally scrolling — never vertical overflow on iOS.

---

## [EXECUTION BLOCK 1: Admin Gate & Security Layer]

### 1.1 — Install Rate Limiting Dependencies
```bash
cd apps/brand-network-web
pnpm add @upstash/ratelimit @upstash/redis
```

### 1.2 — `apps/brand-network-web/src/lib/rate-limit.ts`
```typescript
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

/**
 * Rate limiter for the admin gate — 5 attempts per 10 minutes per IP.
 * Uses Upstash Redis for serverless-compatible sliding window rate limiting.
 */
export const adminGateLimiter = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(5, '10 m'),
  analytics: true,
  prefix: 'toptenprom:admin-gate',
});
```

### 1.3 — `apps/brand-network-web/src/app/(admin)/gate/page.tsx`
```tsx
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { adminGateLimiter } from '@/lib/rate-limit';
import GateLoginForm from './GateLoginForm';

export const metadata = { title: 'Network Access', robots: { index: false, follow: false } };

export default async function GatePage() {
  // Rate limit check — server-side before any rendering
  const headerStore = await headers();
  const ip = headerStore.get('x-forwarded-for') ?? headerStore.get('x-real-ip') ?? '127.0.0.1';
  const { success, remaining } = await adminGateLimiter.limit(ip);

  if (!success) {
    // Rate limited — redirect to generic error, do not reveal gate existence
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
```

### 1.4 — `apps/brand-network-web/src/app/(admin)/gate/GateLoginForm.tsx`
```tsx
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
```

---

## [EXECUTION BLOCK 2: Dashboard Layout & Navigation]

### 2.1 — `apps/brand-network-web/src/app/(main)/dashboard/layout.tsx`
```tsx
import { requireDashboardSession } from '@/lib/auth';
import DashboardNav from '@/components/dashboard/DashboardNav';

export const metadata = { title: 'Dashboard', robots: { index: false, follow: false } };

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  // This call redirects to /login if unauthenticated — placed here, not in try/catch
  const authUser = await requireDashboardSession();

  return (
    <div style={{ display: 'flex', minHeight: '100dvh', background: 'var(--color-bg-noir)' }}>
      <DashboardNav user={authUser} />
      <main
        style={{
          flex: 1,
          marginLeft: 'clamp(0px, 240px, 240px)',
          padding: '2rem',
          overflowY: 'auto',
        }}
      >
        {children}
      </main>
    </div>
  );
}
```

### 2.2 — `apps/brand-network-web/src/components/dashboard/DashboardNav.tsx`
```tsx
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { AuthUser } from '@/lib/auth';

interface Props {
  user: AuthUser;
}

const NAV_ITEMS_BY_ROLE: Record<string, Array<{ label: string; href: string; icon: string }>> = {
  super_admin: [
    { label: 'Network Overview', href: '/dashboard/owner', icon: '◈' },
    { label: 'All Locations', href: '/dashboard/locations', icon: '⊕' },
    { label: 'Appointments', href: '/dashboard/receptionist', icon: '◷' },
    { label: 'Walk-In Queue', href: '/dashboard/queue', icon: '◎' },
    { label: 'Clients', href: '/dashboard/associate', icon: '◻' },
    { label: 'Catalog', href: '/dashboard/catalog', icon: '◩' },
    { label: 'Analytics', href: '/dashboard/analytics', icon: '◈' },
  ],
  owner: [
    { label: 'Overview', href: '/dashboard/owner', icon: '◈' },
    { label: 'Appointments', href: '/dashboard/receptionist', icon: '◷' },
    { label: 'Walk-In Queue', href: '/dashboard/queue', icon: '◎' },
    { label: 'My Team', href: '/dashboard/team', icon: '◻' },
    { label: 'Inventory', href: '/dashboard/inventory', icon: '◩' },
    { label: 'Analytics', href: '/dashboard/analytics', icon: '◈' },
  ],
  manager: [
    { label: 'Overview', href: '/dashboard/owner', icon: '◈' },
    { label: 'Appointments', href: '/dashboard/receptionist', icon: '◷' },
    { label: 'Walk-In Queue', href: '/dashboard/queue', icon: '◎' },
    { label: 'Inventory', href: '/dashboard/inventory', icon: '◩' },
  ],
  receptionist: [
    { label: 'Appointments', href: '/dashboard/receptionist', icon: '◷' },
    { label: 'Walk-In Queue', href: '/dashboard/queue', icon: '◎' },
    { label: 'Check In', href: '/dashboard/check-in', icon: '✓' },
  ],
  stylist: [
    { label: 'My Clients', href: '/dashboard/associate', icon: '◻' },
    { label: 'My Schedule', href: '/dashboard/schedule', icon: '◷' },
    { label: 'VTO Sessions', href: '/dashboard/vto', icon: '◈' },
  ],
};

export default function DashboardNav({ user }: Props) {
  const pathname = usePathname();
  const navItems = NAV_ITEMS_BY_ROLE[user.role] ?? [];

  const sidebarStyles: React.CSSProperties = {
    position: 'fixed',
    top: 0,
    left: 0,
    width: '240px',
    height: '100dvh',
    background: 'var(--color-bg-elevated)',
    borderRight: '1px solid var(--color-surface-border)',
    display: 'flex',
    flexDirection: 'column',
    padding: '1.5rem 1rem',
    zIndex: 50,
    overflowY: 'auto',
    // Desktop only — hidden on mobile
    '@media (max-width: 768px)': { display: 'none' },
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
          borderRight: '1px solid var(--color-surface-border)',
          display: 'flex',
          flexDirection: 'column',
          padding: '1.5rem 1rem',
          zIndex: 50,
          overflowY: 'auto',
        }}
        className="dashboard-sidebar"
        aria-label="Dashboard navigation"
      >
        {/* Brand mark */}
        <div style={{ marginBottom: '2rem', paddingLeft: '0.5rem' }}>
          <p className="heading-display" style={{ fontSize: '1.25rem', color: 'var(--color-brand-secondary)' }}>
            TOP 10
          </p>
          <p style={{ color: 'var(--color-text-tertiary)', fontSize: '0.75rem', marginTop: '0.25rem' }}>
            {user.role.replace('_', ' ').toUpperCase()}
          </p>
        </div>

        {/* Nav links */}
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
                  color: isActive ? 'var(--color-brand-primary)' : 'var(--color-text-secondary)',
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

        {/* User info */}
        <div
          className="glass-card"
          style={{ padding: '1rem', marginTop: 'auto' }}
        >
          <p style={{ color: 'var(--color-text-primary)', fontSize: '0.875rem', fontWeight: 600 }}>
            {user.first_name} {user.last_name}
          </p>
          <p style={{ color: 'var(--color-text-tertiary)', fontSize: '0.75rem', marginTop: '0.125rem' }}>
            {user.email}
          </p>
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
          borderBottom: '1px solid var(--color-surface-border)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          padding: '0.75rem 1rem',
          overflowX: 'auto',          // Horizontal scroll — critical for iOS
          overflowY: 'hidden',         // NO vertical overflow on iOS
          whiteSpace: 'nowrap',        // Prevents wrapping
          WebkitOverflowScrolling: 'touch', // Momentum scroll on iOS
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
                  color: isActive ? 'var(--color-brand-primary)' : 'var(--color-text-secondary)',
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
        </div>
      </div>
    </>
  );
}
```

---

## [EXECUTION BLOCK 3: Role-Based Index Router]

### 3.1 — `apps/brand-network-web/src/app/(main)/dashboard/page.tsx`
```tsx
import { requireDashboardSession } from '@/lib/auth';
import { redirect } from 'next/navigation';

export default async function DashboardIndexPage() {
  const user = await requireDashboardSession();

  // Role-to-route mapping — redirect() OUTSIDE any try/catch
  const roleRoutes: Record<string, string> = {
    super_admin: '/dashboard/owner',
    owner: '/dashboard/owner',
    manager: '/dashboard/owner',
    stylist: '/dashboard/associate',
    receptionist: '/dashboard/receptionist',
  };

  const targetRoute = roleRoutes[user.role] ?? '/dashboard/receptionist';
  redirect(targetRoute);
}
```

---

## [EXECUTION BLOCK 4: Owner / Manager Dashboard]

### 4.1 — `apps/brand-network-web/src/app/(main)/dashboard/owner/page.tsx`
```tsx
import { Suspense } from 'react';
import { requireDashboardSession } from '@/lib/auth';
import { withTenant, db } from '@toptenprom/database';
import { tenants, appointments, walk_ins, dress_reservations } from '@toptenprom/database';
import { eq, count, sql, gte } from 'drizzle-orm';
import ChartSkeleton from '@/components/dashboard/ChartSkeleton';
import StylistUtilizationChart from '@/components/dashboard/StylistUtilizationChart';
import NetworkRevenueCard from '@/components/dashboard/NetworkRevenueCard';

export const metadata = { title: 'Network Overview | Dashboard' };

async function getOwnerAnalytics(tenantId: string, userId: string) {
  'use cache'; // Next.js 16 Cache Component — revalidates on request
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return withTenant(tenantId, userId, 'owner', async (tx) => {
    const [appointmentStats] = await tx
      .select({
        total_today: count(),
        confirmed: sql<number>`count(*) filter (where status = 'confirmed')`,
        in_progress: sql<number>`count(*) filter (where status = 'in_progress')`,
        completed: sql<number>`count(*) filter (where status = 'completed')`,
      })
      .from(appointments)
      .where(sql`tenant_id = ${tenantId} AND appointment_date >= ${today}`);

    const [walkInStats] = await tx
      .select({ active_queue: count() })
      .from(walk_ins)
      .where(sql`tenant_id = ${tenantId} AND status IN ('waiting', 'called', 'with_stylist')`);

    const [reservationStats] = await tx
      .select({ total: count() })
      .from(dress_reservations)
      .where(eq(dress_reservations.tenant_id, tenantId));

    return { appointmentStats, walkInStats, reservationStats };
  });
}

export default async function OwnerDashboardPage() {
  const user = await requireDashboardSession();

  let analytics: Awaited<ReturnType<typeof getOwnerAnalytics>> | null = null;

  try {
    if (user.tenant_id) {
      analytics = await getOwnerAnalytics(user.tenant_id, user.id);
    }
  } catch (error) {
    // Analytics failure is non-critical — page renders with partial data
    console.error('[OwnerDashboard] Analytics query failed:', error);
  }

  const apptStats = analytics?.appointmentStats;
  const walkStats = analytics?.walkInStats;
  const resStats = analytics?.reservationStats;

  return (
    <div className="page-enter">
      {/* Page header */}
      <div style={{ marginBottom: '2.5rem' }}>
        <p className="label-luxury">Dashboard</p>
        <h1 className="heading-display" style={{ fontSize: '2.5rem', marginTop: '0.5rem' }}>
          Network Overview
        </h1>
        <p className="text-muted" style={{ marginTop: '0.5rem' }}>
          Good {getTimeOfDay()}, {user.first_name}. Here's your boutique at a glance.
        </p>
      </div>

      {/* Bento Analytics Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: '1.25rem',
          marginBottom: '2rem',
        }}
      >
        <BentoMetricCard
          label="Today's Appointments"
          value={apptStats?.total_today?.toString() ?? '—'}
          sub={`${apptStats?.confirmed ?? 0} confirmed · ${apptStats?.in_progress ?? 0} active`}
          accentColor="var(--color-brand-primary)"
        />
        <BentoMetricCard
          label="Active Walk-In Queue"
          value={walkStats?.active_queue?.toString() ?? '—'}
          sub="Customers currently waiting"
          accentColor="var(--color-brand-accent)"
        />
        <BentoMetricCard
          label="Prom Reservations"
          value={resStats?.total?.toString() ?? '—'}
          sub="Active registry holds"
          accentColor="var(--color-brand-secondary)"
        />
        <BentoMetricCard
          label="Completed Today"
          value={apptStats?.completed?.toString() ?? '—'}
          sub="Appointments fulfilled"
          accentColor="var(--color-success)"
        />
      </div>

      {/* Streaming chart */}
      <div className="bento-card" style={{ marginBottom: '2rem' }}>
        <p className="label-luxury" style={{ marginBottom: '1rem' }}>Stylist Utilization</p>
        <Suspense fallback={<ChartSkeleton />}>
          {user.tenant_id && (
            <StylistUtilizationChart tenantId={user.tenant_id} userId={user.id} />
          )}
        </Suspense>
      </div>
    </div>
  );
}

function BentoMetricCard({
  label,
  value,
  sub,
  accentColor,
}: {
  label: string;
  value: string;
  sub: string;
  accentColor: string;
}) {
  return (
    <div className="bento-card">
      <p className="label-luxury" style={{ marginBottom: '1rem' }}>{label}</p>
      <p
        style={{
          fontFamily: 'var(--font-display)',
          fontSize: '3rem',
          fontWeight: 700,
          color: accentColor,
          lineHeight: 1,
          marginBottom: '0.5rem',
        }}
      >
        {value}
      </p>
      <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.875rem' }}>{sub}</p>
    </div>
  );
}

function getTimeOfDay(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'morning';
  if (hour < 17) return 'afternoon';
  return 'evening';
}
```

### 4.2 — `apps/brand-network-web/src/components/dashboard/ChartSkeleton.tsx`
```tsx
export default function ChartSkeleton() {
  return (
    <div style={{ height: '200px', display: 'flex', alignItems: 'flex-end', gap: '0.75rem', padding: '1rem 0' }}>
      {[65, 80, 45, 90, 55, 70, 85].map((height, i) => (
        <div
          key={i}
          style={{
            flex: 1,
            height: `${height}%`,
            background: 'var(--color-surface-glass-md)',
            borderRadius: 'var(--radius-sm)',
            animation: `pulse 1.5s ease-in-out ${i * 0.1}s infinite`,
          }}
        />
      ))}
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 0.4; }
          50% { opacity: 0.8; }
        }
      `}</style>
    </div>
  );
}
```

### 4.3 — `apps/brand-network-web/src/components/dashboard/StylistUtilizationChart.tsx`
```tsx
import { withTenant, db } from '@toptenprom/database';
import { boutique_staff, appointments } from '@toptenprom/database';
import { eq, sql, count } from 'drizzle-orm';

interface Props {
  tenantId: string;
  userId: string;
}

export default async function StylistUtilizationChart({ tenantId, userId }: Props) {
  let stylistData: Array<{ name: string; appointments: number; utilization: number }> = [];

  try {
    const result = await withTenant(tenantId, userId, 'owner', async (tx) => {
      return tx
        .select({
          first_name: sql<string>`users.first_name`,
          last_name: sql<string>`users.last_name`,
          appointment_count: count(appointments.id),
        })
        .from(boutique_staff)
        .leftJoin(appointments, eq(boutique_staff.id, appointments.stylist_id))
        .where(sql`boutique_staff.tenant_id = ${tenantId} AND boutique_staff.role = 'stylist'`)
        .groupBy(sql`users.first_name, users.last_name, boutique_staff.id`);
    });

    const maxCount = Math.max(...result.map((r) => r.appointment_count ?? 0), 1);
    stylistData = result.map((r) => ({
      name: `${r.first_name} ${r.last_name}`,
      appointments: r.appointment_count ?? 0,
      utilization: Math.round(((r.appointment_count ?? 0) / maxCount) * 100),
    }));
  } catch (error) {
    console.error('[StylistUtilizationChart] Query failed:', error);
    return <p style={{ color: 'var(--color-text-tertiary)', fontSize: '0.875rem' }}>Chart unavailable</p>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      {stylistData.map(({ name, appointments: appts, utilization }) => (
        <div key={name} style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <p style={{ width: '120px', fontSize: '0.875rem', color: 'var(--color-text-secondary)', flexShrink: 0 }}>
            {name}
          </p>
          <div
            style={{
              flex: 1,
              height: '8px',
              background: 'var(--color-surface-glass-md)',
              borderRadius: 'var(--radius-pill)',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                width: `${utilization}%`,
                height: '100%',
                background: 'linear-gradient(90deg, var(--color-brand-primary), var(--color-brand-accent))',
                borderRadius: 'var(--radius-pill)',
                transition: 'width 0.8s var(--ease-luxury)',
              }}
            />
          </div>
          <p style={{ width: '30px', fontSize: '0.75rem', color: 'var(--color-text-tertiary)', textAlign: 'right' }}>
            {appts}
          </p>
        </div>
      ))}
    </div>
  );
}
```

---

## [EXECUTION BLOCK 5: Receptionist Dashboard]

### 5.1 — `apps/brand-network-web/src/app/(main)/dashboard/receptionist/page.tsx`
```tsx
import { Suspense } from 'react';
import { requireDashboardSession } from '@/lib/auth';
import AppointmentList from '@/components/dashboard/AppointmentList';
import WalkInQueue from '@/components/dashboard/WalkInQueue';
import ChartSkeleton from '@/components/dashboard/ChartSkeleton';

export const metadata = { title: 'Receptionist | Dashboard' };

export default async function ReceptionistPage() {
  const user = await requireDashboardSession();

  return (
    <div className="page-enter">
      <div style={{ marginBottom: '2.5rem' }}>
        <p className="label-luxury">Reception</p>
        <h1 className="heading-display" style={{ fontSize: '2.5rem', marginTop: '0.5rem' }}>
          Today's Schedule
        </h1>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
        {/* Appointments Panel */}
        <div className="glass-card" style={{ padding: '1.5rem' }}>
          <p className="label-luxury" style={{ marginBottom: '1.25rem' }}>Appointments</p>
          <Suspense fallback={<ChartSkeleton />}>
            {user.tenant_id && (
              <AppointmentList tenantId={user.tenant_id} userId={user.id} />
            )}
          </Suspense>
        </div>

        {/* Walk-In Queue Panel */}
        <div className="glass-card" style={{ padding: '1.5rem' }}>
          <p className="label-luxury" style={{ marginBottom: '1.25rem' }}>Walk-In Queue</p>
          <Suspense fallback={<ChartSkeleton />}>
            {user.tenant_id && (
              <WalkInQueue tenantId={user.tenant_id} userId={user.id} userRole={user.role} />
            )}
          </Suspense>
        </div>
      </div>
    </div>
  );
}
```

### 5.2 — `apps/brand-network-web/src/components/dashboard/WalkInQueue.tsx`
```tsx
import { withTenant, db } from '@toptenprom/database';
import { walk_ins, boutique_staff } from '@toptenprom/database';
import { sql } from 'drizzle-orm';
import CheckInButton from './CheckInButton';

interface Props {
  tenantId: string;
  userId: string;
  userRole: string;
}

export default async function WalkInQueue({ tenantId, userId, userRole }: Props) {
  let queue: typeof walk_ins.$inferSelect[] = [];

  try {
    queue = await withTenant(tenantId, userId, userRole as 'receptionist', async (tx) => {
      return tx
        .select()
        .from(walk_ins)
        .where(sql`tenant_id = ${tenantId} AND status IN ('waiting', 'called')`)
        .orderBy(walk_ins.queue_position);
    });
  } catch (error) {
    console.error('[WalkInQueue] Query failed:', error);
    return (
      <p style={{ color: 'var(--color-text-tertiary)', fontSize: '0.875rem' }}>
        Queue unavailable
      </p>
    );
  }

  if (queue.length === 0) {
    return (
      <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.875rem', textAlign: 'center', padding: '2rem 0' }}>
        No customers currently waiting
      </p>
    );
  }

  return (
    <ul style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', listStyle: 'none' }}>
      {queue.map((walkIn) => (
        <li
          key={walkIn.id}
          className="glass-card"
          style={{ padding: '1rem 1.25rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
        >
          <div>
            <p style={{ fontWeight: 600, color: 'var(--color-text-primary)' }}>{walkIn.customer_name}</p>
            <p style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', marginTop: '0.25rem' }}>
              Party of {walkIn.party_size} · {walkIn.occasion ?? 'General'}
              {walkIn.estimated_wait_minutes != null && ` · ~${walkIn.estimated_wait_minutes}m wait`}
            </p>
          </div>
          <div style={{ display: 'flex', align: 'center', gap: '0.5rem' }}>
            <span
              style={{
                padding: '0.25rem 0.75rem',
                borderRadius: 'var(--radius-pill)',
                fontSize: '0.75rem',
                fontWeight: 600,
                background: walkIn.status === 'waiting'
                  ? 'rgba(255, 212, 10, 0.15)'
                  : 'rgba(50, 215, 75, 0.15)',
                color: walkIn.status === 'waiting'
                  ? 'var(--color-warning)'
                  : 'var(--color-success)',
              }}
            >
              {walkIn.status}
            </span>
            {/* Check In button uses useTransition — see component below */}
            <CheckInButton walkInId={walkIn.id} currentStatus={walkIn.status} />
          </div>
        </li>
      ))}
    </ul>
  );
}
```

### 5.3 — `apps/brand-network-web/src/components/dashboard/CheckInButton.tsx`
```tsx
'use client';

import { useTransition } from 'react';
import { checkInWalkIn } from '@/actions/walk-in-actions';

interface Props {
  walkInId: string;
  currentStatus: string;
}

export default function CheckInButton({ walkInId, currentStatus }: Props) {
  const [isPending, startTransition] = useTransition();

  if (currentStatus !== 'waiting') return null;

  return (
    <button
      type="button"
      className="btn-primary"
      style={{ padding: '0.375rem 1rem', fontSize: '0.75rem' }}
      disabled={isPending}
      aria-disabled={isPending}
      onClick={() => {
        startTransition(async () => {
          await checkInWalkIn(walkInId);
        });
      }}
    >
      {isPending ? '…' : 'Call In'}
    </button>
  );
}
```

### 5.4 — `apps/brand-network-web/src/actions/walk-in-actions.ts`
```typescript
'use server';

import { revalidatePath } from 'next/cache';
import { requireDashboardSession } from '@/lib/auth';
import { withTenant, db } from '@toptenprom/database';
import { walk_ins } from '@toptenprom/database';
import { eq } from 'drizzle-orm';

export async function checkInWalkIn(walkInId: string): Promise<void> {
  // requireDashboardSession redirect() is outside try/catch — intentional
  const user = await requireDashboardSession();

  if (!user.tenant_id) {
    throw new Error('No tenant assigned to this user');
  }

  try {
    await withTenant(user.tenant_id, user.id, user.role, async (tx) => {
      await tx
        .update(walk_ins)
        .set({
          status: 'called',
          called_at: new Date(),
        })
        .where(eq(walk_ins.id, walkInId));
    });
  } catch (error) {
    console.error('[checkInWalkIn] Server action failed:', error);
    throw new Error('Failed to update walk-in status. Please try again.');
  }

  revalidatePath('/dashboard/receptionist');
}
```

---

## [EXECUTION BLOCK 6: Sales Associate / Stylist Dashboard]

### 6.1 — `apps/brand-network-web/src/app/(main)/dashboard/associate/page.tsx`
```tsx
import { Suspense } from 'react';
import { requireDashboardSession } from '@/lib/auth';
import ClientProfile from '@/components/dashboard/ClientProfile';
import AssociateTaskView from '@/components/dashboard/AssociateTaskView';
import ChartSkeleton from '@/components/dashboard/ChartSkeleton';

export const metadata = { title: 'My Clients | Dashboard' };

export default async function AssociateDashboardPage() {
  const user = await requireDashboardSession();

  return (
    <div className="page-enter">
      <div style={{ marginBottom: '2rem' }}>
        <p className="label-luxury">Stylist View</p>
        <h1 className="heading-display" style={{ fontSize: '2rem', marginTop: '0.5rem' }}>
          My Clients
        </h1>
      </div>

      {/* Mobile-first layout — large touch targets for iPad */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.25rem' }}>
        <Suspense fallback={<ChartSkeleton />}>
          {user.tenant_id && (
            <AssociateTaskView tenantId={user.tenant_id} userId={user.id} stylistId={user.id} />
          )}
        </Suspense>

        <Suspense fallback={<ChartSkeleton />}>
          {user.tenant_id && (
            <ClientProfile tenantId={user.tenant_id} userId={user.id} />
          )}
        </Suspense>
      </div>
    </div>
  );
}
```

### 6.2 — `apps/brand-network-web/src/components/dashboard/AssociateTaskView.tsx`
```tsx
import { withTenant } from '@toptenprom/database';
import { appointments, customers, users } from '@toptenprom/database';
import { eq, sql, and } from 'drizzle-orm';

interface Props {
  tenantId: string;
  userId: string;
  stylistId: string;
}

export default async function AssociateTaskView({ tenantId, userId, stylistId }: Props) {
  let todayAppointments: Array<{
    id: string;
    appointment_date: Date;
    service_type: string;
    status: string;
    customer_first_name: string;
    customer_last_name: string;
  }> = [];

  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    todayAppointments = await withTenant(tenantId, userId, 'stylist', async (tx) => {
      return tx
        .select({
          id: appointments.id,
          appointment_date: appointments.appointment_date,
          service_type: appointments.service_type,
          status: appointments.status,
          customer_first_name: users.first_name,
          customer_last_name: users.last_name,
        })
        .from(appointments)
        .leftJoin(customers, eq(appointments.customer_id, customers.id))
        .leftJoin(users, eq(customers.user_id, users.id))
        .where(
          sql`appointments.stylist_id = ${stylistId}
          AND appointments.appointment_date >= ${today}
          AND appointments.appointment_date < ${tomorrow}`
        )
        .orderBy(appointments.appointment_date);
    });
  } catch (error) {
    console.error('[AssociateTaskView] Query failed:', error);
    return (
      <div className="glass-card" style={{ padding: '1.5rem' }}>
        <p style={{ color: 'var(--color-text-tertiary)' }}>Schedule unavailable</p>
      </div>
    );
  }

  return (
    <div className="glass-card" style={{ padding: '1.5rem' }}>
      <p className="label-luxury" style={{ marginBottom: '1.25rem' }}>Today's Schedule</p>
      {todayAppointments.length === 0 ? (
        <p style={{ color: 'var(--color-text-secondary)', textAlign: 'center', padding: '2rem 0' }}>
          No appointments today
        </p>
      ) : (
        <ul style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', listStyle: 'none' }}>
          {todayAppointments.map((appt) => (
            <li
              key={appt.id}
              style={{
                padding: '1rem', // Strictly large padding for iPad touch targets
                borderRadius: 'var(--radius-md)',
                background: 'var(--color-surface-glass)',
                border: '1px solid var(--color-surface-border)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <p style={{ fontWeight: 600, fontSize: '1rem' }}>
                    {appt.customer_first_name} {appt.customer_last_name}
                  </p>
                  <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.875rem', marginTop: '0.25rem' }}>
                    {appt.service_type} · {new Date(appt.appointment_date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
                <span
                  style={{
                    padding: '0.25rem 0.75rem',
                    borderRadius: 'var(--radius-pill)',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    background: appt.status === 'confirmed' ? 'rgba(50, 215, 75, 0.15)' : 'rgba(255, 212, 10, 0.15)',
                    color: appt.status === 'confirmed' ? 'var(--color-success)' : 'var(--color-warning)',
                  }}
                >
                  {appt.status}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
```

---

## [EXECUTION BLOCK 7: Dashboard Error Boundary]

### 7.1 — `apps/brand-network-web/src/app/(main)/dashboard/error.tsx`
```tsx
'use client';

import { useEffect } from 'react';

interface Props {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function DashboardError({ error, reset }: Props) {
  useEffect(() => {
    console.error('[Dashboard Error Boundary]', error);
  }, [error]);

  return (
    <div
      className="mesh-bg"
      style={{
        minHeight: '60dvh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '2rem',
      }}
    >
      <div
        className="glass-card"
        style={{
          maxWidth: '480px',
          width: '100%',
          padding: '3rem',
          textAlign: 'center',
        }}
      >
        {/* Error icon */}
        <div
          style={{
            width: '64px',
            height: '64px',
            borderRadius: '50%',
            background: 'rgba(255, 69, 58, 0.12)',
            border: '1px solid rgba(255, 69, 58, 0.25)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 1.5rem',
            fontSize: '1.5rem',
          }}
        >
          ⚠
        </div>

        <p className="label-luxury" style={{ color: 'var(--color-error)', marginBottom: '0.75rem' }}>
          Recovery Required
        </p>
        <h2 className="heading-display" style={{ fontSize: '1.75rem', marginBottom: '1rem' }}>
          Dashboard Error
        </h2>
        <p style={{ color: 'var(--color-text-secondary)', lineHeight: 1.7, marginBottom: '2rem' }}>
          A database query encountered an error. Your data is safe. Please retry or contact support if the issue persists.
        </p>

        {process.env.NODE_ENV === 'development' && (
          <pre
            style={{
              background: 'var(--color-bg-sunken)',
              border: '1px solid var(--color-surface-border)',
              borderRadius: 'var(--radius-md)',
              padding: '1rem',
              fontSize: '0.75rem',
              color: 'var(--color-error)',
              textAlign: 'left',
              overflow: 'auto',
              marginBottom: '1.5rem',
            }}
          >
            {error.message}
          </pre>
        )}

        <button
          type="button"
          className="btn-primary"
          onClick={reset}
          style={{ width: '100%' }}
        >
          Retry
        </button>
      </div>
    </div>
  );
}
```

---

## [VALIDATION CHECKPOINT — PHASE 3]

Execute in order. Each MUST achieve Exit Code 0.

```bash
pnpm --filter @toptenprom/brand-network-web typecheck
pnpm --filter @toptenprom/brand-network-web lint
```

**Required Output:**
- Zero TypeScript errors
- Zero unhandled `NEXT_REDIRECT` — verify all `redirect()` calls are outside `try/catch`
- Every dashboard component uses CSS custom properties — zero hardcoded colors
- `DashboardNav.tsx` mobile nav uses `overflowX: auto` with `whiteSpace: nowrap`
- `CheckInButton.tsx` uses `useTransition` with `disabled={isPending}`
- `ChartSkeleton.tsx` + `<Suspense>` wraps every async RSC
- `dashboard/error.tsx` renders frosted glass Recovery Card

**Update PHASE_MANIFEST.md:** Mark Phase 3 as ✅ COMPLETE.

**STOP. Await human approval before executing Phase 4.**
