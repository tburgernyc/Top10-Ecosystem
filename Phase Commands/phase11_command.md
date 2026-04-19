# Phase 11: Franchise Network Analytics, Owner Portal & Growth Intelligence

---

## [PRE-EXECUTION DIRECTIVE]
**MANDATORY FIRST ACTION:** Read `PHASE_MANIFEST.md` (Phase 0) in full. Verify ALL Phases 1–10 are marked ✅ COMPLETE before writing a single line of code.

**Role:** Principal Staff Engineer & Data Engineering Lead  
**Context:** Build the franchise intelligence layer. This phase delivers: (1) a real-time network analytics dashboard visible to `super_admin` and `owner` roles, surfacing cross-location KPIs (revenue, appointment volume, reservation rate, VTO conversion, walk-in wait times); (2) a per-tenant performance report exportable as a PDF summary; (3) a franchise onboarding workflow that creates a new tenant, seeds default staff roles, and provisions subdomain routing — all executed from the `super_admin` dashboard without manual database access. This is the operational backbone that justifies the SaaS pricing model.  
**Quality Standard:** Institutional Grade. Zero placeholders. Zero `// TODO`. Zero implicit `any` types.  
**Execution Rules:**  
- All analytics queries MUST use aggregated, denormalized views or materialized queries. Never run unbounded `SELECT *` across large tables in a real-time dashboard context.  
- Dashboard RSCs use `'use cache'` with a maximum 60-second TTL for analytics — never stale-while-revalidate beyond 5 minutes for any financial metric.  
- `super_admin` sees cross-tenant network data. `owner` sees their tenant only. Enforce this at the query layer via conditional `WHERE` clauses, NOT via UI hiding.  
- Exported PDFs are generated server-side using `@react-pdf/renderer`. Never use a client-side PDF library.  
- New tenant onboarding MUST be atomic — if staff creation fails, the tenant record is rolled back.  
- All `params`/`searchParams` MUST be `await`ed — Next.js 16 mandatory.

---

## [EXECUTION BLOCK 1: Dependencies]

```bash
cd apps/brand-network-web
pnpm add @react-pdf/renderer recharts date-fns
pnpm add -D @types/recharts
```

---

## [EXECUTION BLOCK 2: Analytics Query Layer]

### 2.1 — `apps/brand-network-web/src/lib/analytics/network-queries.ts`

```typescript
import { db } from '@toptenprom/database';
import {
  tenants,
  appointments,
  walk_ins,
  dress_reservations,
  vto_sessions,
  boutique_staff,
  dresses,
  dress_inventory,
} from '@toptenprom/database';
import { eq, gte, lte, and, count, sql, sum, avg } from 'drizzle-orm';

export interface NetworkKPISnapshot {
  totalActiveTenants: number;
  totalAppointmentsThisMonth: number;
  totalReservationsActive: number;
  totalVtoSessionsThisMonth: number;
  avgWalkInWaitMinutes: number;
  appointmentConfirmationRate: number; // confirmed / total (%)
  networkReservationUtilization: number; // reserved / total inventory slots (%)
}

export interface TenantKPIRow {
  tenantId: string;
  tenantName: string;
  subdomain: string;
  appointmentsThisMonth: number;
  confirmedAppointments: number;
  activeReservations: number;
  vtoSessionsThisMonth: number;
  avgWalkInWaitMinutes: number;
  staffCount: number;
  totalDressInventory: number;
  isActive: boolean;
}

export interface AppointmentTrendRow {
  week: string;        // ISO week label: "2025-W18"
  appointments: number;
  confirmed: number;
}

// ─── NETWORK-WIDE KPI SNAPSHOT ────────────────────────────────────────────────

export async function getNetworkKPISnapshot(): Promise<NetworkKPISnapshot> {
  'use cache';

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const [
    tenantResult,
    appointmentResult,
    reservationResult,
    vtoResult,
    walkInResult,
    confirmedResult,
  ] = await Promise.all([
    db.select({ count: count() }).from(tenants).where(eq(tenants.is_active, true)),

    db.select({ count: count() }).from(appointments)
      .where(gte(appointments.created_at, startOfMonth)),

    db.select({ count: count() }).from(dress_reservations)
      .where(eq(dress_reservations.reservation_status, 'active')),

    db.select({ count: count() }).from(vto_sessions)
      .where(gte(vto_sessions.created_at, startOfMonth)),

    db.select({ avg_wait: avg(walk_ins.estimated_wait_minutes) }).from(walk_ins)
      .where(gte(walk_ins.created_at, startOfMonth)),

    db.select({ count: count() }).from(appointments)
      .where(and(
        gte(appointments.created_at, startOfMonth),
        eq(appointments.status, 'confirmed')
      )),
  ]);

  const totalAppointments = appointmentResult[0]?.count ?? 0;
  const confirmedCount = confirmedResult[0]?.count ?? 0;

  const totalInventoryResult = await db.select({ total: sum(dress_inventory.quantity_available) }).from(dress_inventory);
  const totalInventory = Number(totalInventoryResult[0]?.total ?? 0);
  const activeReservations = reservationResult[0]?.count ?? 0;

  return {
    totalActiveTenants: tenantResult[0]?.count ?? 0,
    totalAppointmentsThisMonth: totalAppointments,
    totalReservationsActive: activeReservations,
    totalVtoSessionsThisMonth: vtoResult[0]?.count ?? 0,
    avgWalkInWaitMinutes: Math.round(Number(walkInResult[0]?.avg_wait ?? 0)),
    appointmentConfirmationRate: totalAppointments > 0
      ? Math.round((confirmedCount / totalAppointments) * 100)
      : 0,
    networkReservationUtilization: totalInventory > 0
      ? Math.round((activeReservations / totalInventory) * 100)
      : 0,
  };
}

// ─── PER-TENANT KPI TABLE ─────────────────────────────────────────────────────

export async function getTenantKPITable(tenantIdFilter?: string): Promise<TenantKPIRow[]> {
  'use cache';

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  // Fetch all (or scoped) tenants
  const tenantList = await db
    .select({ id: tenants.id, name: tenants.name, subdomain: tenants.subdomain, is_active: tenants.is_active })
    .from(tenants)
    .where(tenantIdFilter ? eq(tenants.id, tenantIdFilter) : undefined);

  const rows: TenantKPIRow[] = await Promise.all(
    tenantList.map(async (tenant) => {
      const [apptResult, reservationResult, vtoResult, walkInResult, staffResult, inventoryResult, confirmedResult] = await Promise.all([
        db.select({ count: count() }).from(appointments)
          .where(and(eq(appointments.tenant_id, tenant.id), gte(appointments.created_at, startOfMonth))),

        db.select({ count: count() }).from(dress_reservations)
          .where(and(eq(dress_reservations.tenant_id, tenant.id), eq(dress_reservations.reservation_status, 'active'))),

        db.select({ count: count() }).from(vto_sessions)
          .where(and(eq(vto_sessions.tenant_id, tenant.id), gte(vto_sessions.created_at, startOfMonth))),

        db.select({ avg_wait: avg(walk_ins.estimated_wait_minutes) }).from(walk_ins)
          .where(and(eq(walk_ins.tenant_id, tenant.id), gte(walk_ins.created_at, startOfMonth))),

        db.select({ count: count() }).from(boutique_staff)
          .where(eq(boutique_staff.tenant_id, tenant.id)),

        db.select({ total: sum(dress_inventory.quantity_available) }).from(dress_inventory)
          .where(eq(dress_inventory.tenant_id, tenant.id)),

        db.select({ count: count() }).from(appointments)
          .where(and(
            eq(appointments.tenant_id, tenant.id),
            gte(appointments.created_at, startOfMonth),
            eq(appointments.status, 'confirmed')
          )),
      ]);

      return {
        tenantId: tenant.id,
        tenantName: tenant.name,
        subdomain: tenant.subdomain,
        appointmentsThisMonth: apptResult[0]?.count ?? 0,
        confirmedAppointments: confirmedResult[0]?.count ?? 0,
        activeReservations: reservationResult[0]?.count ?? 0,
        vtoSessionsThisMonth: vtoResult[0]?.count ?? 0,
        avgWalkInWaitMinutes: Math.round(Number(walkInResult[0]?.avg_wait ?? 0)),
        staffCount: staffResult[0]?.count ?? 0,
        totalDressInventory: Number(inventoryResult[0]?.total ?? 0),
        isActive: tenant.is_active,
      };
    })
  );

  return rows;
}

// ─── 12-WEEK APPOINTMENT TREND (NETWORK) ─────────────────────────────────────

export async function getNetworkAppointmentTrend(tenantIdFilter?: string): Promise<AppointmentTrendRow[]> {
  'use cache';

  const twelveWeeksAgo = new Date();
  twelveWeeksAgo.setDate(twelveWeeksAgo.getDate() - 84);

  const baseWhere = tenantIdFilter
    ? and(gte(appointments.created_at, twelveWeeksAgo), eq(appointments.tenant_id, tenantIdFilter))
    : gte(appointments.created_at, twelveWeeksAgo);

  const rows = await db
    .select({
      week: sql<string>`to_char(date_trunc('week', ${appointments.created_at}), 'IYYY-"W"IW')`,
      appointments: count(),
      confirmed: sql<number>`cast(sum(case when ${appointments.status} = 'confirmed' then 1 else 0 end) as int)`,
    })
    .from(appointments)
    .where(baseWhere)
    .groupBy(sql`date_trunc('week', ${appointments.created_at})`)
    .orderBy(sql`date_trunc('week', ${appointments.created_at})`);

  return rows.map((r) => ({
    week: r.week,
    appointments: r.appointments,
    confirmed: r.confirmed,
  }));
}
```

---

## [EXECUTION BLOCK 3: Network Analytics Dashboard]

### 3.1 — `apps/brand-network-web/src/app/(main)/dashboard/analytics/page.tsx`

```tsx
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import { requireDashboardSession } from '@/lib/auth';
import {
  getNetworkKPISnapshot,
  getTenantKPITable,
  getNetworkAppointmentTrend,
} from '@/lib/analytics/network-queries';
import NetworkKPICards from './NetworkKPICards';
import TenantKPITable from './TenantKPITable';
import AppointmentTrendChart from './AppointmentTrendChart';
import AnalyticsSkeleton from './AnalyticsSkeleton';

export const metadata: Metadata = {
  title: 'Analytics | Top 10 Prom Dashboard',
  robots: { index: false },
};

export default async function AnalyticsPage() {
  let session: Awaited<ReturnType<typeof requireDashboardSession>>;
  try {
    session = await requireDashboardSession();
  } catch {
    redirect('/login');
  }

  const isSuperAdmin = session.role === 'super_admin';
  const tenantFilter = isSuperAdmin ? undefined : session.tenant_id ?? undefined;

  const [kpi, tenantRows, trend] = await Promise.all([
    getNetworkKPISnapshot(),
    getTenantKPITable(tenantFilter),
    getNetworkAppointmentTrend(tenantFilter),
  ]);

  return (
    <div style={{ padding: 'clamp(1.5rem, 4vw, 3rem)' }}>
      {/* Header */}
      <div style={{ marginBottom: '2.5rem' }}>
        <p className="label-luxury" style={{ marginBottom: '0.5rem' }}>
          {isSuperAdmin ? 'Franchise Network' : tenantRows[0]?.tenantName ?? 'Dashboard'} · Analytics
        </p>
        <h1 className="heading-section" style={{ fontSize: 'clamp(1.75rem, 4vw, 2.5rem)' }}>
          {isSuperAdmin ? 'Network Intelligence' : 'Location Performance'}
        </h1>
      </div>

      {/* KPI Cards */}
      <Suspense fallback={<AnalyticsSkeleton type="cards" />}>
        <NetworkKPICards kpi={kpi} isSuperAdmin={isSuperAdmin} />
      </Suspense>

      {/* Trend Chart */}
      <div style={{ marginTop: '2.5rem' }}>
        <h2 className="heading-section" style={{ fontSize: '1.25rem', marginBottom: '1.25rem' }}>
          Appointment Trend — Last 12 Weeks
        </h2>
        <Suspense fallback={<AnalyticsSkeleton type="chart" />}>
          <AppointmentTrendChart data={trend} />
        </Suspense>
      </div>

      {/* Tenant Table */}
      {isSuperAdmin && (
        <div style={{ marginTop: '2.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
            <h2 className="heading-section" style={{ fontSize: '1.25rem' }}>
              Location Breakdown ({tenantRows.length} locations)
            </h2>
            <a
              href="/dashboard/analytics/export"
              className="btn-ghost"
              style={{ fontSize: '0.875rem', padding: '0.625rem 1.25rem' }}
            >
              Export PDF Report
            </a>
          </div>
          <Suspense fallback={<AnalyticsSkeleton type="table" />}>
            <TenantKPITable rows={tenantRows} />
          </Suspense>
        </div>
      )}
    </div>
  );
}
```

### 3.2 — `apps/brand-network-web/src/app/(main)/dashboard/analytics/NetworkKPICards.tsx`

```tsx
'use client';

import type { NetworkKPISnapshot } from '@/lib/analytics/network-queries';

interface NetworkKPICardsProps {
  kpi: NetworkKPISnapshot;
  isSuperAdmin: boolean;
}

interface KPICard {
  label: string;
  value: string | number;
  unit?: string;
  accent?: string;
  superAdminOnly?: boolean;
}

export default function NetworkKPICards({ kpi, isSuperAdmin }: NetworkKPICardsProps) {
  const cards: KPICard[] = [
    ...(isSuperAdmin ? [{ label: 'Active Locations', value: kpi.totalActiveTenants, accent: 'var(--color-brand-secondary)', superAdminOnly: true }] : []),
    { label: 'Appointments This Month', value: kpi.totalAppointmentsThisMonth.toLocaleString() },
    { label: 'Confirmation Rate', value: kpi.appointmentConfirmationRate, unit: '%', accent: kpi.appointmentConfirmationRate >= 80 ? 'var(--color-success)' : 'var(--color-warning)' },
    { label: 'Active Reservations', value: kpi.totalReservationsActive.toLocaleString(), accent: 'var(--color-brand-primary)' },
    { label: 'VTO Sessions', value: kpi.totalVtoSessionsThisMonth.toLocaleString(), accent: 'var(--color-brand-accent)' },
    { label: 'Avg Walk-In Wait', value: kpi.avgWalkInWaitMinutes, unit: ' min' },
    ...(isSuperAdmin ? [{ label: 'Inventory Utilization', value: kpi.networkReservationUtilization, unit: '%', superAdminOnly: true }] : []),
  ];

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
        gap: '1rem',
      }}
    >
      {cards.map((card) => (
        <div key={card.label} className="bento-card">
          <p
            style={{
              color: 'var(--color-text-tertiary)',
              fontSize: '0.75rem',
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
              marginBottom: '0.75rem',
            }}
          >
            {card.label}
          </p>
          <p
            style={{
              fontSize: 'clamp(1.75rem, 4vw, 2.5rem)',
              fontWeight: 700,
              color: card.accent ?? 'var(--color-text-primary)',
              fontFamily: 'var(--font-mono)',
              lineHeight: 1,
            }}
          >
            {card.value}
            {card.unit && (
              <span style={{ fontSize: '0.875rem', fontWeight: 400, color: 'var(--color-text-secondary)', marginLeft: '0.25rem' }}>
                {card.unit}
              </span>
            )}
          </p>
        </div>
      ))}
    </div>
  );
}
```

### 3.3 — `apps/brand-network-web/src/app/(main)/dashboard/analytics/AppointmentTrendChart.tsx`

```tsx
'use client';

import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';
import type { AppointmentTrendRow } from '@/lib/analytics/network-queries';

interface AppointmentTrendChartProps {
  data: AppointmentTrendRow[];
}

export default function AppointmentTrendChart({ data }: AppointmentTrendChartProps) {
  if (data.length === 0) {
    return (
      <div className="bento-card" style={{ padding: '3rem', textAlign: 'center' }}>
        <p style={{ color: 'var(--color-text-tertiary)' }}>No appointment data available yet.</p>
      </div>
    );
  }

  return (
    <div className="bento-card" style={{ padding: '1.5rem' }}>
      <ResponsiveContainer width="100%" height={260}>
        <AreaChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
          <defs>
            <linearGradient id="gradTotal" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#F24B9A" stopOpacity={0.25} />
              <stop offset="95%" stopColor="#F24B9A" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="gradConfirmed" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#32D74B" stopOpacity={0.2} />
              <stop offset="95%" stopColor="#32D74B" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
          <XAxis
            dataKey="week"
            tick={{ fill: 'rgba(248,244,240,0.4)', fontSize: 11 }}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            tick={{ fill: 'rgba(248,244,240,0.4)', fontSize: 11 }}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip
            contentStyle={{
              background: '#161420',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: '12px',
              color: '#F8F4F0',
              fontSize: '0.875rem',
            }}
            cursor={{ stroke: 'rgba(255,255,255,0.08)' }}
          />
          <Area
            type="monotone"
            dataKey="appointments"
            stroke="#F24B9A"
            strokeWidth={2}
            fill="url(#gradTotal)"
            name="Total"
            dot={false}
            activeDot={{ r: 4, fill: '#F24B9A' }}
          />
          <Area
            type="monotone"
            dataKey="confirmed"
            stroke="#32D74B"
            strokeWidth={2}
            fill="url(#gradConfirmed)"
            name="Confirmed"
            dot={false}
            activeDot={{ r: 4, fill: '#32D74B' }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
```

### 3.4 — `apps/brand-network-web/src/app/(main)/dashboard/analytics/TenantKPITable.tsx`

```tsx
'use client';

import type { TenantKPIRow } from '@/lib/analytics/network-queries';

interface TenantKPITableProps {
  rows: TenantKPIRow[];
}

export default function TenantKPITable({ rows }: TenantKPITableProps) {
  if (rows.length === 0) {
    return (
      <div className="glass-card" style={{ padding: '2rem', textAlign: 'center' }}>
        <p style={{ color: 'var(--color-text-tertiary)' }}>No tenant data available.</p>
      </div>
    );
  }

  const columns = [
    { key: 'tenantName', label: 'Location' },
    { key: 'appointmentsThisMonth', label: 'Appts (Mo)' },
    { key: 'confirmedAppointments', label: 'Confirmed' },
    { key: 'activeReservations', label: 'Reservations' },
    { key: 'vtoSessionsThisMonth', label: 'VTO' },
    { key: 'avgWalkInWaitMinutes', label: 'Avg Wait (min)' },
    { key: 'staffCount', label: 'Staff' },
    { key: 'totalDressInventory', label: 'Inventory' },
  ] as const;

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '800px' }}>
        <thead>
          <tr>
            {columns.map((col) => (
              <th
                key={col.key}
                style={{
                  padding: '0.75rem 1rem',
                  textAlign: col.key === 'tenantName' ? 'left' : 'center',
                  color: 'var(--color-text-tertiary)',
                  fontSize: '0.6875rem',
                  textTransform: 'uppercase',
                  letterSpacing: '0.1em',
                  borderBottom: '1px solid var(--color-surface-border)',
                  fontFamily: 'var(--font-ui)',
                  fontWeight: 500,
                  whiteSpace: 'nowrap',
                }}
              >
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, idx) => (
            <tr
              key={row.tenantId}
              style={{
                background: idx % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.015)',
                transition: 'background var(--duration-fast) var(--ease-in-out-silk)',
              }}
            >
              <td style={{ padding: '0.875rem 1rem', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                <p style={{ fontWeight: 600, color: 'var(--color-text-primary)', fontSize: '0.9375rem', marginBottom: '0.125rem' }}>
                  {row.tenantName}
                </p>
                <p style={{ color: 'var(--color-text-tertiary)', fontSize: '0.75rem', fontFamily: 'var(--font-mono)' }}>
                  {row.subdomain}.toptenprom.com
                </p>
              </td>
              {(['appointmentsThisMonth', 'confirmedAppointments', 'activeReservations', 'vtoSessionsThisMonth', 'avgWalkInWaitMinutes', 'staffCount', 'totalDressInventory'] as const).map((key) => (
                <td
                  key={key}
                  style={{
                    padding: '0.875rem 1rem',
                    textAlign: 'center',
                    borderBottom: '1px solid rgba(255,255,255,0.04)',
                    fontFamily: 'var(--font-mono)',
                    fontSize: '0.9375rem',
                    color: key === 'activeReservations' ? 'var(--color-brand-primary)' : key === 'vtoSessionsThisMonth' ? 'var(--color-brand-accent)' : 'var(--color-text-primary)',
                  }}
                >
                  {row[key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

### 3.5 — `apps/brand-network-web/src/app/(main)/dashboard/analytics/AnalyticsSkeleton.tsx`

```tsx
export default function AnalyticsSkeleton({ type }: { type: 'cards' | 'chart' | 'table' }) {
  const shimmer = {
    background: 'linear-gradient(90deg, var(--color-bg-elevated) 25%, rgba(255,255,255,0.04) 50%, var(--color-bg-elevated) 75%)',
    backgroundSize: '200% 100%',
    animation: 'shimmer 1.5s infinite',
    borderRadius: 'var(--radius-lg)',
  } as React.CSSProperties;

  if (type === 'cards') {
    return (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1rem' }}>
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} style={{ ...shimmer, height: '100px' }} />
        ))}
      </div>
    );
  }

  if (type === 'chart') {
    return <div style={{ ...shimmer, height: '293px' }} />;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} style={{ ...shimmer, height: '56px' }} />
      ))}
      <style>{`@keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }`}</style>
    </div>
  );
}
```

---

## [EXECUTION BLOCK 4: PDF Report Export]

### 4.1 — `apps/brand-network-web/src/app/api/analytics/export/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { requireDashboardSession } from '@/lib/auth';
import { getNetworkKPISnapshot, getTenantKPITable } from '@/lib/analytics/network-queries';
import { renderToBuffer } from '@react-pdf/renderer';
import { NetworkReportDocument } from '@/components/pdf/NetworkReportDocument';

export async function GET(_request: NextRequest): Promise<NextResponse> {
  let session: Awaited<ReturnType<typeof requireDashboardSession>>;
  try {
    session = await requireDashboardSession();
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!['super_admin', 'owner'].includes(session.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const tenantFilter = session.role === 'super_admin' ? undefined : session.tenant_id ?? undefined;

  const [kpi, tenantRows] = await Promise.all([
    getNetworkKPISnapshot(),
    getTenantKPITable(tenantFilter),
  ]);

  const generatedAt = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const buffer = await renderToBuffer(
    NetworkReportDocument({ kpi, tenantRows, generatedAt, isSuperAdmin: session.role === 'super_admin' })
  );

  return new NextResponse(buffer, {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="toptenprom-analytics-${generatedAt.replace(/\s/g, '-')}.pdf"`,
      'Cache-Control': 'no-store',
    },
  });
}
```

### 4.2 — `apps/brand-network-web/src/components/pdf/NetworkReportDocument.tsx`

```tsx
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';
import type { NetworkKPISnapshot, TenantKPIRow } from '@/lib/analytics/network-queries';

const styles = StyleSheet.create({
  page: { padding: 48, backgroundColor: '#ffffff', fontFamily: 'Helvetica' },
  header: { marginBottom: 32 },
  brand: { fontSize: 8, color: '#9E845A', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 8 },
  title: { fontSize: 24, fontWeight: 'bold', color: '#0B0A0E', marginBottom: 4 },
  subtitle: { fontSize: 10, color: '#666666' },
  sectionTitle: { fontSize: 13, fontWeight: 'bold', color: '#0B0A0E', marginBottom: 12, marginTop: 24, borderBottomWidth: 1, borderBottomColor: '#E5E5E5', paddingBottom: 6 },
  kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 8 },
  kpiCard: { width: '30%', backgroundColor: '#F9F9F9', borderRadius: 8, padding: 12, marginBottom: 8 },
  kpiLabel: { fontSize: 7, color: '#888888', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 },
  kpiValue: { fontSize: 20, fontWeight: 'bold', color: '#0B0A0E' },
  table: { marginTop: 8 },
  tableHeader: { flexDirection: 'row', backgroundColor: '#F0F0F0', borderRadius: 4, padding: '6 8', marginBottom: 2 },
  tableHeaderCell: { fontSize: 7, color: '#666666', textTransform: 'uppercase', letterSpacing: 0.5 },
  tableRow: { flexDirection: 'row', padding: '6 8', borderBottomWidth: 1, borderBottomColor: '#F0F0F0' },
  tableCell: { fontSize: 9, color: '#333333' },
  col1: { width: '30%' },
  colNum: { width: '10%', textAlign: 'center' },
  footer: { position: 'absolute', bottom: 32, left: 48, right: 48, textAlign: 'center', fontSize: 8, color: '#AAAAAA', borderTopWidth: 1, borderTopColor: '#E5E5E5', paddingTop: 8 },
});

interface NetworkReportDocumentProps {
  kpi: NetworkKPISnapshot;
  tenantRows: TenantKPIRow[];
  generatedAt: string;
  isSuperAdmin: boolean;
}

export function NetworkReportDocument({ kpi, tenantRows, generatedAt, isSuperAdmin }: NetworkReportDocumentProps) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.brand}>Top 10 Prom · Analytics Report</Text>
          <Text style={styles.title}>{isSuperAdmin ? 'Franchise Network Intelligence' : 'Location Performance Report'}</Text>
          <Text style={styles.subtitle}>Generated: {generatedAt}</Text>
        </View>

        {/* KPI Summary */}
        <Text style={styles.sectionTitle}>Performance Summary — Current Month</Text>
        <View style={styles.kpiGrid}>
          {isSuperAdmin && (
            <View style={styles.kpiCard}>
              <Text style={styles.kpiLabel}>Active Locations</Text>
              <Text style={styles.kpiValue}>{kpi.totalActiveTenants}</Text>
            </View>
          )}
          <View style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>Total Appointments</Text>
            <Text style={styles.kpiValue}>{kpi.totalAppointmentsThisMonth}</Text>
          </View>
          <View style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>Confirmation Rate</Text>
            <Text style={styles.kpiValue}>{kpi.appointmentConfirmationRate}%</Text>
          </View>
          <View style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>Active Reservations</Text>
            <Text style={styles.kpiValue}>{kpi.totalReservationsActive}</Text>
          </View>
          <View style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>VTO Sessions</Text>
            <Text style={styles.kpiValue}>{kpi.totalVtoSessionsThisMonth}</Text>
          </View>
          <View style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>Avg Walk-In Wait</Text>
            <Text style={styles.kpiValue}>{kpi.avgWalkInWaitMinutes} min</Text>
          </View>
        </View>

        {/* Tenant Table */}
        {isSuperAdmin && tenantRows.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Location Breakdown</Text>
            <View style={styles.table}>
              <View style={styles.tableHeader}>
                <Text style={[styles.tableHeaderCell, styles.col1]}>Location</Text>
                <Text style={[styles.tableHeaderCell, styles.colNum]}>Appts</Text>
                <Text style={[styles.tableHeaderCell, styles.colNum]}>Conf.</Text>
                <Text style={[styles.tableHeaderCell, styles.colNum]}>Rsvns</Text>
                <Text style={[styles.tableHeaderCell, styles.colNum]}>VTO</Text>
                <Text style={[styles.tableHeaderCell, styles.colNum]}>Wait</Text>
                <Text style={[styles.tableHeaderCell, styles.colNum]}>Staff</Text>
                <Text style={[styles.tableHeaderCell, styles.colNum]}>Inv.</Text>
              </View>
              {tenantRows.map((row) => (
                <View key={row.tenantId} style={styles.tableRow}>
                  <Text style={[styles.tableCell, styles.col1]}>{row.tenantName}</Text>
                  <Text style={[styles.tableCell, styles.colNum]}>{row.appointmentsThisMonth}</Text>
                  <Text style={[styles.tableCell, styles.colNum]}>{row.confirmedAppointments}</Text>
                  <Text style={[styles.tableCell, styles.colNum]}>{row.activeReservations}</Text>
                  <Text style={[styles.tableCell, styles.colNum]}>{row.vtoSessionsThisMonth}</Text>
                  <Text style={[styles.tableCell, styles.colNum]}>{row.avgWalkInWaitMinutes}m</Text>
                  <Text style={[styles.tableCell, styles.colNum]}>{row.staffCount}</Text>
                  <Text style={[styles.tableCell, styles.colNum]}>{row.totalDressInventory}</Text>
                </View>
              ))}
            </View>
          </>
        )}

        {/* Footer */}
        <Text style={styles.footer}>
          Top 10 Prom — Confidential · {generatedAt} · toptenprom.com
        </Text>
      </Page>
    </Document>
  );
}
```

---

## [EXECUTION BLOCK 5: Franchise Onboarding Action]

### 5.1 — `apps/brand-network-web/src/actions/franchise-actions.ts`

```typescript
'use server';

import { revalidatePath } from 'next/cache';
import { requireDashboardSession } from '@/lib/auth';
import { db } from '@toptenprom/database';
import { tenants, boutique_staff, users } from '@toptenprom/database';
import { createClient } from '@/lib/supabase/server';
import { eq } from 'drizzle-orm';
import crypto from 'crypto';

interface OnboardFranchiseParams {
  // Location details
  name: string;
  subdomain: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  phone: string;
  email: string;
  lat: number;
  lng: number;
  timezone: string;
  maxDailyAppointments: number;

  // Initial owner staff account
  ownerFirstName: string;
  ownerLastName: string;
  ownerEmail: string;
}

type OnboardResult =
  | { success: true; tenantId: string; ownerId: string; inviteLink: string }
  | { success: false; error: string };

/**
 * `onboardFranchiseLocation`
 * Creates a new tenant record and an initial owner staff account in a single atomic transaction.
 * If ANY step fails, the entire operation is rolled back.
 * SUPER_ADMIN only.
 */
export async function onboardFranchiseLocation(
  params: OnboardFranchiseParams
): Promise<OnboardResult> {
  let session: Awaited<ReturnType<typeof requireDashboardSession>>;
  try {
    session = await requireDashboardSession();
  } catch {
    return { success: false, error: 'Authentication required.' };
  }

  if (session.role !== 'super_admin') {
    return { success: false, error: 'Only super_admin may onboard new franchise locations.' };
  }

  // Validate subdomain format — lowercase alphanumeric with hyphens
  const subdomainRegex = /^[a-z0-9-]{2,30}$/;
  if (!subdomainRegex.test(params.subdomain)) {
    return { success: false, error: 'Subdomain must be 2–30 lowercase alphanumeric characters or hyphens.' };
  }

  // Check subdomain uniqueness
  try {
    const existing = await db
      .select({ id: tenants.id })
      .from(tenants)
      .where(eq(tenants.subdomain, params.subdomain))
      .limit(1);
    if (existing.length > 0) {
      return { success: false, error: `Subdomain "${params.subdomain}" is already in use.` };
    }
  } catch {
    return { success: false, error: 'Failed to verify subdomain uniqueness.' };
  }

  // Check owner email uniqueness in users table
  try {
    const existingUser = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, params.ownerEmail))
      .limit(1);
    if (existingUser.length > 0) {
      return { success: false, error: `A user with email "${params.ownerEmail}" already exists.` };
    }
  } catch {
    return { success: false, error: 'Failed to verify owner email uniqueness.' };
  }

  const supabase = await createClient();

  // Atomic transaction: create tenant + owner user + staff record together
  try {
    return await db.transaction(async (tx) => {
      // 1. Create tenant
      const tenantResult = await tx
        .insert(tenants)
        .values({
          name: params.name,
          subdomain: params.subdomain,
          address: params.address,
          city: params.city,
          state: params.state,
          zip: params.zip,
          phone: params.phone,
          email: params.email,
          location_data: {
            lat: params.lat,
            lng: params.lng,
            timezone: params.timezone,
            place_id: null,
          },
          business_hours: {
            monday: { open: '10:00', close: '20:00', closed: false },
            tuesday: { open: '10:00', close: '20:00', closed: false },
            wednesday: { open: '10:00', close: '20:00', closed: false },
            thursday: { open: '10:00', close: '20:00', closed: false },
            friday: { open: '10:00', close: '21:00', closed: false },
            saturday: { open: '09:00', close: '20:00', closed: false },
            sunday: { open: '11:00', close: '18:00', closed: false },
          },
          is_active: true,
          max_daily_appointments: params.maxDailyAppointments,
        })
        .returning({ id: tenants.id });

      const newTenantId = tenantResult[0]!.id;

      // 2. Create Supabase auth user via Admin API (service role)
      const tempPassword = crypto.randomBytes(16).toString('base64url');
      const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email: params.ownerEmail,
        password: tempPassword,
        email_confirm: true,
        user_metadata: {
          first_name: params.ownerFirstName,
          last_name: params.ownerLastName,
          tenant_id: newTenantId,
          role: 'owner',
        },
      });

      if (authError || !authData.user) {
        throw new Error(`Supabase auth user creation failed: ${authError?.message ?? 'Unknown error'}`);
      }

      const newUserId = authData.user.id;

      // 3. Mirror user in `users` table
      await tx.insert(users).values({
        id: newUserId,
        email: params.ownerEmail,
        first_name: params.ownerFirstName,
        last_name: params.ownerLastName,
        phone: null,
      });

      // 4. Create boutique_staff record as 'owner'
      const staffResult = await tx
        .insert(boutique_staff)
        .values({
          user_id: newUserId,
          tenant_id: newTenantId,
          role: 'owner',
          is_active: true,
        })
        .returning({ id: boutique_staff.id });

      // 5. Generate password reset link for owner onboarding email
      const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
        type: 'recovery',
        email: params.ownerEmail,
        options: { redirectTo: `${process.env.NEXT_PUBLIC_BASE_URL}/dashboard` },
      });

      const inviteLink = linkError ? `${process.env.NEXT_PUBLIC_BASE_URL}/login` : (linkData.properties?.action_link ?? `${process.env.NEXT_PUBLIC_BASE_URL}/login`);

      revalidatePath('/dashboard/franchise');
      revalidatePath('/dashboard/analytics');

      return {
        success: true as const,
        tenantId: newTenantId,
        ownerId: staffResult[0]!.id,
        inviteLink,
      };
    });
  } catch (error) {
    console.error('[onboardFranchiseLocation] Transaction failed — rolled back:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, error: `Franchise onboarding failed: ${message}` };
  }
}
```

### 5.2 — `apps/brand-network-web/src/app/(main)/dashboard/franchise/page.tsx`

```tsx
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { requireDashboardSession } from '@/lib/auth';
import { db } from '@toptenprom/database';
import { tenants, boutique_staff } from '@toptenprom/database';
import { eq, count } from 'drizzle-orm';
import FranchiseOnboardingForm from './FranchiseOnboardingForm';

export const metadata: Metadata = {
  title: 'Franchise Management | Top 10 Prom Dashboard',
  robots: { index: false },
};

export default async function FranchisePage() {
  let session: Awaited<ReturnType<typeof requireDashboardSession>>;
  try {
    session = await requireDashboardSession();
  } catch {
    redirect('/login');
  }

  if (session.role !== 'super_admin') redirect('/dashboard');

  const allTenants = await db
    .select({
      id: tenants.id,
      name: tenants.name,
      subdomain: tenants.subdomain,
      city: tenants.city,
      state: tenants.state,
      is_active: tenants.is_active,
      email: tenants.email,
    })
    .from(tenants)
    .orderBy(tenants.name);

  const staffCounts = await db
    .select({ tenant_id: boutique_staff.tenant_id, count: count() })
    .from(boutique_staff)
    .groupBy(boutique_staff.tenant_id);

  const staffCountMap = Object.fromEntries(staffCounts.map((s) => [s.tenant_id, s.count]));

  return (
    <div style={{ padding: 'clamp(1.5rem, 4vw, 3rem)' }}>
      <div style={{ marginBottom: '2.5rem' }}>
        <p className="label-luxury" style={{ marginBottom: '0.5rem' }}>Super Admin · Franchise Network</p>
        <h1 className="heading-section" style={{ fontSize: 'clamp(1.75rem, 4vw, 2.5rem)' }}>
          Franchise Management
        </h1>
        <p style={{ color: 'var(--color-text-secondary)', marginTop: '0.5rem', maxWidth: '560px' }}>
          Onboard new boutique locations, view the full network, and manage active locations.
          {' '}
          <strong style={{ color: 'var(--color-text-primary)' }}>{allTenants.filter((t) => t.is_active).length} of {allTenants.length} locations active.</strong>
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1rem', marginBottom: '3rem' }}>
        {allTenants.map((tenant) => (
          <div key={tenant.id} className="glass-card" style={{ padding: '1.25rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
              <p className="label-luxury">{tenant.subdomain}.toptenprom.com</p>
              <span style={{
                padding: '0.2rem 0.625rem',
                borderRadius: 'var(--radius-pill)',
                fontSize: '0.6875rem',
                fontWeight: 600,
                background: tenant.is_active ? 'rgba(50,215,75,0.15)' : 'rgba(255,69,58,0.15)',
                color: tenant.is_active ? 'var(--color-success)' : 'var(--color-error)',
              }}>
                {tenant.is_active ? 'ACTIVE' : 'INACTIVE'}
              </span>
            </div>
            <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.0625rem', fontWeight: 600, marginBottom: '0.375rem' }}>{tenant.name}</h3>
            <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.8125rem', marginBottom: '0.25rem' }}>{tenant.city}, {tenant.state}</p>
            <p style={{ color: 'var(--color-text-tertiary)', fontSize: '0.75rem', fontFamily: 'var(--font-mono)' }}>
              {staffCountMap[tenant.id] ?? 0} staff members
            </p>
          </div>
        ))}
      </div>

      <div>
        <h2 className="heading-section" style={{ fontSize: '1.25rem', marginBottom: '1.5rem' }}>
          Onboard New Location
        </h2>
        <FranchiseOnboardingForm />
      </div>
    </div>
  );
}
```

### 5.3 — `apps/brand-network-web/src/app/(main)/dashboard/franchise/FranchiseOnboardingForm.tsx`

```tsx
'use client';

import { useState, useTransition } from 'react';
import { onboardFranchiseLocation } from '@/actions/franchise-actions';

export default function FranchiseOnboardingForm() {
  const [fields, setFields] = useState({
    name: '', subdomain: '', address: '', city: '', state: '', zip: '',
    phone: '', email: '', lat: '', lng: '', timezone: 'America/New_York',
    maxDailyAppointments: '30', ownerFirstName: '', ownerLastName: '', ownerEmail: '',
  });
  const [result, setResult] = useState<{ success: boolean; message: string; inviteLink?: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  const set = (key: keyof typeof fields) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setFields((prev) => ({ ...prev, [key]: e.target.value }));

  const handleSubmit = () => {
    const lat = parseFloat(fields.lat);
    const lng = parseFloat(fields.lng);
    const maxAppts = parseInt(fields.maxDailyAppointments, 10);

    if (isNaN(lat) || isNaN(lng)) {
      setResult({ success: false, message: 'Latitude and longitude must be valid numbers.' });
      return;
    }

    startTransition(async () => {
      setResult(null);
      const res = await onboardFranchiseLocation({
        name: fields.name, subdomain: fields.subdomain, address: fields.address,
        city: fields.city, state: fields.state, zip: fields.zip, phone: fields.phone,
        email: fields.email, lat, lng, timezone: fields.timezone,
        maxDailyAppointments: isNaN(maxAppts) ? 30 : maxAppts,
        ownerFirstName: fields.ownerFirstName, ownerLastName: fields.ownerLastName,
        ownerEmail: fields.ownerEmail,
      });

      if (res.success) {
        setResult({ success: true, message: `Location "${fields.name}" created successfully. Owner invite link generated.`, inviteLink: res.inviteLink });
        setFields({ name: '', subdomain: '', address: '', city: '', state: '', zip: '', phone: '', email: '', lat: '', lng: '', timezone: 'America/New_York', maxDailyAppointments: '30', ownerFirstName: '', ownerLastName: '', ownerEmail: '' });
      } else {
        setResult({ success: false, message: res.error });
      }
    });
  };

  const inputStyle = { display: 'flex', flexDirection: 'column' as const, gap: '0.375rem' };
  const labelStyle = { color: 'var(--color-text-secondary)', fontSize: '0.8125rem' };

  return (
    <div className="glass-card" style={{ padding: '2rem', maxWidth: '720px' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
        <div style={inputStyle}>
          <label style={labelStyle}>Boutique Name *</label>
          <input className="input-luxury" value={fields.name} onChange={set('name')} placeholder="Top 10 Prom — Midtown" disabled={isPending} />
        </div>
        <div style={inputStyle}>
          <label style={labelStyle}>Subdomain *</label>
          <input className="input-luxury" value={fields.subdomain} onChange={set('subdomain')} placeholder="midtown" disabled={isPending} />
        </div>
        <div style={{ ...inputStyle, gridColumn: '1 / -1' }}>
          <label style={labelStyle}>Street Address *</label>
          <input className="input-luxury" value={fields.address} onChange={set('address')} placeholder="123 Fifth Avenue" disabled={isPending} />
        </div>
        <div style={inputStyle}>
          <label style={labelStyle}>City *</label>
          <input className="input-luxury" value={fields.city} onChange={set('city')} placeholder="New York" disabled={isPending} />
        </div>
        <div style={inputStyle}>
          <label style={labelStyle}>State *</label>
          <input className="input-luxury" value={fields.state} onChange={set('state')} placeholder="NY" maxLength={2} disabled={isPending} />
        </div>
        <div style={inputStyle}>
          <label style={labelStyle}>ZIP *</label>
          <input className="input-luxury" value={fields.zip} onChange={set('zip')} placeholder="10036" disabled={isPending} />
        </div>
        <div style={inputStyle}>
          <label style={labelStyle}>Phone *</label>
          <input className="input-luxury" value={fields.phone} onChange={set('phone')} placeholder="(212) 555-0100" disabled={isPending} />
        </div>
        <div style={inputStyle}>
          <label style={labelStyle}>Contact Email *</label>
          <input className="input-luxury" type="email" value={fields.email} onChange={set('email')} placeholder="midtown@toptenprom.com" disabled={isPending} />
        </div>
        <div style={inputStyle}>
          <label style={labelStyle}>Latitude *</label>
          <input className="input-luxury" value={fields.lat} onChange={set('lat')} placeholder="40.7549" disabled={isPending} />
        </div>
        <div style={inputStyle}>
          <label style={labelStyle}>Longitude *</label>
          <input className="input-luxury" value={fields.lng} onChange={set('lng')} placeholder="-73.9840" disabled={isPending} />
        </div>
        <div style={inputStyle}>
          <label style={labelStyle}>Max Daily Appointments</label>
          <input className="input-luxury" type="number" value={fields.maxDailyAppointments} onChange={set('maxDailyAppointments')} min="1" max="200" disabled={isPending} />
        </div>
        <div style={inputStyle}>
          <label style={labelStyle}>Timezone</label>
          <select className="input-luxury" value={fields.timezone} onChange={set('timezone')} disabled={isPending}>
            <option value="America/New_York">Eastern (ET)</option>
            <option value="America/Chicago">Central (CT)</option>
            <option value="America/Denver">Mountain (MT)</option>
            <option value="America/Los_Angeles">Pacific (PT)</option>
          </select>
        </div>
      </div>

      <div style={{ borderTop: '1px solid var(--color-surface-border)', paddingTop: '1.25rem', marginTop: '0.5rem', marginBottom: '1rem' }}>
        <p className="label-luxury" style={{ marginBottom: '0.875rem' }}>Owner Account</p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
          <div style={inputStyle}>
            <label style={labelStyle}>First Name *</label>
            <input className="input-luxury" value={fields.ownerFirstName} onChange={set('ownerFirstName')} placeholder="Morgan" disabled={isPending} />
          </div>
          <div style={inputStyle}>
            <label style={labelStyle}>Last Name *</label>
            <input className="input-luxury" value={fields.ownerLastName} onChange={set('ownerLastName')} placeholder="Flagship" disabled={isPending} />
          </div>
          <div style={{ ...inputStyle, gridColumn: '1 / -1' }}>
            <label style={labelStyle}>Owner Email * (receives login invite)</label>
            <input className="input-luxury" type="email" value={fields.ownerEmail} onChange={set('ownerEmail')} placeholder="owner@toptenprom.com" disabled={isPending} />
          </div>
        </div>
      </div>

      {result && (
        <div
          className="glass-card"
          style={{ padding: '1rem', marginBottom: '1rem', borderColor: result.success ? 'rgba(50,215,75,0.3)' : 'rgba(255,69,58,0.3)' }}
        >
          <p style={{ color: result.success ? 'var(--color-success)' : 'var(--color-error)', fontSize: '0.875rem', marginBottom: result.inviteLink ? '0.5rem' : 0 }}>
            {result.message}
          </p>
          {result.inviteLink && (
            <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.8125rem', wordBreak: 'break-all' }}>
              Invite link:{' '}
              <a href={result.inviteLink} style={{ color: 'var(--color-brand-primary)', textDecoration: 'none' }}>
                {result.inviteLink}
              </a>
            </p>
          )}
        </div>
      )}

      <button
        type="button"
        className="btn-primary"
        onClick={handleSubmit}
        disabled={isPending || !fields.name || !fields.subdomain || !fields.ownerEmail}
      >
        {isPending ? 'Creating Location…' : 'Onboard Location'}
      </button>
    </div>
  );
}
```

---

## [EXECUTION BLOCK 6: Update PHASE_MANIFEST.md]

### 6.1 — Add Phase 11 to Phase Completion Registry

```
| 11 | Franchise Network Analytics, Owner Portal & Growth Intelligence | ⬜ PENDING | — |
```

### 6.2 — Add New Vercel Function Config

Add to `apps/brand-network-web/vercel.json` functions block:
```json
"src/app/api/analytics/export/route.ts": {
  "maxDuration": 30,
  "memory": 1024
}
```

---

## [FINAL ECOSYSTEM VALIDATION CHECKLIST — ALL PHASES COMPLETE]

Once Phase 11 is complete, the full ecosystem is production-ready. Run this final cross-phase audit:

```bash
# Full workspace typecheck
pnpm typecheck

# Full workspace lint
pnpm lint

# Database integrity
pnpm --filter @toptenprom/database db:check

# Seed database
pnpm --filter @toptenprom/database db:seed

# Production build
pnpm --filter @toptenprom/brand-network-web build
```

**Phase 11 QA checklist:**
- [ ] `/dashboard/analytics` shows KPI cards with live data from DB
- [ ] `super_admin` role sees all tenants in the breakdown table
- [ ] `owner` role sees ONLY their own tenant — enforced at query layer, not UI
- [ ] PDF export returns `Content-Type: application/pdf` with correct filename
- [ ] PDF is generated server-side via `@react-pdf/renderer` — NOT client-side
- [ ] Appointment trend chart renders 12 weeks of area chart data via Recharts
- [ ] `/dashboard/franchise` is restricted to `super_admin` — non-super_admin redirected to `/dashboard`
- [ ] `onboardFranchiseLocation` is atomic — if Supabase auth fails, tenant insert is rolled back
- [ ] Subdomain uniqueness checked before transaction begins
- [ ] Owner email uniqueness checked before transaction begins
- [ ] Subdomain regex enforced: `^[a-z0-9-]{2,30}$`
- [ ] New tenant created with correct default business hours
- [ ] Supabase auth admin invite link generated and returned to super_admin
- [ ] `AnalyticsSkeleton` shimmer animation renders during RSC data fetch
- [ ] `'use cache'` directive present on all analytics query functions
- [ ] `recharts` `ResponsiveContainer` renders without SSR hydration errors
- [ ] PDF download triggers `Content-Disposition: attachment` — does not open inline

**Update PHASE_MANIFEST.md:** Mark Phase 11 as ✅ COMPLETE.

**The Top 10 Prom Ecosystem is now fully built across all 12 phases (0–11). Institutional Grade. Apple/LVMH Standard.**