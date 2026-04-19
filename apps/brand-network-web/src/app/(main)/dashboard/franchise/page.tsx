import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { requireDashboardSession } from '@/lib/auth';
import { db } from '@toptenprom/database';
import { tenants, boutique_staff } from '@toptenprom/database';
import { count } from 'drizzle-orm';
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
          Onboard new boutique locations, view the full network, and manage active locations.{' '}
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
