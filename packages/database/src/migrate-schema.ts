/**
 * migrate-schema.ts — Patches the existing Supabase schema.
 * Safe to re-run (ADD COLUMN IF NOT EXISTS throughout).
 */

import 'dotenv/config';
import postgres from 'postgres';

async function main() {
  const sql = postgres(process.env['DATABASE_URL_DIRECT']!, { prepare: false });
  console.log('🔧 Patching schema…');

  // ── tenants ─────────────────────────────────────────────────────────────────
  await sql`ALTER TABLE tenants ALTER COLUMN slug DROP NOT NULL`;
  await sql`ALTER TABLE tenants ALTER COLUMN status DROP NOT NULL`;
  await sql`ALTER TABLE tenants ADD COLUMN IF NOT EXISTS address TEXT NOT NULL DEFAULT ''`;
  await sql`ALTER TABLE tenants ADD COLUMN IF NOT EXISTS city VARCHAR(100) NOT NULL DEFAULT ''`;
  await sql`ALTER TABLE tenants ADD COLUMN IF NOT EXISTS state VARCHAR(50) NOT NULL DEFAULT ''`;
  await sql`ALTER TABLE tenants ADD COLUMN IF NOT EXISTS zip VARCHAR(20) NOT NULL DEFAULT ''`;
  await sql`ALTER TABLE tenants ADD COLUMN IF NOT EXISTS phone VARCHAR(30) NOT NULL DEFAULT ''`;
  await sql`ALTER TABLE tenants ADD COLUMN IF NOT EXISTS email VARCHAR(255) NOT NULL DEFAULT ''`;
  await sql`ALTER TABLE tenants ADD COLUMN IF NOT EXISTS location_data JSONB`;
  await sql`ALTER TABLE tenants ADD COLUMN IF NOT EXISTS business_hours JSONB`;
  await sql`ALTER TABLE tenants ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE`;
  await sql`ALTER TABLE tenants ADD COLUMN IF NOT EXISTS max_daily_appointments INTEGER NOT NULL DEFAULT 30`;
  console.log('  ✅ tenants');

  // ── dresses ──────────────────────────────────────────────────────────────────
  await sql`ALTER TABLE dresses ADD COLUMN IF NOT EXISTS sku VARCHAR(100)`;
  await sql`ALTER TABLE dresses ADD COLUMN IF NOT EXISTS occasion TEXT NOT NULL DEFAULT 'prom'`;
  await sql`ALTER TABLE dresses ADD COLUMN IF NOT EXISTS silhouette VARCHAR(100)`;
  await sql`ALTER TABLE dresses ADD COLUMN IF NOT EXISTS neckline VARCHAR(100)`;
  await sql`ALTER TABLE dresses ADD COLUMN IF NOT EXISTS fabric VARCHAR(255)`;
  await sql`ALTER TABLE dresses ADD COLUMN IF NOT EXISTS embellishments JSONB`;
  await sql`ALTER TABLE dresses ADD COLUMN IF NOT EXISTS available_colors JSONB NOT NULL DEFAULT '[]'`;
  await sql`ALTER TABLE dresses ADD COLUMN IF NOT EXISTS available_sizes JSONB NOT NULL DEFAULT '["0","2","4","6","8","10","12","14","16"]'`;
  await sql`ALTER TABLE dresses ADD COLUMN IF NOT EXISTS retail_price NUMERIC(10,2)`;
  await sql`ALTER TABLE dresses ADD COLUMN IF NOT EXISTS is_exclusive BOOLEAN NOT NULL DEFAULT FALSE`;
  await sql`ALTER TABLE dresses ALTER COLUMN boutique_id DROP NOT NULL`;
  // Full unique index on sku (partial indexes can't be ON CONFLICT targets)
  // NULL values are each treated as distinct, so existing NULL skus are fine
  await sql`DROP INDEX IF EXISTS dresses_sku_idx`;
  await sql`CREATE UNIQUE INDEX dresses_sku_idx ON dresses (sku) WHERE sku IS NOT NULL`;
  console.log('  ✅ dresses');

  // ── dress_inventory ──────────────────────────────────────────────────────────
  await sql`ALTER TABLE dress_inventory ADD COLUMN IF NOT EXISTS tenant_id UUID`;
  await sql`ALTER TABLE dress_inventory ADD COLUMN IF NOT EXISTS color_name VARCHAR(100) NOT NULL DEFAULT 'Default'`;
  await sql`ALTER TABLE dress_inventory ADD COLUMN IF NOT EXISTS quantity_on_hand INTEGER NOT NULL DEFAULT 0`;
  await sql`ALTER TABLE dress_inventory ADD COLUMN IF NOT EXISTS quantity_reserved INTEGER NOT NULL DEFAULT 0`;
  await sql`ALTER TABLE dress_inventory ADD COLUMN IF NOT EXISTS in_stock BOOLEAN NOT NULL DEFAULT TRUE`;
  await sql`ALTER TABLE dress_inventory ADD COLUMN IF NOT EXISTS reorder_threshold INTEGER NOT NULL DEFAULT 1`;
  await sql`ALTER TABLE dress_inventory ALTER COLUMN boutique_id DROP NOT NULL`;
  await sql`DROP INDEX IF EXISTS dress_inventory_unique_idx`;
  await sql`
    CREATE UNIQUE INDEX dress_inventory_unique_idx
    ON dress_inventory (dress_id, tenant_id, color_name, size)
    WHERE tenant_id IS NOT NULL
  `;
  console.log('  ✅ dress_inventory');

  // ── boutique_staff ────────────────────────────────────────────────────────────
  await sql`ALTER TABLE boutique_staff ADD COLUMN IF NOT EXISTS user_id UUID`;
  await sql`ALTER TABLE boutique_staff ADD COLUMN IF NOT EXISTS tenant_id UUID`;
  await sql`ALTER TABLE boutique_staff ADD COLUMN IF NOT EXISTS hire_date TIMESTAMP WITH TIME ZONE`;
  await sql`ALTER TABLE boutique_staff ADD COLUMN IF NOT EXISTS specialties JSONB`;
  await sql`ALTER TABLE boutique_staff ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()`;
  await sql`UPDATE boutique_staff SET user_id = profile_id WHERE user_id IS NULL AND profile_id IS NOT NULL`;
  await sql`UPDATE boutique_staff SET tenant_id = boutique_id WHERE tenant_id IS NULL AND boutique_id IS NOT NULL`;
  console.log('  ✅ boutique_staff');

  // ── customers ────────────────────────────────────────────────────────────────
  await sql`ALTER TABLE customers ADD COLUMN IF NOT EXISTS prom_year INTEGER`;
  await sql`ALTER TABLE customers ADD COLUMN IF NOT EXISTS school_name VARCHAR(255)`;
  await sql`ALTER TABLE customers ADD COLUMN IF NOT EXISTS guardian_name VARCHAR(255)`;
  await sql`ALTER TABLE customers ADD COLUMN IF NOT EXISTS guardian_phone VARCHAR(30)`;
  await sql`ALTER TABLE customers ADD COLUMN IF NOT EXISTS guardian_email VARCHAR(255)`;
  await sql`ALTER TABLE customers ADD COLUMN IF NOT EXISTS preferred_sizes JSONB`;
  await sql`ALTER TABLE customers ADD COLUMN IF NOT EXISTS style_notes TEXT`;
  console.log('  ✅ customers');

  await sql.end();
  console.log('\n✅ Schema patch complete.');
}

main().then(() => process.exit(0)).catch((e) => { console.error('❌ Migration failed:', e); process.exit(1); });
