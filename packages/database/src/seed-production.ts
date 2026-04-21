/**
 * seed-production.ts
 *
 * Seeds the database with:
 *  1. 48 real boutique locations from stores.json
 *  2. 50 real dress images (5 brands × 10 styles) uploaded to Supabase Storage
 *  3. Dress records + inventory across all boutiques
 *
 * Run: pnpm db:seed:production
 *
 * Safe to re-run — all inserts use onConflictDoNothing / onConflictDoUpdate.
 */

import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { db } from './client';
import { tenants, dresses, dress_inventory } from './schema';
import { sql } from 'drizzle-orm';

// ─── CONFIG ──────────────────────────────────────────────────────────────────

const SUPABASE_URL = process.env['NEXT_PUBLIC_SUPABASE_URL']!;
const SERVICE_ROLE_KEY = process.env['SUPABASE_SERVICE_ROLE_KEY']!;
const BUCKET = 'dress-images';

const STORES_JSON = path.resolve(
  '/mnt/c/Users/tburg/Downloads/top10promweb-main/top10promweb-main/public/data/stores.json'
);
const DRESSES_DIR = path.resolve(
  '/mnt/c/Users/tburg/Downloads/top10promweb-main/top10promweb-main/public/dresses'
);

// ─── TIMEZONE MAP ────────────────────────────────────────────────────────────

const STATE_TZ: Record<string, string> = {
  AL: 'America/Chicago', AR: 'America/Chicago', AZ: 'America/Phoenix',
  CA: 'America/Los_Angeles', CO: 'America/Denver', CT: 'America/New_York',
  DE: 'America/New_York', FL: 'America/New_York', GA: 'America/New_York',
  HI: 'Pacific/Honolulu', IA: 'America/Chicago', ID: 'America/Denver',
  IL: 'America/Chicago', IN: 'America/Indiana/Indianapolis', KS: 'America/Chicago',
  KY: 'America/New_York', LA: 'America/Chicago', MA: 'America/New_York',
  MD: 'America/New_York', ME: 'America/New_York', MI: 'America/Detroit',
  MN: 'America/Chicago', MO: 'America/Chicago', MS: 'America/Chicago',
  MT: 'America/Denver', NC: 'America/New_York', ND: 'America/Chicago',
  NE: 'America/Chicago', NH: 'America/New_York', NJ: 'America/New_York',
  NM: 'America/Denver', NV: 'America/Los_Angeles', NY: 'America/New_York',
  OH: 'America/New_York', OK: 'America/Chicago', OR: 'America/Los_Angeles',
  PA: 'America/New_York', RI: 'America/New_York', SC: 'America/New_York',
  SD: 'America/Chicago', TN: 'America/Chicago', TX: 'America/Chicago',
  UT: 'America/Denver', VA: 'America/New_York', VT: 'America/New_York',
  WA: 'America/Los_Angeles', WI: 'America/Chicago', WV: 'America/New_York',
  WY: 'America/Denver',
};

const DEFAULT_HOURS = {
  monday:    { open: '10:00', close: '18:00', closed: false },
  tuesday:   { open: '10:00', close: '18:00', closed: false },
  wednesday: { open: '10:00', close: '18:00', closed: false },
  thursday:  { open: '10:00', close: '18:00', closed: false },
  friday:    { open: '10:00', close: '19:00', closed: false },
  saturday:  { open: '09:00', close: '18:00', closed: false },
  sunday:    { open: '12:00', close: '17:00', closed: false },
};

// ─── ADDRESS PARSER ───────────────────────────────────────────────────────────

interface ParsedAddress {
  address: string;
  city: string;
  state: string;
  zip: string;
}

function parseAddress(formatted: string): ParsedAddress {
  const cleaned = formatted
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .trim();

  const parts = cleaned.split(',').map((p) => p.trim()).filter(Boolean);

  // Drop trailing "USA"
  if (parts[parts.length - 1] === 'USA') parts.pop();

  // Last part: "ST ZIP" e.g. "FL 33761"
  const stateZipRaw = parts.pop() ?? '';
  const cityRaw = parts.pop() ?? '';
  const addressRaw = parts.join(', ');

  const match = stateZipRaw.match(/^([A-Z]{2})\s+(\d{5}(?:-\d{4})?)$/);
  return {
    address: addressRaw || stateZipRaw,
    city: cityRaw,
    state: match?.[1] ?? 'XX',
    zip: match?.[2] ?? '00000',
  };
}

// ─── SUBDOMAIN GENERATOR ──────────────────────────────────────────────────────

function toSubdomain(name: string, idx: number): string {
  const base = name
    .toLowerCase()
    .replace(/&amp;/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 45);
  return `${base}-${String(idx).padStart(2, '0')}`;
}

// ─── SUPABASE STORAGE HELPERS ─────────────────────────────────────────────────

async function ensureBucket(): Promise<void> {
  const res = await fetch(`${SUPABASE_URL}/storage/v1/bucket`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ id: BUCKET, name: BUCKET, public: true }),
  });
  if (!res.ok && res.status !== 409) {
    const text = await res.text();
    console.warn(`⚠️  Bucket create status ${res.status}: ${text}`);
  }
}

async function uploadImage(storagePath: string, filePath: string): Promise<string> {
  const buffer = fs.readFileSync(filePath);
  const res = await fetch(`${SUPABASE_URL}/storage/v1/object/${BUCKET}/${storagePath}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      'Content-Type': 'image/jpeg',
      'x-upsert': 'true',
    },
    body: buffer,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Upload failed for ${storagePath}: ${text}`);
  }

  return `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${storagePath}`;
}

// ─── BRAND METADATA ───────────────────────────────────────────────────────────

interface BrandMeta {
  displayName: string;
  priceRange: [number, number];
  silhouettes: string[];
  necklines: string[];
  fabrics: string[];
  colors: Array<{ name: string; hex: string }>;
}

const BRAND_META: Record<string, BrandMeta> = {
  'ashley-lauren': {
    displayName: 'Ashley Lauren',
    priceRange: [349, 599],
    silhouettes: ['Ball Gown', 'A-Line', 'Mermaid', 'Trumpet'],
    necklines: ['Sweetheart', 'V-Neck', 'Halter', 'Strapless'],
    fabrics: ['Sequin', 'Glitter Tulle', 'Stretch Jersey', 'Mikado'],
    colors: [
      { name: 'Blush Pink', hex: '#F9A8D4' },
      { name: 'Royal Blue', hex: '#1D4ED8' },
      { name: 'Emerald', hex: '#065F46' },
      { name: 'Black', hex: '#111111' },
      { name: 'Champagne', hex: '#C9A96E' },
    ],
  },
  chandalier: {
    displayName: 'Chandalier',
    priceRange: [399, 699],
    silhouettes: ['Mermaid', 'Trumpet', 'Ball Gown', 'Column'],
    necklines: ['Off-Shoulder', 'One Shoulder', 'Illusion', 'Deep V'],
    fabrics: ['Beaded Mesh', 'Chiffon', 'Organza', 'Lace'],
    colors: [
      { name: 'Midnight Blue', hex: '#1E3A5F' },
      { name: 'Red', hex: '#B91C1C' },
      { name: 'Lavender', hex: '#C4B5FD' },
      { name: 'Rose Gold', hex: '#B76E79' },
      { name: 'White', hex: '#F9FAFB' },
    ],
  },
  'jessica-angel': {
    displayName: 'Jessica Angel',
    priceRange: [329, 649],
    silhouettes: ['A-Line', 'High-Low', 'Ball Gown', 'Sheath'],
    necklines: ['Square Neck', 'Sweetheart', 'V-Neck', 'Strapless'],
    fabrics: ['Stretch Sequin', 'Jersey', 'Tulle', 'Satin'],
    colors: [
      { name: 'Gold', hex: '#B7860B' },
      { name: 'Cobalt Blue', hex: '#1B4FD8' },
      { name: 'Hot Pink', hex: '#DB2777' },
      { name: 'Sage Green', hex: '#6B8F71' },
      { name: 'Ivory', hex: '#F8F4F0' },
    ],
  },
  'johnathan-kayne': {
    displayName: 'Johnathan Kayne',
    priceRange: [499, 899],
    silhouettes: ['Trumpet', 'Mermaid', 'Ball Gown', 'A-Line'],
    necklines: ['Plunge', 'Illusion', 'Halter', 'Cowl'],
    fabrics: ['Crepe & Sequin', 'Crystal Beaded', 'Stretch Lace', 'Velvet'],
    colors: [
      { name: 'Onyx Black', hex: '#0B0A0E' },
      { name: 'Silver', hex: '#9CA3AF' },
      { name: 'Deep Purple', hex: '#4C1D95' },
      { name: 'Coral', hex: '#F97316' },
      { name: 'Nude', hex: '#D4A89A' },
    ],
  },
  'kate-parker': {
    displayName: 'Kate Parker',
    priceRange: [379, 749],
    silhouettes: ['A-Line', 'Ball Gown', 'Sheath', 'Empire'],
    necklines: ['Bateau', 'Off-Shoulder', 'Sweetheart', 'Illusion'],
    fabrics: ['Floral Lace', 'Organza', 'Charmeuse', 'Mikado Silk'],
    colors: [
      { name: 'Soft Lilac', hex: '#DDD6FE' },
      { name: 'Dusty Rose', hex: '#F4A0A0' },
      { name: 'Navy', hex: '#1E3A5F' },
      { name: 'Forest Green', hex: '#166534' },
      { name: 'Champagne Gold', hex: '#C9A96E' },
    ],
  },
};

// ─── MAIN ────────────────────────────────────────────────────────────────────

async function run() {
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment');
  }

  console.log('🌱 [Seed Production] Starting…');
  console.log(`   Supabase: ${SUPABASE_URL}`);

  // ── STEP 1: Upload dress images to Supabase Storage ─────────────────────
  console.log('\n📸 [Step 1] Uploading dress images to Supabase Storage…');
  await ensureBucket();

  const imageUrlMap: Record<string, string> = {};
  const brands = Object.keys(BRAND_META);

  for (const brand of brands) {
    const brandDir = path.join(DRESSES_DIR, brand);
    if (!fs.existsSync(brandDir)) {
      console.warn(`  ⚠️  Directory not found: ${brandDir}`);
      continue;
    }

    const files = fs.readdirSync(brandDir).filter((f) => /\.(jpg|jpeg|png|webp)$/i.test(f));

    for (const file of files) {
      const storagePath = `${brand}/${file}`;
      const localPath = path.join(brandDir, file);

      try {
        const url = await uploadImage(storagePath, localPath);
        imageUrlMap[storagePath] = url;
        console.log(`  ✅ ${storagePath}`);
      } catch (err) {
        console.error(`  ❌ ${storagePath}: ${err}`);
      }
    }
  }

  console.log(`\n  Uploaded ${Object.keys(imageUrlMap).length} images`);

  // ── STEP 2: Seed boutiques from stores.json ──────────────────────────────
  console.log('\n🏪 [Step 2] Seeding boutiques from stores.json…');

  const storesRaw = JSON.parse(fs.readFileSync(STORES_JSON, 'utf-8')) as Array<{
    Name: string;
    FormattedAddress: string;
    Phone: string;
    Email: string;
    Website: string;
    Tags: string;
    Lat: number;
    Lng: number;
  }>;

  const tenantRows = storesRaw.map((store, idx) => {
    const name = store.Name.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
    const parsed = parseAddress(store.FormattedAddress);
    const subdomain = toSubdomain(store.Name, idx);
    const timezone = STATE_TZ[parsed.state] ?? 'America/New_York';

    return {
      id: crypto.createHash('sha256')
        .update(`store-${idx}-${name}`)
        .digest('hex')
        .substring(0, 8)
        .padEnd(8, '0')
        + '-0000-0000-0000-' + String(idx + 1).padStart(12, '0'),
      name,
      subdomain,
      address: parsed.address || store.FormattedAddress.split(',')[0]!,
      city: parsed.city,
      state: parsed.state,
      zip: parsed.zip,
      phone: store.Phone || '(000) 000-0000',
      email: store.Email || `${subdomain}@partner.toptenprom.com`,
      location_data: {
        lat: store.Lat,
        lng: store.Lng,
        timezone,
        place_id: `place_${subdomain}`,
      },
      business_hours: DEFAULT_HOURS,
      is_active: true,
      max_daily_appointments: 20,
    };
  });

  // Insert in batches of 20 to avoid query size limits
  for (let i = 0; i < tenantRows.length; i += 20) {
    const batch = tenantRows.slice(i, i + 20);
    await db.insert(tenants).values(batch).onConflictDoUpdate({
      target: tenants.subdomain,
      set: {
        name: sql`excluded.name`,
        address: sql`excluded.address`,
        city: sql`excluded.city`,
        state: sql`excluded.state`,
        location_data: sql`excluded.location_data`,
        updated_at: new Date(),
      },
    });
  }
  console.log(`  ✅ Inserted/updated ${tenantRows.length} boutiques`);

  // ── STEP 3: Seed dresses with real images ────────────────────────────────
  console.log('\n👗 [Step 3] Seeding dress catalog with real images…');

  const dressRecords: Array<{ id: string; brand: string }> = [];

  for (const brand of brands) {
    const meta = BRAND_META[brand]!;
    const brandDir = path.join(DRESSES_DIR, brand);
    if (!fs.existsSync(brandDir)) continue;

    const files = fs.readdirSync(brandDir)
      .filter((f) => /\.(jpg|jpeg|png|webp)$/i.test(f))
      .sort();

    for (let i = 0; i < files.length; i++) {
      const file = files[i]!;
      const styleNum = file.replace(/\.[^/.]+$/, ''); // strip extension
      const storagePath = `${brand}/${file}`;
      const imageUrl = imageUrlMap[storagePath]
        ?? `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${storagePath}`;

      const silhouette = meta.silhouettes[i % meta.silhouettes.length]!;
      const neckline = meta.necklines[i % meta.necklines.length]!;
      const fabric = meta.fabrics[i % meta.fabrics.length]!;
      const colorSubset = meta.colors.slice(0, Math.min(3, meta.colors.length));
      const [minPrice, maxPrice] = meta.priceRange;
      const retailPrice = minPrice + Math.floor((i / files.length) * (maxPrice - minPrice));

      const dressId = crypto.createHash('sha256')
        .update(`dress-${brand}-${styleNum}`)
        .digest('hex')
        .substring(0, 8) + '-' +
        crypto.createHash('sha256').update(brand).digest('hex').substring(0, 4) + '-' +
        '4' + crypto.createHash('sha256').update(styleNum).digest('hex').substring(1, 4) + '-' +
        'a' + crypto.createHash('sha256').update(`${brand}${styleNum}`).digest('hex').substring(1, 4) + '-' +
        crypto.createHash('sha256').update(`dress${brand}${styleNum}${i}`).digest('hex').substring(0, 12);

      dressRecords.push({ id: dressId, brand });

      const dressRow = {
        id: dressId,
        sku: `${brand.toUpperCase().replace(/-/g, '').substring(0, 8)}-${styleNum}`,
        name: `${meta.displayName} Style ${styleNum}`,
        designer: meta.displayName,
        description: `A stunning ${silhouette} prom gown from ${meta.displayName} featuring ${fabric} fabric with a beautiful ${neckline} neckline. Perfect for making a grand entrance.`,
        occasion: 'prom' as const,
        silhouette,
        neckline,
        fabric,
        embellishments: i % 3 === 0 ? ['Beading', 'Sequins'] : i % 3 === 1 ? ['Rhinestones'] : ['Embroidery'],
        available_colors: colorSubset.map((c) => ({
          name: c.name,
          hex: c.hex,
          swatch_image_url: imageUrl,
        })),
        available_sizes: ['0', '2', '4', '6', '8', '10', '12', '14', '16'],
        base_price: (retailPrice * 0.6).toFixed(2),
        retail_price: retailPrice.toFixed(2),
        image_urls: {
          hero: imageUrl,
          gallery: [imageUrl],
          on_model: [imageUrl],
        },
        is_active: true,
        is_exclusive: false,
      };

      await db.insert(dresses).values(dressRow).onConflictDoNothing();
    }
  }
  console.log(`  ✅ Inserted/updated ${dressRecords.length} dresses`);

  // ── STEP 4: Seed inventory across all boutiques ──────────────────────────
  console.log('\n📦 [Step 4] Seeding dress inventory across boutiques…');

  // Re-fetch actual tenant IDs from DB (they may differ from our generated ones due to hash collisions)
  const allTenants = await db.select({ id: tenants.id }).from(tenants);
  const tenantIds = allTenants.map((t) => t.id);

  console.log(`  Distributing ${dressRecords.length} dresses × ${tenantIds.length} boutiques`);

  // Each dress gets inventory at every boutique, inserted in batches
  const BATCH = 50;
  let inventoryCount = 0;

  for (const dress of dressRecords) {
    const meta = BRAND_META[dress.brand]!;
    const primaryColor = meta.colors[0]!;
    const secondaryColor = meta.colors[1] ?? meta.colors[0]!;

    const inventoryRows = tenantIds.flatMap((tenantId) => [
      {
        dress_id: dress.id,
        tenant_id: tenantId,
        color_name: primaryColor.name,
        size: '8',
        quantity_on_hand: 2,
        quantity_reserved: 0,
        in_stock: true,
        reorder_threshold: 1,
      },
      {
        dress_id: dress.id,
        tenant_id: tenantId,
        color_name: secondaryColor.name,
        size: '10',
        quantity_on_hand: 1,
        quantity_reserved: 0,
        in_stock: true,
        reorder_threshold: 1,
      },
    ]);

    for (let i = 0; i < inventoryRows.length; i += BATCH) {
      const batch = inventoryRows.slice(i, i + BATCH);
      await db.insert(dress_inventory).values(batch).onConflictDoNothing();
      inventoryCount += batch.length;
    }
  }

  console.log(`  ✅ Created ${inventoryCount} inventory records`);

  // ── DONE ────────────────────────────────────────────────────────────────
  console.log(`
╔══════════════════════════════════════════════╗
║  ✅  Production Seed Complete!               ║
╠══════════════════════════════════════════════╣
║  Images uploaded : ${String(Object.keys(imageUrlMap).length).padEnd(25)}║
║  Boutiques seeded: ${String(tenantRows.length).padEnd(25)}║
║  Dresses seeded  : ${String(dressRecords.length).padEnd(25)}║
║  Inventory rows  : ${String(inventoryCount).padEnd(25)}║
╚══════════════════════════════════════════════╝
`);

  process.exit(0);
}

run().catch((err) => {
  console.error('❌ [Seed Production] Fatal error:', err);
  process.exit(1);
});
