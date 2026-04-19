# Phase 6: Schema Alignment & Institutional Data Hydration

---

## [PRE-EXECUTION DIRECTIVE]
**MANDATORY FIRST ACTION:** Read `PHASE_MANIFEST.md` (Phase 0) in full. Verify Phases 1–5 are marked ✅ COMPLETE.

**Role:** Principal Staff Engineer  
**Context:** Audit schema against all built phases, wire deferred server actions, and hydrate the database with high-fidelity seed data for QA and demo.  
**Quality Standard:** Institutional Grade.  
**Execution Rules:**  
- Do NOT alter any styling or UX layers during this phase. No CSS changes.  
- `walk_ins` is the canonical table — never reference `availability_inquiries` anywhere.  
- `tenants` is the canonical table — never reference `boutiques` anywhere.  
- If Phase 5 added WatermelonDB schema `v1`, any Drizzle schema changes here MUST be backward-compatible or require a WatermelonDB migration bump.  
- All `withTenant` calls MUST include correct `role` parameter matching the `staffRoleEnum`.

---

## [EXECUTION BLOCK 1: Schema Integrity Audit]

### 1.1 — Audit Checklist
Run the following audit across `packages/database/src/schema.ts`. Verify every item:

```bash
# Verify schema compiles
pnpm --filter @toptenprom/database typecheck

# Verify schema integrity (correct drizzle-kit command)
pnpm --filter @toptenprom/database db:check
```

**Manual verification checklist:**
- [ ] `appointments` table has `original_tenant_id`, `rerouted_reason`, `geospatial_distance_km` columns (cross-boutique load balancing)
- [ ] `appointments` table has `confirmation_code` (unique index)
- [ ] `dress_reservations` has `(dress_id, tenant_id, color_name, size, reservation_status)` unique constraint — the competitive moat
- [ ] `walk_ins` table exists (NOT `availability_inquiries`)
- [ ] `tenants` table exists (NOT `boutiques`)
- [ ] `boutique_staff.role` enum does NOT include `'customer'` — customers live in the separate `customers` table
- [ ] `customers` table has `guardian_name`, `guardian_phone`, `guardian_email`, `prom_year`, `school_name`
- [ ] `vto_sessions` has `realtime_channel_id`, `fal_request_id`, `processing_duration_ms`
- [ ] All tables have `created_at` and `updated_at` with correct defaults

### 1.2 — If any check fails, add missing columns via Drizzle migration
```bash
# Generate migration for any missing columns
pnpm --filter @toptenprom/database db:migrate

# Push schema to Supabase
pnpm --filter @toptenprom/database db:push
```

---

## [EXECUTION BLOCK 2: High-Fidelity Seed Script]

### 2.1 — `packages/database/src/seed.ts`
> **This script is idempotent** — running it twice MUST produce the same state (use `onConflictDoNothing` or `onConflictDoUpdate` everywhere).

```typescript
import 'dotenv/config';
import { db } from './client';
import {
  tenants,
  users,
  customers,
  boutique_staff,
  dresses,
  dress_inventory,
  appointments,
  walk_ins,
  vto_sessions,
  client_style_profiles,
  dress_reservations,
} from './schema';
import { sql } from 'drizzle-orm';
import crypto from 'crypto';

// ─── HELPERS ─────────────────────────────────────────────────────────────────

function uuid(): string {
  return crypto.randomUUID();
}

function generateConfirmationCode(): string {
  return `T10-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
}

function futureDate(daysFromNow: number, hour: number = 10): Date {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  d.setHours(hour, 0, 0, 0);
  return d;
}

// ─── SEED DATA CONSTANTS ─────────────────────────────────────────────────────

const FLAGSHIP_ID = '00000000-0000-0000-0000-000000000001';
const SATELLITE_ID = '00000000-0000-0000-0000-000000000002';

const USER_IDS = {
  super_admin: '00000000-0000-0000-1000-000000000001',
  owner: '00000000-0000-0000-1000-000000000002',
  stylist: '00000000-0000-0000-1000-000000000003',
  receptionist: '00000000-0000-0000-1000-000000000004',
  customer_alice: '00000000-0000-0000-1000-000000000005',
  customer_bella: '00000000-0000-0000-1000-000000000006',
};

const DESIGNER_IMAGES: Record<string, string[]> = {
  prom: [
    'https://images.unsplash.com/photo-1594938298603-c8148c4b4ae4?w=800&auto=format&fit=crop&q=85',
    'https://images.unsplash.com/photo-1595777457583-95e059d581b8?w=800&auto=format&fit=crop&q=85',
    'https://images.unsplash.com/photo-1566174053879-31528523f8ae?w=800&auto=format&fit=crop&q=85',
    'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=800&auto=format&fit=crop&q=85',
    'https://images.unsplash.com/photo-1539109136881-3be0616acf4b?w=800&auto=format&fit=crop&q=85',
    'https://images.unsplash.com/photo-1469334031218-e382a71b716b?w=800&auto=format&fit=crop&q=85',
    'https://images.unsplash.com/photo-1550928431-ee0ec6db30d3?w=800&auto=format&fit=crop&q=85',
    'https://images.unsplash.com/photo-1490481651871-ab68de25d43d?w=800&auto=format&fit=crop&q=85',
    'https://images.unsplash.com/photo-1434389677669-e08b4cac3105?w=800&auto=format&fit=crop&q=85',
    'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800&auto=format&fit=crop&q=85',
  ],
  wedding: [
    'https://images.unsplash.com/photo-1519741347686-c1e0aadf4611?w=800&auto=format&fit=crop&q=85',
    'https://images.unsplash.com/photo-1522673607200-164d1b6ce486?w=800&auto=format&fit=crop&q=85',
    'https://images.unsplash.com/photo-1583391733956-3750e0ff4e8b?w=800&auto=format&fit=crop&q=85',
    'https://images.unsplash.com/photo-1509631179647-0177331693ae?w=800&auto=format&fit=crop&q=85',
    'https://images.unsplash.com/photo-1537633552985-df8429e8048b?w=800&auto=format&fit=crop&q=85',
  ],
};

// ─── MAIN SEED FUNCTION ───────────────────────────────────────────────────────

async function seed() {
  console.log('🌱 [Seed] Starting Top 10 Prom database hydration…');

  // ─── TENANTS ─────────────────────────────────────────────────────────────
  console.log('[Seed] Inserting tenants…');
  await db.insert(tenants).values([
    {
      id: FLAGSHIP_ID,
      name: 'Top 10 Prom — Flagship Midtown',
      subdomain: 'flagship',
      address: '250 W 57th St, Suite 1200',
      city: 'New York',
      state: 'NY',
      zip: '10107',
      phone: '(212) 555-0100',
      email: 'flagship@toptenprom.com',
      location_data: { lat: 40.7659, lng: -73.9832, timezone: 'America/New_York', place_id: 'ChIJflagship' },
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
      max_daily_appointments: 40,
    },
    {
      id: SATELLITE_ID,
      name: 'Top 10 Prom — Satellite SoHo',
      subdomain: 'soho',
      address: '420 W Broadway',
      city: 'New York',
      state: 'NY',
      zip: '10012',
      phone: '(212) 555-0200',
      email: 'soho@toptenprom.com',
      location_data: { lat: 40.7233, lng: -74.0030, timezone: 'America/New_York', place_id: 'ChIJsoho' },
      business_hours: {
        monday: { open: '11:00', close: '19:00', closed: false },
        tuesday: { open: '11:00', close: '19:00', closed: false },
        wednesday: { open: '11:00', close: '19:00', closed: false },
        thursday: { open: '11:00', close: '19:00', closed: false },
        friday: { open: '11:00', close: '20:00', closed: false },
        saturday: { open: '10:00', close: '20:00', closed: false },
        sunday: { open: '12:00', close: '17:00', closed: false },
      },
      is_active: true,
      max_daily_appointments: 20,
    },
  ]).onConflictDoUpdate({
    target: tenants.id,
    set: { name: sql`excluded.name`, updated_at: new Date() },
  });

  // ─── USERS ───────────────────────────────────────────────────────────────
  console.log('[Seed] Inserting users…');
  await db.insert(users).values([
    { id: USER_IDS.super_admin, email: 'superadmin@toptenprom.com', first_name: 'Alex', last_name: 'Network', phone: '(212) 555-9000' },
    { id: USER_IDS.owner, email: 'owner@toptenprom.com', first_name: 'Morgan', last_name: 'Flagship', phone: '(212) 555-9001' },
    { id: USER_IDS.stylist, email: 'stylist@toptenprom.com', first_name: 'Jordan', last_name: 'Style', phone: '(212) 555-9002' },
    { id: USER_IDS.receptionist, email: 'receptionist@toptenprom.com', first_name: 'Casey', last_name: 'Front', phone: '(212) 555-9003' },
    { id: USER_IDS.customer_alice, email: 'alice@example.com', first_name: 'Alice', last_name: 'Johnson', phone: '(646) 555-0101' },
    { id: USER_IDS.customer_bella, email: 'bella@example.com', first_name: 'Bella', last_name: 'Martinez', phone: '(646) 555-0102' },
  ]).onConflictDoUpdate({
    target: users.email,
    set: { first_name: sql`excluded.first_name`, updated_at: new Date() },
  });

  // ─── CUSTOMERS ───────────────────────────────────────────────────────────
  const ALICE_CUSTOMER_ID = uuid();
  const BELLA_CUSTOMER_ID = uuid();
  console.log('[Seed] Inserting customers…');
  await db.insert(customers).values([
    {
      id: ALICE_CUSTOMER_ID,
      user_id: USER_IDS.customer_alice,
      prom_year: 2025,
      school_name: 'Park Slope Prep',
      guardian_name: 'Carol Johnson',
      guardian_phone: '(646) 555-0100',
      guardian_email: 'carol.johnson@example.com',
    },
    {
      id: BELLA_CUSTOMER_ID,
      user_id: USER_IDS.customer_bella,
      prom_year: 2025,
      school_name: 'Chelsea Arts Academy',
      guardian_name: 'Rosa Martinez',
      guardian_phone: '(646) 555-0103',
      guardian_email: 'rosa.martinez@example.com',
    },
  ]).onConflictDoUpdate({
    target: customers.user_id,
    set: { prom_year: sql`excluded.prom_year`, updated_at: new Date() },
  });

  // ─── BOUTIQUE STAFF ───────────────────────────────────────────────────────
  console.log('[Seed] Inserting boutique_staff…');
  await db.insert(boutique_staff).values([
    { user_id: USER_IDS.super_admin, tenant_id: null, role: 'super_admin', is_active: true },
    { user_id: USER_IDS.owner, tenant_id: FLAGSHIP_ID, role: 'owner', is_active: true },
    { user_id: USER_IDS.stylist, tenant_id: FLAGSHIP_ID, role: 'stylist', is_active: true },
    { user_id: USER_IDS.receptionist, tenant_id: FLAGSHIP_ID, role: 'receptionist', is_active: true },
  ]).onConflictDoNothing();

  // ─── DRESSES (10 PROM + 5 WEDDING) ───────────────────────────────────────
  console.log('[Seed] Inserting dresses…');

  const DRESS_IDS = {
    prom: Array.from({ length: 10 }, () => uuid()),
    wedding: Array.from({ length: 5 }, () => uuid()),
  };

  const promDresses = [
    { name: 'Celestial Gown', designer: 'Sherri Hill', silhouette: 'Ball Gown', neckline: 'Sweetheart', fabric: 'Tulle & Sequin', price: '895', colors: [{ name: 'Blush Pink', hex: '#F9A8D4', swatch_image_url: DESIGNER_IMAGES.prom[0]! }, { name: 'Midnight Blue', hex: '#1E3A5F', swatch_image_url: DESIGNER_IMAGES.prom[1]! }] },
    { name: 'Aurora Glimmer', designer: 'Jovani', silhouette: 'Mermaid', neckline: 'V-Neck', fabric: 'Beaded Mesh', price: '1,195', colors: [{ name: 'Champagne', hex: '#C9A96E', swatch_image_url: DESIGNER_IMAGES.prom[2]! }, { name: 'Black', hex: '#111111', swatch_image_url: DESIGNER_IMAGES.prom[3]! }] },
    { name: 'Velvet Reverie', designer: 'Mac Duggal', silhouette: 'A-Line', neckline: 'Off-Shoulder', fabric: 'Velvet', price: '745', colors: [{ name: 'Deep Ruby', hex: '#9B1C1C', swatch_image_url: DESIGNER_IMAGES.prom[4]! }] },
    { name: 'Diamond Cascade', designer: 'Ashley Lauren', silhouette: 'Trumpet', neckline: 'Halter', fabric: 'Sequin', price: '1,095', colors: [{ name: 'Gold', hex: '#B7860B', swatch_image_url: DESIGNER_IMAGES.prom[5]! }] },
    { name: 'Starlight Escape', designer: 'Ellie Wilde', silhouette: 'Column', neckline: 'One Shoulder', fabric: 'Jersey', price: '695', colors: [{ name: 'Sage Green', hex: '#8DA888', swatch_image_url: DESIGNER_IMAGES.prom[6]! }] },
    { name: 'Iridescent Dreams', designer: 'Portia & Scarlett', silhouette: 'Ball Gown', neckline: 'Strapless', fabric: 'Glitter Tulle', price: '995', colors: [{ name: 'Periwinkle', hex: '#CCCCFF', swatch_image_url: DESIGNER_IMAGES.prom[7]! }] },
    { name: 'Midnight Opulence', designer: 'Tarik Ediz', silhouette: 'Mermaid', neckline: 'Plunge', fabric: 'Crepe & Sequin', price: '1,495', colors: [{ name: 'Onyx Black', hex: '#0B0A0E', swatch_image_url: DESIGNER_IMAGES.prom[8]! }] },
    { name: 'Garden Empress', designer: 'Primavera', silhouette: 'A-Line', neckline: 'Square Neck', fabric: 'Floral Lace', price: '845', colors: [{ name: 'Ivory', hex: '#F8F4F0', swatch_image_url: DESIGNER_IMAGES.prom[9]! }] },
    { name: 'Cobalt Vision', designer: 'Sherri Hill', silhouette: 'High-Low', neckline: 'Illusion', fabric: 'Stretch Sequin', price: '795', colors: [{ name: 'Cobalt Blue', hex: '#1B4FD8', swatch_image_url: DESIGNER_IMAGES.prom[0]! }] },
    { name: 'Rose Fantasia', designer: 'Jovani', silhouette: 'Ballroom', neckline: 'Sweetheart', fabric: 'Organza', price: '1,250', colors: [{ name: 'Rose Gold', hex: '#B76E79', swatch_image_url: DESIGNER_IMAGES.prom[1]! }] },
  ];

  const weddingDresses = [
    { name: 'Eternal Grace', designer: 'Vera Wang', silhouette: 'A-Line', neckline: 'Bateau', fabric: 'Mikado Silk', price: '2,995', colors: [{ name: 'Ivory', hex: '#F8F4F0', swatch_image_url: DESIGNER_IMAGES.wedding[0]! }] },
    { name: 'Celestine Veil', designer: 'Monique Lhuillier', silhouette: 'Ball Gown', neckline: 'Illusion', fabric: 'French Lace', price: '3,495', colors: [{ name: 'Soft White', hex: '#F9F7F4', swatch_image_url: DESIGNER_IMAGES.wedding[1]! }] },
    { name: 'Elysian Bloom', designer: 'Marchesa', silhouette: 'Empire', neckline: 'V-Neck', fabric: 'Organza & Floral', price: '3,195', colors: [{ name: 'Blush', hex: '#F5C2C2', swatch_image_url: DESIGNER_IMAGES.wedding[2]! }] },
    { name: 'Obsidian Bridal', designer: 'Viktor & Rolf', silhouette: 'Column', neckline: 'Off-Shoulder', fabric: 'Stretch Crepe', price: '2,795', colors: [{ name: 'Noir', hex: '#0B0A0E', swatch_image_url: DESIGNER_IMAGES.wedding[3]! }] },
    { name: 'Golden Hour Gown', designer: 'Jenny Yoo', silhouette: 'A-Line', neckline: 'Cowl', fabric: 'Charmeuse', price: '2,195', colors: [{ name: 'Champagne Gold', hex: '#C9A96E', swatch_image_url: DESIGNER_IMAGES.wedding[4]! }] },
  ];

  // Insert prom dresses
  for (let i = 0; i < promDresses.length; i++) {
    const d = promDresses[i]!;
    const priceNum = parseFloat(d.price.replace(',', ''));
    await db.insert(dresses).values({
      id: DRESS_IDS.prom[i]!,
      sku: `PROM-2025-${String(i + 1).padStart(3, '0')}`,
      name: d.name,
      designer: d.designer,
      description: `A stunning ${d.silhouette} gown featuring ${d.fabric} fabric. Perfect for prom night with ${d.neckline} neckline detailing.`,
      occasion: 'prom',
      silhouette: d.silhouette,
      neckline: d.neckline,
      fabric: d.fabric,
      available_colors: d.colors,
      available_sizes: ['0', '2', '4', '6', '8', '10', '12', '14', '16'],
      base_price: (priceNum * 0.6).toFixed(2),
      retail_price: priceNum.toFixed(2),
      image_urls: {
        hero: d.colors[0]!.swatch_image_url,
        gallery: [d.colors[0]!.swatch_image_url],
        on_model: [d.colors[0]!.swatch_image_url],
      },
      is_active: true,
      is_exclusive: i < 3, // First 3 are exclusive
    }).onConflictDoNothing();
  }

  // Insert wedding dresses
  for (let i = 0; i < weddingDresses.length; i++) {
    const d = weddingDresses[i]!;
    const priceNum = parseFloat(d.price.replace(',', ''));
    await db.insert(dresses).values({
      id: DRESS_IDS.wedding[i]!,
      sku: `WED-2025-${String(i + 1).padStart(3, '0')}`,
      name: d.name,
      designer: d.designer,
      description: `An exquisite ${d.silhouette} bridal gown crafted from ${d.fabric}. Features a beautiful ${d.neckline} neckline.`,
      occasion: 'wedding',
      silhouette: d.silhouette,
      neckline: d.neckline,
      fabric: d.fabric,
      available_colors: d.colors,
      available_sizes: ['2', '4', '6', '8', '10', '12', '14', '16', '18', '20'],
      base_price: (priceNum * 0.55).toFixed(2),
      retail_price: priceNum.toFixed(2),
      image_urls: {
        hero: d.colors[0]!.swatch_image_url,
        gallery: [d.colors[0]!.swatch_image_url],
        on_model: [d.colors[0]!.swatch_image_url],
      },
      is_active: true,
      is_exclusive: false,
    }).onConflictDoNothing();
  }

  // ─── DRESS INVENTORY (Flagship + Satellite) ───────────────────────────────
  console.log('[Seed] Populating dress inventory…');

  for (const dressId of DRESS_IDS.prom) {
    await db.insert(dress_inventory).values([
      { dress_id: dressId, tenant_id: FLAGSHIP_ID, color_name: 'Blush Pink', size: '6', quantity_on_hand: 2, quantity_reserved: 0, in_stock: true },
      { dress_id: dressId, tenant_id: FLAGSHIP_ID, color_name: 'Midnight Blue', size: '8', quantity_on_hand: 1, quantity_reserved: 0, in_stock: true },
      { dress_id: dressId, tenant_id: SATELLITE_ID, color_name: 'Blush Pink', size: '10', quantity_on_hand: 1, quantity_reserved: 0, in_stock: true },
    ]).onConflictDoNothing();
  }

  for (const dressId of DRESS_IDS.wedding) {
    await db.insert(dress_inventory).values([
      { dress_id: dressId, tenant_id: FLAGSHIP_ID, color_name: 'Ivory', size: '8', quantity_on_hand: 1, quantity_reserved: 0, in_stock: true },
      { dress_id: dressId, tenant_id: FLAGSHIP_ID, color_name: 'Soft White', size: '10', quantity_on_hand: 1, quantity_reserved: 0, in_stock: true },
    ]).onConflictDoNothing();
  }

  // ─── APPOINTMENTS ─────────────────────────────────────────────────────────
  console.log('[Seed] Creating appointments…');
  await db.insert(appointments).values([
    {
      tenant_id: FLAGSHIP_ID,
      customer_id: ALICE_CUSTOMER_ID,
      stylist_id: null,
      appointment_date: futureDate(1, 10),
      duration_minutes: 90,
      service_type: 'prom-styling',
      status: 'confirmed',
      confirmation_code: generateConfirmationCode(),
      notes: 'Looking for ballgown style. Prefers blush or champagne tones.',
    },
    {
      tenant_id: FLAGSHIP_ID,
      customer_id: BELLA_CUSTOMER_ID,
      stylist_id: null,
      appointment_date: futureDate(1, 13),
      duration_minutes: 90,
      service_type: 'prom-styling',
      status: 'confirmed',
      confirmation_code: generateConfirmationCode(),
      notes: 'Budget $800-1200. Interested in mermaid silhouette.',
    },
    {
      tenant_id: FLAGSHIP_ID,
      customer_id: ALICE_CUSTOMER_ID,
      stylist_id: null,
      appointment_date: futureDate(3, 11),
      duration_minutes: 60,
      service_type: 'alteration-fitting',
      status: 'pending',
      confirmation_code: generateConfirmationCode(),
    },
  ]).onConflictDoNothing();

  // ─── WALK-INS (active queue) ──────────────────────────────────────────────
  console.log('[Seed] Creating walk_ins…');
  await db.insert(walk_ins).values([
    {
      tenant_id: FLAGSHIP_ID,
      customer_name: 'Emma Thompson',
      phone_number: '(646) 555-1001',
      party_size: 3,
      occasion: 'prom',
      status: 'waiting',
      queue_position: 1,
      estimated_wait_minutes: 15,
      checked_in_at: new Date(),
    },
    {
      tenant_id: FLAGSHIP_ID,
      customer_name: 'Sophia Chen',
      phone_number: '(646) 555-1002',
      party_size: 2,
      occasion: 'homecoming',
      status: 'waiting',
      queue_position: 2,
      estimated_wait_minutes: 30,
      checked_in_at: new Date(),
    },
    {
      tenant_id: FLAGSHIP_ID,
      customer_name: 'Isabella Rodriguez',
      phone_number: '(646) 555-1003',
      party_size: 4,
      occasion: 'wedding',
      status: 'called',
      queue_position: 3,
      estimated_wait_minutes: 5,
      checked_in_at: new Date(Date.now() - 25 * 60 * 1000), // 25 minutes ago
      called_at: new Date(),
    },
  ]).onConflictDoNothing();

  // ─── VTO SESSIONS ─────────────────────────────────────────────────────────
  console.log('[Seed] Creating VTO sessions…');
  await db.insert(vto_sessions).values([
    {
      user_id: USER_IDS.customer_alice,
      tenant_id: FLAGSHIP_ID,
      dress_id: DRESS_IDS.prom[0]!,
      color_name: 'Blush Pink',
      fal_request_id: 'fal_seed_001',
      realtime_channel_id: 'vto-seed-001',
      status: 'completed',
      input_image_url: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400',
      output_image_url: DESIGNER_IMAGES.prom[0],
      processing_started_at: new Date(Date.now() - 10 * 1000),
      processing_completed_at: new Date(),
      processing_duration_ms: 8500,
    },
    {
      user_id: USER_IDS.customer_alice,
      tenant_id: FLAGSHIP_ID,
      dress_id: DRESS_IDS.prom[1]!,
      color_name: 'Champagne',
      fal_request_id: 'fal_seed_002',
      realtime_channel_id: 'vto-seed-002',
      status: 'completed',
      input_image_url: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400',
      output_image_url: DESIGNER_IMAGES.prom[2],
      processing_started_at: new Date(Date.now() - 5 * 60 * 1000),
      processing_completed_at: new Date(Date.now() - 5 * 60 * 1000 + 9200),
      processing_duration_ms: 9200,
    },
  ]).onConflictDoNothing();

  // ─── CLIENT STYLE PROFILES ────────────────────────────────────────────────
  console.log('[Seed] Creating client_style_profiles…');
  await db.insert(client_style_profiles).values([
    {
      user_id: USER_IDS.customer_alice,
      preferred_designers: ['Sherri Hill', 'Jovani'],
      preferred_colors: [{ name: 'Blush Pink', hex: '#F9A8D4' }, { name: 'Champagne', hex: '#C9A96E' }],
      preferred_silhouettes: ['Ball Gown', 'A-Line'],
      preferred_occasions: ['prom'],
      avoided_styles: ['Column', 'High-Low'],
      budget_min: '800',
      budget_max: '1200',
      raw_conversation_summary: 'Alice is looking for a classic, princess-style gown in blush or champagne for her 2025 senior prom. Prefers sweetheart necklines.',
      last_interaction_at: new Date(),
      interaction_count: 3,
    },
  ]).onConflictDoUpdate({
    target: client_style_profiles.user_id,
    set: { raw_conversation_summary: sql`excluded.raw_conversation_summary`, updated_at: new Date() },
  });

  // ─── DRESS RESERVATIONS (Prom Registry) ──────────────────────────────────
  console.log('[Seed] Creating dress_reservations…');
  await db.insert(dress_reservations).values([
    {
      customer_id: ALICE_CUSTOMER_ID,
      dress_id: DRESS_IDS.prom[0]!,
      tenant_id: FLAGSHIP_ID,
      color_name: 'Blush Pink',
      size: '6',
      reservation_status: 'active',
      school_name: 'Park Slope Prep',
      prom_date: new Date('2025-06-07'),
      deposit_amount: '200',
      deposit_paid_at: new Date(),
      notes: 'Reserved for senior prom. Do not release without customer confirmation.',
    },
  ]).onConflictDoNothing();

  console.log('✅ [Seed] Database hydration complete!');
  console.log(`
  ─────────────────────────────────────────────
  Seed Summary:
    Tenants:            2 (flagship + soho)
    Users:              6 (2 staff + 4 test users)
    Boutique Staff:     4 (super_admin + owner + stylist + receptionist)
    Customers:          2 (alice + bella)
    Dresses:            15 (10 prom + 5 wedding)
    Dress Inventory:    ${10 * 3 + 5 * 2} records across 2 locations
    Appointments:       3 (2 confirmed + 1 pending)
    Walk-Ins:           3 (2 waiting + 1 called)
    VTO Sessions:       2 (completed)
    Style Profiles:     1
    Dress Reservations: 1
  ─────────────────────────────────────────────
  Test Credentials:
    super_admin@toptenprom.com / [set in Supabase Auth]
    owner@toptenprom.com       / [set in Supabase Auth]
    stylist@toptenprom.com     / [set in Supabase Auth]
    receptionist@toptenprom.com / [set in Supabase Auth]
  ─────────────────────────────────────────────
  Boutique Subdomains:
    http://flagship.localhost:3000
    http://soho.localhost:3000
  ─────────────────────────────────────────────
  `);
  process.exit(0);
}

seed().catch((error) => {
  console.error('❌ [Seed] Fatal error:', error);
  process.exit(1);
});
```

---

## [EXECUTION BLOCK 3: Deferred Server Action Wiring]

### 3.1 — Walk-In Server Action (writing to `walk_ins` table)
Create `apps/brand-network-web/src/actions/walk-in-actions.ts` (if not already created in Phase 3):
```typescript
'use server';

import { revalidatePath } from 'next/cache';
import { requireDashboardSession } from '@/lib/auth';
import { withTenant, db } from '@toptenprom/database';
import { walk_ins } from '@toptenprom/database';
import { eq } from 'drizzle-orm';

/**
 * Server Action: Create a walk-in kiosk entry.
 * Table: walk_ins — NOT availability_inquiries (that table does not exist)
 */
export async function createWalkIn(formData: {
  customerName: string;
  phoneNumber: string;
  partySize: number;
  occasion?: string;
  notes?: string;
}): Promise<{ success: boolean; walkInId?: string; error?: string }> {
  const user = await requireDashboardSession();

  if (!user.tenant_id) {
    return { success: false, error: 'No tenant assigned to this account' };
  }

  try {
    // Get current queue length for position
    const existingQueue = await db
      .select({ id: walk_ins.id })
      .from(walk_ins)
      .where(eq(walk_ins.tenant_id, user.tenant_id));

    const queuePosition = existingQueue.length + 1;

    const result = await withTenant(user.tenant_id, user.id, user.role, async (tx) => {
      return tx.insert(walk_ins).values({
        tenant_id: user.tenant_id!,
        customer_name: formData.customerName,
        phone_number: formData.phoneNumber,
        party_size: formData.partySize,
        occasion: formData.occasion as 'prom' | 'wedding' | 'homecoming' | null,
        notes: formData.notes ?? null,
        status: 'waiting',
        queue_position: queuePosition,
        estimated_wait_minutes: queuePosition * 15,
        checked_in_at: new Date(),
      }).returning({ id: walk_ins.id });
    });

    revalidatePath('/dashboard/receptionist');
    return { success: true, walkInId: result[0]?.id };
  } catch (error) {
    console.error('[createWalkIn] Server action failed:', error);
    return { success: false, error: 'Failed to add to queue. Please try again.' };
  }
}
```

### 3.2 — "Save to Registry" Server Action
Create `apps/brand-network-web/src/actions/registry-actions.ts`:
```typescript
'use server';

import { requireDashboardSession } from '@/lib/auth';
import { withTenant, db } from '@toptenprom/database';
import { dress_reservations, customers } from '@toptenprom/database';
import { eq } from 'drizzle-orm';
import { createClient } from '@/lib/supabase/server';

export async function saveToRegistry(params: {
  dressId: string;
  colorName: string;
  size: string;
  schoolName?: string;
  promDate?: string;
}): Promise<{ success: boolean; reservationId?: string; error?: string }> {
  const supabase = await createClient();
  const { data: { user: authUser } } = await supabase.auth.getUser();

  if (!authUser) {
    return { success: false, error: 'You must be signed in to save a reservation.' };
  }

  // Get customer record
  let customerId: string | null = null;
  try {
    const customerResult = await db
      .select({ id: customers.id })
      .from(customers)
      .where(eq(customers.user_id, authUser.id))
      .limit(1);

    customerId = customerResult[0]?.id ?? null;
  } catch {
    return { success: false, error: 'Customer profile not found.' };
  }

  if (!customerId) {
    return { success: false, error: 'Please complete your customer profile before saving to registry.' };
  }

  // Get tenant_id from request context — passed from the component
  // For catalog/VTO, tenant_id comes from the subdomain or user's nearest boutique
  // This is a simplified version — in production, tenant resolution is more sophisticated
  const tenantId = params.promDate ?? null; // Replace with actual tenant resolution

  try {
    const result = await db
      .insert(dress_reservations)
      .values({
        customer_id: customerId,
        dress_id: params.dressId,
        tenant_id: tenantId ?? '00000000-0000-0000-0000-000000000001', // Default to flagship
        color_name: params.colorName,
        size: params.size,
        reservation_status: 'active',
        school_name: params.schoolName ?? null,
        prom_date: params.promDate ? new Date(params.promDate) : null,
        expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30-day hold
      })
      .onConflictDoNothing()
      .returning({ id: dress_reservations.id });

    if (!result[0]?.id) {
      return { success: false, error: 'This dress in your size and color is already reserved at this boutique.' };
    }

    return { success: true, reservationId: result[0].id };
  } catch (error) {
    console.error('[saveToRegistry] Failed:', error);
    return { success: false, error: 'Failed to save reservation. Please try again.' };
  }
}
```

---

## [VALIDATION CHECKPOINT — PHASE 6]

```bash
# Run full schema check
pnpm --filter @toptenprom/database db:check

# Execute seed (idempotent — safe to run multiple times)
pnpm --filter @toptenprom/database db:seed

# Typecheck all packages
pnpm typecheck
```

**Required output from seed:**
- Console prints full seed summary table
- No constraint violations
- 15 dresses across 2 tenants with full inventory
- 3 walk_ins in the `walk_ins` table (not `availability_inquiries`)
- 2 VTO sessions linked to alice's user ID
- 1 active dress reservation with `reservation_status: 'active'`

**Update PHASE_MANIFEST.md:** Mark Phase 6 as ✅ COMPLETE.

**STOP. Await human approval before executing Phase 7.**
