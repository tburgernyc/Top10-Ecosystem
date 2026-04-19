import type { Metadata } from 'next';
import { db } from '@toptenprom/database';
import { dresses } from '@toptenprom/database';
import { eq } from 'drizzle-orm';
import CatalogGrid from './CatalogGrid';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Catalog | Top 10 Prom',
  description: 'Browse our exclusive collection of prom and wedding dresses from top designers.',
};

async function getAllDresses() {
  try {
    return await db.select().from(dresses).where(eq(dresses.is_active, true)).orderBy(dresses.designer, dresses.name);
  } catch {
    return [];
  }
}

export default async function CatalogPage() {
  const allDresses = await getAllDresses();

  const designers = [...new Set(allDresses.map((d) => d.designer))].sort();
  const occasions = ['prom', 'wedding', 'bridesmaid', 'homecoming', 'pageant', 'cocktail'];

  return (
    <div style={{ minHeight: '100dvh', paddingTop: '6rem' }}>
      {/* Header */}
      <div
        className="mesh-bg"
        style={{ padding: '4rem 2rem 3rem', borderBottom: '1px solid var(--color-surface-border)' }}
      >
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          <p className="label-luxury" style={{ marginBottom: '1rem' }}>Exclusive Collections</p>
          <h1 className="heading-display" style={{ fontSize: 'clamp(2.5rem, 6vw, 5rem)' }}>
            Designer Catalog
          </h1>
        </div>
      </div>

      {/* Catalog grid with client-side filtering */}
      <CatalogGrid dresses={allDresses} designers={designers} occasions={occasions} />
    </div>
  );
}
