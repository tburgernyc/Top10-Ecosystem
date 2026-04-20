/**
 * seed-dresses-inventory.ts
 * Seeds the 50 real dresses (with Supabase Storage URLs) and
 * creates inventory records linking each dress to all boutiques.
 * Skips image upload (already done). Safe to re-run.
 */

import 'dotenv/config';
import crypto from 'crypto';
import { db } from './client';
import { dresses, dress_inventory, tenants } from './schema';

const SUPABASE_URL = process.env['NEXT_PUBLIC_SUPABASE_URL']!;
const BUCKET = 'dress-images';

const BRAND_META: Record<string, {
  displayName: string;
  priceRange: [number, number];
  silhouettes: string[];
  necklines: string[];
  fabrics: string[];
  colors: Array<{ name: string; hex: string }>;
  files: string[];
}> = {
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
    ],
    files: ['11236.jpg', '11238.jpg', '11690.jpg', '11751.jpg', '12149.jpg', '12230.jpg', '12231.jpg', '1624.jpg', '1740.jpg', '4500.jpg'],
  },
  'chandalier': {
    displayName: 'Chandalier',
    priceRange: [399, 699],
    silhouettes: ['Mermaid', 'Trumpet', 'Ball Gown', 'Column'],
    necklines: ['Off-Shoulder', 'One Shoulder', 'Illusion', 'Deep V'],
    fabrics: ['Beaded Mesh', 'Chiffon', 'Organza', 'Lace'],
    colors: [
      { name: 'Midnight Blue', hex: '#1E3A5F' },
      { name: 'Red', hex: '#B91C1C' },
      { name: 'Lavender', hex: '#C4B5FD' },
    ],
    files: ['30020.jpg', '30021.jpg', '30023.jpg', '30029.jpg', '30032.jpg', '30045.jpg', '30047.jpg', '30063.jpg', '30064.jpg', '30081.jpg'],
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
    ],
    files: ['327R.jpg', '338.jpg', '345.jpg', '528.jpg', '538.jpg', '571.jpg', '573.jpg', '727R.jpg', '880.jpg', '974.jpg'],
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
    ],
    files: ['2835.jpg', '3039.jpg', '3084.jpg', '3144.jpg', '3208.jpg', '3251.jpg', '9213.jpg', '9213A.jpg', 'OVERSKIRT1.jpg', 'OVERSKIRT2.jpg'],
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
    ],
    files: ['26014.jpg', '26018.jpg', '26043.jpg', '26050.jpg', '26058.jpg', '26080.jpg', '26084.jpg', '26085.jpg', '26087.jpg', '26088.jpg'],
  },
};

function storageUrl(brand: string, file: string): string {
  return `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${brand}/${file}`;
}

function dressId(brand: string, styleNum: string): string {
  const h = (s: string) => crypto.createHash('sha256').update(s).digest('hex');
  return `${h(`dress-${brand}-${styleNum}`).substring(0, 8)}-${h(brand).substring(0, 4)}-4${h(styleNum).substring(1, 4)}-a${h(`${brand}${styleNum}`).substring(1, 4)}-${h(`dress${brand}${styleNum}`).substring(0, 12)}`;
}

async function run() {
  // ── Step 1: Dresses ────────────────────────────────────────────────────────
  console.log('👗 Inserting dresses…');
  const dressRecords: Array<{ id: string; brand: string }> = [];

  for (const [brand, meta] of Object.entries(BRAND_META)) {
    for (let i = 0; i < meta.files.length; i++) {
      const file = meta.files[i]!;
      const styleNum = file.replace(/\.[^/.]+$/, '');
      const imageUrl = storageUrl(brand, file);
      const id = dressId(brand, styleNum);
      const [minPrice, maxPrice] = meta.priceRange;
      const retailPrice = minPrice + Math.floor((i / meta.files.length) * (maxPrice - minPrice));

      await db.insert(dresses).values({
        id,
        sku: `${brand.toUpperCase().replace(/-/g, '').substring(0, 8)}-${styleNum}`,
        name: `${meta.displayName} Style ${styleNum}`,
        designer: meta.displayName,
        description: `A stunning ${meta.silhouettes[i % meta.silhouettes.length]} prom gown from ${meta.displayName} featuring ${meta.fabrics[i % meta.fabrics.length]} with a ${meta.necklines[i % meta.necklines.length]} neckline.`,
        occasion: 'prom' as const,
        silhouette: meta.silhouettes[i % meta.silhouettes.length],
        neckline: meta.necklines[i % meta.necklines.length],
        fabric: meta.fabrics[i % meta.fabrics.length],
        embellishments: i % 3 === 0 ? ['Beading', 'Sequins'] : ['Rhinestones'],
        available_colors: meta.colors.map((c) => ({ name: c.name, hex: c.hex, swatch_image_url: imageUrl })),
        available_sizes: ['0', '2', '4', '6', '8', '10', '12', '14', '16'],
        base_price: (retailPrice * 0.6).toFixed(2),
        retail_price: retailPrice.toFixed(2),
        image_urls: { hero: imageUrl, gallery: [imageUrl], on_model: [imageUrl] },
        is_active: true,
        is_exclusive: false,
      }).onConflictDoNothing();

      dressRecords.push({ id, brand });
      process.stdout.write('.');
    }
  }
  console.log(`\n  ✅ ${dressRecords.length} dresses`);

  // ── Step 2: Inventory ──────────────────────────────────────────────────────
  console.log('📦 Building inventory…');
  const allTenants = await db.select({ id: tenants.id }).from(tenants);
  console.log(`  Distributing across ${allTenants.length} boutiques`);

  // Query ACTUAL dress IDs from DB (keyed by designer+name to map to brand colors)
  const dbDresses = await db.select({ id: dresses.id, designer: dresses.designer, name: dresses.name }).from(dresses);

  const brandByDesigner: Record<string, string> = {
    'Ashley Lauren': 'ashley-lauren',
    'Chandalier': 'chandalier',
    'Jessica Angel': 'jessica-angel',
    'Johnathan Kayne': 'johnathan-kayne',
    'Kate Parker': 'kate-parker',
  };

  let count = 0;
  for (const dbDress of dbDresses) {
    const brand = brandByDesigner[dbDress.designer] ?? 'ashley-lauren';
    const meta = BRAND_META[brand]!;
    const c1 = meta.colors[0]!.name;
    const c2 = (meta.colors[1] ?? meta.colors[0]!).name;

    const rows = allTenants.flatMap((t) => [
      { dress_id: dbDress.id, tenant_id: t.id, color_name: c1, size: '8',  quantity_on_hand: 2, quantity_reserved: 0, in_stock: true, reorder_threshold: 1 },
      { dress_id: dbDress.id, tenant_id: t.id, color_name: c2, size: '10', quantity_on_hand: 1, quantity_reserved: 0, in_stock: true, reorder_threshold: 1 },
    ]);

    for (let i = 0; i < rows.length; i += 50) {
      await db.insert(dress_inventory).values(rows.slice(i, i + 50)).onConflictDoNothing();
      count += Math.min(50, rows.length - i);
    }
    process.stdout.write('.');
  }

  console.log(`\n  ✅ ${count} inventory records`);
  console.log(`
╔══════════════════════════════════════════╗
║  ✅  Seed Complete!                      ║
╠══════════════════════════════════════════╣
║  Dresses : ${String(dressRecords.length).padEnd(30)}║
║  Inventory: ${String(count).padEnd(29)}║
╚══════════════════════════════════════════╝
`);
  process.exit(0);
}

run().catch((e) => { console.error('❌', e); process.exit(1); });
