import type { Metadata } from 'next';
import { db } from '@toptenprom/database';
import { tenants } from '@toptenprom/database';
import { eq } from 'drizzle-orm';
import LocatorMap from './LocatorMap';
import BackButton from '@/components/navigation/BackButton';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Find a Boutique | Top 10 Prom',
  description: 'Locate one of 55 Top 10 Prom boutique locations near you.',
};

async function getAllTenants() {
  try {
    return await db.select().from(tenants).where(eq(tenants.is_active, true)).orderBy(tenants.name);
  } catch {
    return [];
  }
}

export default async function LocatorPage() {
  const locations = await getAllTenants();

  return (
    <div style={{ minHeight: '100dvh', paddingTop: '6rem' }}>
      {/* Header */}
      <div
        className="mesh-bg"
        style={{ padding: '4rem 2rem', textAlign: 'center', borderBottom: '1px solid var(--color-surface-border)' }}
      >
        <div style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: '1.5rem' }}>
          <BackButton />
        </div>
        <p className="label-luxury" style={{ marginBottom: '1rem' }}>55 Locations</p>
        <h1 className="heading-display" style={{ fontSize: 'clamp(2.5rem, 6vw, 4rem)' }}>
          Find Your Boutique
        </h1>
        <p style={{ color: 'var(--color-text-secondary)', marginTop: '1rem', fontSize: '1.125rem' }}>
          Luxury boutiques across the nation, each with exclusive inventory.
        </p>
      </div>

      {/* Map + List split screen */}
      <LocatorMap locations={locations} />
    </div>
  );
}
