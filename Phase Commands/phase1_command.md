# Phase 1: Monorepo Foundation & Institutional-Grade Data Layer

---

## [PRE-EXECUTION DIRECTIVE]
**MANDATORY FIRST ACTION:** Read `PHASE_MANIFEST.md` (Phase 0) in full before executing a single command. Every table name, env var key, and design token reference in this phase derives from that document.

**Role:** Principal Staff Engineer  
**Context:** Initializing `toptenprom-ecosystem` — a multi-tenant SaaS serving a 55-location boutique prom/wedding retail network.  
**Quality Standard:** Institutional Grade (Apple/LVMH rigor). Zero placeholders. Zero `// TODO` comments. Zero implicit `any` types.  
**Execution Rule:** Do NOT write any frontend Next.js code, UI components, or routing logic during this phase. Database and monorepo scaffold only.

---

## [EXECUTION BLOCK 1: Workspace Scaffolding]

### 1.1 — Root Initialization
```bash
mkdir toptenprom-ecosystem && cd toptenprom-ecosystem
git init
pnpm init
```

### 1.2 — `pnpm-workspace.yaml`
Create at workspace root:
```yaml
packages:
  - 'apps/*'
  - 'packages/*'
```

### 1.3 — `turbo.json`
Create at workspace root with full pipeline configuration:
```json
{
  "$schema": "https://turbo.build/schema.json",
  "globalDependencies": ["**/.env.*local"],
  "pipeline": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": [".next/**", "!.next/cache/**", "dist/**"]
    },
    "typecheck": {
      "dependsOn": ["^build"]
    },
    "lint": {},
    "dev": {
      "cache": false,
      "persistent": true
    },
    "db:push": {
      "cache": false
    },
    "db:seed": {
      "cache": false
    }
  }
}
```

### 1.4 — `tsconfig.base.json`
Create at workspace root:
```json
{
  "$schema": "https://json.schemastore.org/tsconfig",
  "display": "Default",
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022"],
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "strictNullChecks": true,
    "noImplicitAny": true,
    "noImplicitOverride": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "forceConsistentCasingInFileNames": true,
    "skipLibCheck": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "baseUrl": ".",
    "paths": {}
  },
  "exclude": ["node_modules"]
}
```

### 1.5 — Package Directory Scaffold
```bash
# Create all workspace package directories
mkdir -p apps/brand-network-web
mkdir -p apps/mobile-instore-app
mkdir -p packages/database/src
mkdir -p packages/typescript-config
mkdir -p packages/eslint-config
mkdir -p packages/ui-design-system/src

# Initialize Next.js 16.2.4 (basic only — NO components)
cd apps/brand-network-web
pnpm create next-app@16.2.4 . --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --yes

# Initialize Expo SDK 52 (basic only — NO screens)
cd ../mobile-instore-app
pnpm create expo-app@latest . --template blank-typescript
cd ../..

# Initialize packages
cd packages/typescript-config && pnpm init && cd ../..
cd packages/eslint-config && pnpm init && cd ../..
cd packages/ui-design-system && pnpm init && cd ../..
cd packages/database && pnpm init && cd ../..
```

### 1.6 — `packages/typescript-config/`
Create `packages/typescript-config/base.json`:
```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "composite": false,
    "declaration": true,
    "declarationMap": true
  }
}
```

Create `packages/typescript-config/nextjs.json`:
```json
{
  "extends": "./base.json",
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["dom", "dom.iterable", "ES2022"],
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "allowJs": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": {
      "@/*": ["./*"]
    }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

Create `packages/typescript-config/package.json`:
```json
{
  "name": "@toptenprom/typescript-config",
  "version": "0.0.1",
  "private": true,
  "license": "MIT",
  "exports": {
    "./base.json": "./base.json",
    "./nextjs.json": "./nextjs.json"
  }
}
```

---

## [EXECUTION BLOCK 2: The Single-Source-of-Truth Database Schema]

### 2.1 — Install Database Dependencies
```bash
cd packages/database
pnpm add drizzle-orm postgres
pnpm add -D drizzle-kit tsx @types/node
```

### 2.2 — `packages/database/package.json`
```json
{
  "name": "@toptenprom/database",
  "version": "0.0.1",
  "private": true,
  "exports": {
    ".": "./src/index.ts"
  },
  "scripts": {
    "typecheck": "tsc --noEmit",
    "lint": "eslint src/",
    "db:push": "drizzle-kit push",
    "db:migrate": "drizzle-kit migrate",
    "db:studio": "drizzle-kit studio",
    "db:seed": "tsx src/seed.ts",
    "db:check": "drizzle-kit check"
  },
  "dependencies": {
    "drizzle-orm": "latest",
    "postgres": "latest"
  },
  "devDependencies": {
    "drizzle-kit": "latest",
    "tsx": "latest",
    "@types/node": "latest",
    "typescript": "latest"
  }
}
```

### 2.3 — `packages/database/tsconfig.json`
```json
{
  "extends": "@toptenprom/typescript-config/base.json",
  "compilerOptions": {
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "outDir": "dist"
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

### 2.4 — `packages/database/src/schema.ts`
> **CANONICAL SCHEMA — All tables use exact names from PHASE_MANIFEST.md. Any deviation is a build failure.**

```typescript
import {
  pgTable,
  pgEnum,
  uuid,
  text,
  varchar,
  boolean,
  integer,
  decimal,
  timestamp,
  jsonb,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { relations, sql } from 'drizzle-orm';

// ─── TIMESTAMP HELPER ────────────────────────────────────────────────────────
const timestamps = {
  created_at: timestamp('created_at', { withTimezone: true })
    .notNull()
    .default(sql`now()`),
  updated_at: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .default(sql`now()`),
};

// ─── ENUMS ───────────────────────────────────────────────────────────────────

/** Staff roles only. Customer identity lives on the `customers` table. */
export const staffRoleEnum = pgEnum('staff_role', [
  'super_admin',
  'owner',
  'manager',
  'stylist',
  'receptionist',
]);

export const appointmentStatusEnum = pgEnum('appointment_status', [
  'pending',
  'confirmed',
  'in_progress',
  'completed',
  'cancelled',
  'no_show',
]);

export const walkInStatusEnum = pgEnum('walk_in_status', [
  'waiting',
  'called',
  'with_stylist',
  'completed',
  'left',
]);

export const dressOccasionEnum = pgEnum('dress_occasion', [
  'prom',
  'wedding',
  'bridesmaid',
  'homecoming',
  'pageant',
  'cocktail',
]);

export const vtoStatusEnum = pgEnum('vto_status', [
  'queued',
  'processing',
  'completed',
  'failed',
]);

// ─── CORE TABLES ─────────────────────────────────────────────────────────────

/**
 * `tenants` — Multi-tenant registry. Each row = one boutique location.
 * NOTE: Table name is TENANTS, not "boutiques". See PHASE_MANIFEST.md.
 */
export const tenants = pgTable(
  'tenants',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: varchar('name', { length: 255 }).notNull(),
    subdomain: varchar('subdomain', { length: 100 }).notNull(),
    address: text('address').notNull(),
    city: varchar('city', { length: 100 }).notNull(),
    state: varchar('state', { length: 50 }).notNull(),
    zip: varchar('zip', { length: 20 }).notNull(),
    phone: varchar('phone', { length: 30 }).notNull(),
    email: varchar('email', { length: 255 }).notNull(),
    location_data: jsonb('location_data').$type<{
      lat: number;
      lng: number;
      timezone: string;
      place_id: string;
    }>(),
    business_hours: jsonb('business_hours').$type<Record<string, { open: string; close: string; closed: boolean }>>(),
    is_active: boolean('is_active').notNull().default(true),
    max_daily_appointments: integer('max_daily_appointments').notNull().default(30),
    ...timestamps,
  },
  (table) => ({
    subdomainIdx: uniqueIndex('tenants_subdomain_idx').on(table.subdomain),
    activeIdx: index('tenants_active_idx').on(table.is_active),
  })
);

/**
 * `users` — Global auth mirror. `id` matches Supabase Auth UUID exactly.
 */
export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey(), // Matches Supabase Auth UUID — do NOT defaultRandom()
    email: varchar('email', { length: 255 }).notNull(),
    first_name: varchar('first_name', { length: 100 }).notNull(),
    last_name: varchar('last_name', { length: 100 }).notNull(),
    avatar_url: text('avatar_url'),
    phone: varchar('phone', { length: 30 }),
    ...timestamps,
  },
  (table) => ({
    emailIdx: uniqueIndex('users_email_idx').on(table.email),
  })
);

/**
 * `customers` — Customer-specific identity, separate from boutique_staff.
 * Linked to `users` for auth. Customers are NOT staff.
 */
export const customers = pgTable(
  'customers',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    user_id: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    preferred_sizes: jsonb('preferred_sizes').$type<string[]>(),
    style_notes: text('style_notes'),
    prom_year: integer('prom_year'),
    school_name: varchar('school_name', { length: 255 }),
    guardian_name: varchar('guardian_name', { length: 255 }),
    guardian_phone: varchar('guardian_phone', { length: 30 }),
    guardian_email: varchar('guardian_email', { length: 255 }),
    ...timestamps,
  },
  (table) => ({
    userIdx: uniqueIndex('customers_user_id_idx').on(table.user_id),
  })
);

/**
 * `boutique_staff` — Staff roles and tenant assignments.
 * Role enum: super_admin | owner | manager | stylist | receptionist
 * `tenant_id` is nullable only for super_admin (network-wide access).
 */
export const boutique_staff = pgTable(
  'boutique_staff',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    user_id: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    tenant_id: uuid('tenant_id').references(() => tenants.id, { onDelete: 'set null' }),
    role: staffRoleEnum('role').notNull(),
    is_active: boolean('is_active').notNull().default(true),
    hire_date: timestamp('hire_date', { withTimezone: true }),
    specialties: jsonb('specialties').$type<string[]>(),
    ...timestamps,
  },
  (table) => ({
    userTenantIdx: uniqueIndex('boutique_staff_user_tenant_idx').on(table.user_id, table.tenant_id),
    tenantIdx: index('boutique_staff_tenant_idx').on(table.tenant_id),
    roleIdx: index('boutique_staff_role_idx').on(table.role),
  })
);

/**
 * `dresses` — Global catalog. Designer-level product records.
 */
export const dresses = pgTable(
  'dresses',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    sku: varchar('sku', { length: 100 }).notNull(),
    name: varchar('name', { length: 255 }).notNull(),
    designer: varchar('designer', { length: 255 }).notNull(),
    description: text('description').notNull(),
    occasion: dressOccasionEnum('occasion').notNull(),
    silhouette: varchar('silhouette', { length: 100 }),
    neckline: varchar('neckline', { length: 100 }),
    fabric: varchar('fabric', { length: 255 }),
    embellishments: jsonb('embellishments').$type<string[]>(),
    available_colors: jsonb('available_colors').notNull().$type<Array<{
      name: string;
      hex: string;
      swatch_image_url: string;
    }>>(),
    available_sizes: jsonb('available_sizes').notNull().$type<string[]>(),
    base_price: decimal('base_price', { precision: 10, scale: 2 }).notNull(),
    retail_price: decimal('retail_price', { precision: 10, scale: 2 }).notNull(),
    image_urls: jsonb('image_urls').notNull().$type<{
      hero: string;
      gallery: string[];
      on_model: string[];
    }>(),
    is_active: boolean('is_active').notNull().default(true),
    is_exclusive: boolean('is_exclusive').notNull().default(false),
    ...timestamps,
  },
  (table) => ({
    skuIdx: uniqueIndex('dresses_sku_idx').on(table.sku),
    designerIdx: index('dresses_designer_idx').on(table.designer),
    occasionIdx: index('dresses_occasion_idx').on(table.occasion),
  })
);

/**
 * `dress_inventory` — Per-tenant stock ledger for each dress/color/size.
 */
export const dress_inventory = pgTable(
  'dress_inventory',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    dress_id: uuid('dress_id').notNull().references(() => dresses.id, { onDelete: 'cascade' }),
    tenant_id: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
    color_name: varchar('color_name', { length: 100 }).notNull(),
    size: varchar('size', { length: 20 }).notNull(),
    quantity_on_hand: integer('quantity_on_hand').notNull().default(0),
    quantity_reserved: integer('quantity_reserved').notNull().default(0),
    in_stock: boolean('in_stock').notNull().default(true),
    reorder_threshold: integer('reorder_threshold').notNull().default(1),
    ...timestamps,
  },
  (table) => ({
    dressTenantColorSizeIdx: uniqueIndex('dress_inventory_unique_idx').on(
      table.dress_id, table.tenant_id, table.color_name, table.size
    ),
    tenantIdx: index('dress_inventory_tenant_idx').on(table.tenant_id),
    inStockIdx: index('dress_inventory_in_stock_idx').on(table.in_stock),
  })
);

/**
 * `appointments` — Cross-location booking with load-balancing fields.
 */
export const appointments = pgTable(
  'appointments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenant_id: uuid('tenant_id').notNull().references(() => tenants.id), // MANDATORY
    customer_id: uuid('customer_id').notNull().references(() => customers.id),
    stylist_id: uuid('stylist_id').references(() => boutique_staff.id, { onDelete: 'set null' }),
    appointment_date: timestamp('appointment_date', { withTimezone: true }).notNull(),
    duration_minutes: integer('duration_minutes').notNull().default(60),
    service_type: varchar('service_type', { length: 100 }).notNull(),
    status: appointmentStatusEnum('status').notNull().default('pending'),
    notes: text('notes'),
    // Load-balancing fields for cross-boutique routing
    original_tenant_id: uuid('original_tenant_id').references(() => tenants.id), // If rerouted
    rerouted_reason: text('rerouted_reason'), // Why it was rerouted
    geospatial_distance_km: decimal('geospatial_distance_km', { precision: 8, scale: 3 }), // Distance from preferred location
    confirmation_code: varchar('confirmation_code', { length: 20 }).notNull(),
    reminder_sent_at: timestamp('reminder_sent_at', { withTimezone: true }),
    ...timestamps,
  },
  (table) => ({
    tenantDateIdx: index('appointments_tenant_date_idx').on(table.tenant_id, table.appointment_date),
    customerIdx: index('appointments_customer_idx').on(table.customer_id),
    stylistIdx: index('appointments_stylist_idx').on(table.stylist_id),
    statusIdx: index('appointments_status_idx').on(table.status),
    confirmationIdx: uniqueIndex('appointments_confirmation_idx').on(table.confirmation_code),
  })
);

/**
 * `walk_ins` — Kiosk walk-in queue per tenant.
 * NOTE: Table name is WALK_INS, not "availability_inquiries". See PHASE_MANIFEST.md.
 */
export const walk_ins = pgTable(
  'walk_ins',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenant_id: uuid('tenant_id').notNull().references(() => tenants.id), // MANDATORY
    customer_name: varchar('customer_name', { length: 255 }).notNull(),
    phone_number: varchar('phone_number', { length: 30 }).notNull(),
    party_size: integer('party_size').notNull().default(1),
    occasion: dressOccasionEnum('occasion'),
    notes: text('notes'),
    status: walkInStatusEnum('status').notNull().default('waiting'),
    checked_in_at: timestamp('checked_in_at', { withTimezone: true }).notNull().default(sql`now()`),
    called_at: timestamp('called_at', { withTimezone: true }),
    completed_at: timestamp('completed_at', { withTimezone: true }),
    assigned_stylist_id: uuid('assigned_stylist_id').references(() => boutique_staff.id),
    queue_position: integer('queue_position').notNull(),
    estimated_wait_minutes: integer('estimated_wait_minutes'),
    ...timestamps,
  },
  (table) => ({
    tenantStatusIdx: index('walk_ins_tenant_status_idx').on(table.tenant_id, table.status),
    tenantDateIdx: index('walk_ins_tenant_date_idx').on(table.tenant_id, table.checked_in_at),
  })
);

/**
 * `vto_sessions` — Virtual Try-On diffusion metadata and secure image URLs.
 * RLS: Isolated to authenticated user_id OR authorized staff of tenant.
 */
export const vto_sessions = pgTable(
  'vto_sessions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    user_id: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    tenant_id: uuid('tenant_id').references(() => tenants.id),
    dress_id: uuid('dress_id').notNull().references(() => dresses.id),
    color_name: varchar('color_name', { length: 100 }).notNull(),
    // Fal.ai (flux-kontext-pro) pipeline fields
    fal_request_id: varchar('fal_request_id', { length: 255 }),
    realtime_channel_id: varchar('realtime_channel_id', { length: 255 }).notNull(),
    status: vtoStatusEnum('status').notNull().default('queued'),
    input_image_url: text('input_image_url').notNull(),  // Signed Supabase Storage URL
    output_image_url: text('output_image_url'),           // Signed Supabase Storage URL
    output_thumbnail_url: text('output_thumbnail_url'),
    processing_started_at: timestamp('processing_started_at', { withTimezone: true }),
    processing_completed_at: timestamp('processing_completed_at', { withTimezone: true }),
    processing_duration_ms: integer('processing_duration_ms'),
    error_message: text('error_message'),
    metadata: jsonb('metadata').$type<Record<string, unknown>>(),
    ...timestamps,
  },
  (table) => ({
    userIdx: index('vto_sessions_user_idx').on(table.user_id),
    tenantIdx: index('vto_sessions_tenant_idx').on(table.tenant_id),
    falRequestIdx: index('vto_sessions_fal_request_idx').on(table.fal_request_id),
    statusIdx: index('vto_sessions_status_idx').on(table.status),
  })
);

/**
 * `client_style_profiles` — RAG preference vectors for the AI Stylist.
 * RLS: Isolated to authenticated user_id OR authorized staff.
 */
export const client_style_profiles = pgTable(
  'client_style_profiles',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    user_id: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    // AI-generated preference vectors
    preferred_designers: jsonb('preferred_designers').$type<string[]>().notNull().default([]),
    preferred_colors: jsonb('preferred_colors').$type<Array<{ name: string; hex: string }>>().notNull().default([]),
    preferred_silhouettes: jsonb('preferred_silhouettes').$type<string[]>().notNull().default([]),
    preferred_occasions: jsonb('preferred_occasions').$type<string[]>().notNull().default([]),
    avoided_styles: jsonb('avoided_styles').$type<string[]>().notNull().default([]),
    budget_min: decimal('budget_min', { precision: 10, scale: 2 }),
    budget_max: decimal('budget_max', { precision: 10, scale: 2 }),
    size_top: varchar('size_top', { length: 20 }),
    size_bottom: varchar('size_bottom', { length: 20 }),
    // Embedding vector (pgvector if enabled, otherwise stored as JSON)
    embedding_vector: jsonb('embedding_vector').$type<number[]>(),
    last_interaction_at: timestamp('last_interaction_at', { withTimezone: true }),
    interaction_count: integer('interaction_count').notNull().default(0),
    raw_conversation_summary: text('raw_conversation_summary'),
    ...timestamps,
  },
  (table) => ({
    userIdx: uniqueIndex('client_style_profiles_user_idx').on(table.user_id),
  })
);

/**
 * `dress_reservations` — Prom Registry. Links user + dress + tenant.
 * Prevents same dress/size/color being reserved by two students at same boutique.
 */
export const dress_reservations = pgTable(
  'dress_reservations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    customer_id: uuid('customer_id').notNull().references(() => customers.id, { onDelete: 'cascade' }),
    dress_id: uuid('dress_id').notNull().references(() => dresses.id),
    tenant_id: uuid('tenant_id').notNull().references(() => tenants.id),
    color_name: varchar('color_name', { length: 100 }).notNull(),
    size: varchar('size', { length: 20 }).notNull(),
    reservation_status: varchar('reservation_status', { length: 50 }).notNull().default('active'),
    reserved_at: timestamp('reserved_at', { withTimezone: true }).notNull().default(sql`now()`),
    expires_at: timestamp('expires_at', { withTimezone: true }),
    school_name: varchar('school_name', { length: 255 }),
    prom_date: timestamp('prom_date', { withTimezone: true }),
    deposit_amount: decimal('deposit_amount', { precision: 10, scale: 2 }),
    deposit_paid_at: timestamp('deposit_paid_at', { withTimezone: true }),
    notes: text('notes'),
    ...timestamps,
  },
  (table) => ({
    // Core uniqueness constraint — no duplicate dress/color/size per boutique
    uniqueReservationIdx: uniqueIndex('dress_reservations_unique_idx').on(
      table.dress_id, table.tenant_id, table.color_name, table.size, table.reservation_status
    ),
    customerIdx: index('dress_reservations_customer_idx').on(table.customer_id),
    tenantIdx: index('dress_reservations_tenant_idx').on(table.tenant_id),
    dressIdx: index('dress_reservations_dress_idx').on(table.dress_id),
  })
);

// ─── RELATIONS ───────────────────────────────────────────────────────────────

export const tenantsRelations = relations(tenants, ({ many }) => ({
  staff: many(boutique_staff),
  appointments: many(appointments),
  walk_ins: many(walk_ins),
  dress_inventory: many(dress_inventory),
  dress_reservations: many(dress_reservations),
  vto_sessions: many(vto_sessions),
}));

export const usersRelations = relations(users, ({ one, many }) => ({
  customer: one(customers, { fields: [users.id], references: [customers.user_id] }),
  staff_record: one(boutique_staff, { fields: [users.id], references: [boutique_staff.user_id] }),
  style_profile: one(client_style_profiles, { fields: [users.id], references: [client_style_profiles.user_id] }),
  vto_sessions: many(vto_sessions),
}));

export const customersRelations = relations(customers, ({ one, many }) => ({
  user: one(users, { fields: [customers.user_id], references: [users.id] }),
  appointments: many(appointments),
  dress_reservations: many(dress_reservations),
}));

export const boutiqueStaffRelations = relations(boutique_staff, ({ one, many }) => ({
  user: one(users, { fields: [boutique_staff.user_id], references: [users.id] }),
  tenant: one(tenants, { fields: [boutique_staff.tenant_id], references: [tenants.id] }),
  appointments_as_stylist: many(appointments),
  walk_ins_assigned: many(walk_ins),
}));

export const dressesRelations = relations(dresses, ({ many }) => ({
  inventory: many(dress_inventory),
  reservations: many(dress_reservations),
  vto_sessions: many(vto_sessions),
}));

export const appointmentsRelations = relations(appointments, ({ one }) => ({
  tenant: one(tenants, { fields: [appointments.tenant_id], references: [tenants.id] }),
  customer: one(customers, { fields: [appointments.customer_id], references: [customers.id] }),
  stylist: one(boutique_staff, { fields: [appointments.stylist_id], references: [boutique_staff.id] }),
  original_tenant: one(tenants, { fields: [appointments.original_tenant_id], references: [tenants.id] }),
}));

export const walkInsRelations = relations(walk_ins, ({ one }) => ({
  tenant: one(tenants, { fields: [walk_ins.tenant_id], references: [tenants.id] }),
  assigned_stylist: one(boutique_staff, { fields: [walk_ins.assigned_stylist_id], references: [boutique_staff.id] }),
}));

export const vtoSessionsRelations = relations(vto_sessions, ({ one }) => ({
  user: one(users, { fields: [vto_sessions.user_id], references: [users.id] }),
  tenant: one(tenants, { fields: [vto_sessions.tenant_id], references: [tenants.id] }),
  dress: one(dresses, { fields: [vto_sessions.dress_id], references: [dresses.id] }),
}));

export const clientStyleProfilesRelations = relations(client_style_profiles, ({ one }) => ({
  user: one(users, { fields: [client_style_profiles.user_id], references: [users.id] }),
}));

export const dressReservationsRelations = relations(dress_reservations, ({ one }) => ({
  customer: one(customers, { fields: [dress_reservations.customer_id], references: [customers.id] }),
  dress: one(dresses, { fields: [dress_reservations.dress_id], references: [dresses.id] }),
  tenant: one(tenants, { fields: [dress_reservations.tenant_id], references: [tenants.id] }),
}));
```

---

## [EXECUTION BLOCK 3: RLS Protocol & Database Client]

### 3.1 — `packages/database/drizzle.config.ts`
```typescript
import type { Config } from 'drizzle-kit';

if (!process.env.DATABASE_URL_DIRECT) {
  throw new Error('DATABASE_URL_DIRECT is required for Drizzle Kit. Check .env');
}

export default {
  schema: './src/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL_DIRECT,
  },
  verbose: true,
  strict: true,
} satisfies Config;
```

### 3.2 — `packages/database/src/client.ts`
```typescript
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is required. Check .env');
}

// Transaction-mode pooler connection (port 6543 for Supabase)
const poolClient = postgres(process.env.DATABASE_URL, {
  prepare: false, // Required for Supabase transaction-mode pooler
});

export const db = drizzle(poolClient, { schema, logger: process.env.NODE_ENV === 'development' });

export type Database = typeof db;

// ─── TENANT-SCOPED QUERY WRAPPER ─────────────────────────────────────────────

/**
 * `withTenant` — Executes a query within a Supabase RLS-aware transaction.
 *
 * ARCHITECTURE MANDATE: `set_config` with `true` (local=true) is MANDATORY.
 * The `true` flag scopes the config to the current transaction only,
 * preventing catastrophic cross-tenant data leakage in pooled environments.
 *
 * @param tenantId  - The tenant UUID for RLS filtering
 * @param userId    - The authenticated user UUID
 * @param role      - The staff role for RLS policy evaluation
 * @param queryFn   - The Drizzle query to execute within the tenant context
 */
export async function withTenant<T>(
  tenantId: string,
  userId: string,
  role: 'super_admin' | 'owner' | 'manager' | 'stylist' | 'receptionist' | 'customer',
  queryFn: (db: Database) => Promise<T>
): Promise<T> {
  return db.transaction(async (tx) => {
    // Set RLS context — `true` flag makes this transaction-local ONLY
    await tx.execute(
      `SELECT
        set_config('request.tenant_id', '${tenantId}', true),
        set_config('request.user_id', '${userId}', true),
        set_config('request.role', '${role}', true)`
    );
    return queryFn(tx as unknown as Database);
  });
}
```

### 3.3 — `packages/database/src/migrations/0001_rls_policies.sql`
```sql
-- Enable Row Level Security on sensitive tables
ALTER TABLE vto_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_style_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE dress_reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE walk_ins ENABLE ROW LEVEL SECURITY;
ALTER TABLE dress_inventory ENABLE ROW LEVEL SECURITY;

-- Helper functions
CREATE OR REPLACE FUNCTION current_tenant_id() RETURNS uuid AS $$
  SELECT current_setting('request.tenant_id', true)::uuid;
$$ LANGUAGE sql STABLE;

CREATE OR REPLACE FUNCTION current_user_id() RETURNS uuid AS $$
  SELECT current_setting('request.user_id', true)::uuid;
$$ LANGUAGE sql STABLE;

CREATE OR REPLACE FUNCTION current_user_role() RETURNS text AS $$
  SELECT current_setting('request.role', true);
$$ LANGUAGE sql STABLE;

-- vto_sessions: Owner sees own sessions; staff sees tenant sessions
CREATE POLICY "vto_sessions_user_isolation" ON vto_sessions
  FOR ALL USING (
    user_id = current_user_id()
    OR (tenant_id = current_tenant_id() AND current_user_role() IN ('super_admin', 'owner', 'manager', 'stylist'))
  );

-- client_style_profiles: Owner sees own profile; staff sees tenant customer profiles
CREATE POLICY "client_style_profiles_isolation" ON client_style_profiles
  FOR ALL USING (
    user_id = current_user_id()
    OR current_user_role() IN ('super_admin', 'owner', 'manager', 'stylist')
  );

-- appointments: Tenant-scoped; super_admin sees all
CREATE POLICY "appointments_tenant_isolation" ON appointments
  FOR ALL USING (
    current_user_role() = 'super_admin'
    OR tenant_id = current_tenant_id()
  );

-- walk_ins: Tenant-scoped
CREATE POLICY "walk_ins_tenant_isolation" ON walk_ins
  FOR ALL USING (
    current_user_role() = 'super_admin'
    OR tenant_id = current_tenant_id()
  );

-- dress_inventory: Tenant-scoped
CREATE POLICY "dress_inventory_tenant_isolation" ON dress_inventory
  FOR ALL USING (
    current_user_role() = 'super_admin'
    OR tenant_id = current_tenant_id()
  );

-- dress_reservations: Customer sees own; staff sees tenant's
CREATE POLICY "dress_reservations_isolation" ON dress_reservations
  FOR ALL USING (
    current_user_role() = 'super_admin'
    OR tenant_id = current_tenant_id()
    OR customer_id IN (
      SELECT id FROM customers WHERE user_id = current_user_id()
    )
  );
```

### 3.4 — `packages/database/src/index.ts`
```typescript
export { db, withTenant } from './client';
export type { Database } from './client';
export * from './schema';
export {
  staffRoleEnum,
  appointmentStatusEnum,
  walkInStatusEnum,
  dressOccasionEnum,
  vtoStatusEnum,
} from './schema';
```

---

## [EXECUTION BLOCK 4: Environment Files]

### 4.1 — `.env.example` at workspace root
Create from the full ENV_MANIFEST in PHASE_MANIFEST.md. Every variable from that manifest MUST be present.

### 4.2 — `.gitignore` at workspace root
```
.env
.env.local
.env.*.local
node_modules/
.turbo/
.next/
dist/
```

---

## [VALIDATION CHECKPOINT — PHASE 1]

Execute the following commands in order. Each MUST achieve Exit Code 0 before proceeding.

```bash
# Step 1: Install all workspace dependencies
pnpm install

# Step 2: Typecheck the database package
pnpm --filter @toptenprom/database typecheck

# Step 3: Lint the database package
pnpm --filter @toptenprom/database lint

# Step 4: Verify schema integrity (correct command for drizzle-kit)
pnpm --filter @toptenprom/database db:check
```

**Required Output:** Verbose terminal summary confirming:
- All tables exist in schema with correct column types
- All enums defined with correct values
- All relations mapped bidirectionally
- RLS migration SQL is syntactically valid
- `.env.example` contains every key from PHASE_MANIFEST.md ENV_MANIFEST

**Update PHASE_MANIFEST.md:** Mark Phase 1 as ✅ COMPLETE.

**STOP. Await human approval before executing Phase 2.**
