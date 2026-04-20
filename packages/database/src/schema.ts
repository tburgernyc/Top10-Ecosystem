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
    business_hours: jsonb('business_hours').$type<
      Record<string, { open: string; close: string; closed: boolean }>
    >(),
    is_active: boolean('is_active').notNull().default(true),
    max_daily_appointments: integer('max_daily_appointments').notNull().default(30),
    store_code: varchar('store_code', { length: 50 }),
    mobile_sync_secret: varchar('mobile_sync_secret', { length: 255 }),
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
    user_id: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
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
    user_id: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    tenant_id: uuid('tenant_id').references(() => tenants.id, { onDelete: 'set null' }),
    role: staffRoleEnum('role').notNull(),
    is_active: boolean('is_active').notNull().default(true),
    hire_date: timestamp('hire_date', { withTimezone: true }),
    specialties: jsonb('specialties').$type<string[]>(),
    ...timestamps,
  },
  (table) => ({
    userTenantIdx: uniqueIndex('boutique_staff_user_tenant_idx').on(
      table.user_id,
      table.tenant_id
    ),
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
    available_colors: jsonb('available_colors')
      .notNull()
      .$type<Array<{ name: string; hex: string; swatch_image_url: string }>>(),
    available_sizes: jsonb('available_sizes').notNull().$type<string[]>(),
    base_price: decimal('base_price', { precision: 10, scale: 2 }).notNull(),
    retail_price: decimal('retail_price', { precision: 10, scale: 2 }).notNull(),
    image_urls: jsonb('image_urls')
      .notNull()
      .$type<{ hero: string; gallery: string[]; on_model: string[] }>(),
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
    dress_id: uuid('dress_id')
      .notNull()
      .references(() => dresses.id, { onDelete: 'cascade' }),
    tenant_id: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
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
      table.dress_id,
      table.tenant_id,
      table.color_name,
      table.size
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
    tenant_id: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id), // MANDATORY
    customer_id: uuid('customer_id')
      .references(() => customers.id),
    stylist_id: uuid('stylist_id').references(() => boutique_staff.id, {
      onDelete: 'set null',
    }),
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
    tenantDateIdx: index('appointments_tenant_date_idx').on(
      table.tenant_id,
      table.appointment_date
    ),
    customerIdx: index('appointments_customer_idx').on(table.customer_id),
    stylistIdx: index('appointments_stylist_idx').on(table.stylist_id),
    statusIdx: index('appointments_status_idx').on(table.status),
    confirmationIdx: uniqueIndex('appointments_confirmation_idx').on(
      table.confirmation_code
    ),
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
    tenant_id: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id), // MANDATORY
    customer_name: varchar('customer_name', { length: 255 }).notNull(),
    phone_number: varchar('phone_number', { length: 30 }).notNull(),
    party_size: integer('party_size').notNull().default(1),
    occasion: dressOccasionEnum('occasion'),
    notes: text('notes'),
    status: walkInStatusEnum('status').notNull().default('waiting'),
    checked_in_at: timestamp('checked_in_at', { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    called_at: timestamp('called_at', { withTimezone: true }),
    completed_at: timestamp('completed_at', { withTimezone: true }),
    assigned_stylist_id: uuid('assigned_stylist_id').references(() => boutique_staff.id),
    queue_position: integer('queue_position').notNull(),
    estimated_wait_minutes: integer('estimated_wait_minutes'),
    ...timestamps,
  },
  (table) => ({
    tenantStatusIdx: index('walk_ins_tenant_status_idx').on(table.tenant_id, table.status),
    tenantDateIdx: index('walk_ins_tenant_date_idx').on(
      table.tenant_id,
      table.checked_in_at
    ),
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
    user_id: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    tenant_id: uuid('tenant_id').references(() => tenants.id),
    dress_id: uuid('dress_id')
      .notNull()
      .references(() => dresses.id),
    color_name: varchar('color_name', { length: 100 }).notNull(),
    // Fal.ai (flux-kontext-pro) pipeline fields
    fal_request_id: varchar('fal_request_id', { length: 255 }),
    realtime_channel_id: varchar('realtime_channel_id', { length: 255 }).notNull(),
    status: vtoStatusEnum('status').notNull().default('queued'),
    input_image_url: text('input_image_url').notNull(), // Signed Supabase Storage URL
    output_image_url: text('output_image_url'), // Signed Supabase Storage URL
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
    user_id: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    // AI-generated preference vectors
    preferred_designers: jsonb('preferred_designers')
      .$type<string[]>()
      .notNull()
      .default([]),
    preferred_colors: jsonb('preferred_colors')
      .$type<Array<{ name: string; hex: string }>>()
      .notNull()
      .default([]),
    preferred_silhouettes: jsonb('preferred_silhouettes')
      .$type<string[]>()
      .notNull()
      .default([]),
    preferred_occasions: jsonb('preferred_occasions')
      .$type<string[]>()
      .notNull()
      .default([]),
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
    customer_id: uuid('customer_id')
      .notNull()
      .references(() => customers.id, { onDelete: 'cascade' }),
    dress_id: uuid('dress_id')
      .notNull()
      .references(() => dresses.id),
    tenant_id: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id),
    color_name: varchar('color_name', { length: 100 }).notNull(),
    size: varchar('size', { length: 20 }).notNull(),
    reservation_status: varchar('reservation_status', { length: 50 })
      .notNull()
      .default('active'),
    reserved_at: timestamp('reserved_at', { withTimezone: true })
      .notNull()
      .default(sql`now()`),
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
      table.dress_id,
      table.tenant_id,
      table.color_name,
      table.size,
      table.reservation_status
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
  staff_record: one(boutique_staff, {
    fields: [users.id],
    references: [boutique_staff.user_id],
  }),
  style_profile: one(client_style_profiles, {
    fields: [users.id],
    references: [client_style_profiles.user_id],
  }),
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
  tenant: one(tenants, {
    fields: [appointments.tenant_id],
    references: [tenants.id],
    relationName: 'appointments_tenant',
  }),
  customer: one(customers, {
    fields: [appointments.customer_id],
    references: [customers.id],
  }),
  stylist: one(boutique_staff, {
    fields: [appointments.stylist_id],
    references: [boutique_staff.id],
  }),
  original_tenant: one(tenants, {
    fields: [appointments.original_tenant_id],
    references: [tenants.id],
    relationName: 'appointments_original_tenant',
  }),
}));

export const walkInsRelations = relations(walk_ins, ({ one }) => ({
  tenant: one(tenants, { fields: [walk_ins.tenant_id], references: [tenants.id] }),
  assigned_stylist: one(boutique_staff, {
    fields: [walk_ins.assigned_stylist_id],
    references: [boutique_staff.id],
  }),
}));

export const vtoSessionsRelations = relations(vto_sessions, ({ one }) => ({
  user: one(users, { fields: [vto_sessions.user_id], references: [users.id] }),
  tenant: one(tenants, { fields: [vto_sessions.tenant_id], references: [tenants.id] }),
  dress: one(dresses, { fields: [vto_sessions.dress_id], references: [dresses.id] }),
}));

export const clientStyleProfilesRelations = relations(client_style_profiles, ({ one }) => ({
  user: one(users, {
    fields: [client_style_profiles.user_id],
    references: [users.id],
  }),
}));

export const dressReservationsRelations = relations(dress_reservations, ({ one }) => ({
  customer: one(customers, {
    fields: [dress_reservations.customer_id],
    references: [customers.id],
  }),
  dress: one(dresses, {
    fields: [dress_reservations.dress_id],
    references: [dresses.id],
  }),
  tenant: one(tenants, {
    fields: [dress_reservations.tenant_id],
    references: [tenants.id],
  }),
}));

// ─── PHASE 9: SOCIAL & BRIDAL PARTY SCHEMA ───────────────────────────────────

export const bridalPartyRoleEnum = pgEnum('bridal_party_role', [
  'lead',
  'bridesmaid',
  'groomsman',
  'flower_girl',
  'guest',
]);

export const voteTypeEnum = pgEnum('vote_type', [
  'love',
  'like',
  'maybe',
  'pass',
]);

/**
 * `bridal_parties`
 * A coordinated group of customers shopping together (prom group or wedding party).
 */
export const bridal_parties = pgTable(
  'bridal_parties',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenant_id: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    lead_customer_id: uuid('lead_customer_id')
      .notNull()
      .references(() => customers.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 120 }).notNull(),
    occasion: text('occasion').notNull(),
    event_date: timestamp('event_date', { withTimezone: true }),
    school_name: varchar('school_name', { length: 200 }),
    invite_code: varchar('invite_code', { length: 32 }).notNull().unique(),
    is_active: boolean('is_active').notNull().default(true),
    max_members: integer('max_members').notNull().default(12),
    notes: text('notes'),
    ...timestamps,
  },
  (t) => ({
    tenant_idx: index('bridal_parties_tenant_idx').on(t.tenant_id),
    lead_customer_idx: index('bridal_parties_lead_customer_idx').on(t.lead_customer_id),
    invite_code_unique: uniqueIndex('bridal_parties_invite_code_unique').on(t.invite_code),
  })
);

/**
 * `bridal_party_members`
 * Junction table linking customers to a bridal party with their role.
 */
export const bridal_party_members = pgTable(
  'bridal_party_members',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    party_id: uuid('party_id')
      .notNull()
      .references(() => bridal_parties.id, { onDelete: 'cascade' }),
    customer_id: uuid('customer_id')
      .notNull()
      .references(() => customers.id, { onDelete: 'cascade' }),
    role: bridalPartyRoleEnum('role').notNull().default('bridesmaid'),
    is_confirmed: boolean('is_confirmed').notNull().default(false),
    shortlisted_dress_ids: jsonb('shortlisted_dress_ids').$type<string[]>().default([]),
    joined_at: timestamp('joined_at', { withTimezone: true }).default(sql`now()`),
    ...timestamps,
  },
  (t) => ({
    party_customer_unique: uniqueIndex('bridal_party_members_party_customer_unique').on(
      t.party_id,
      t.customer_id
    ),
    party_idx: index('bridal_party_members_party_idx').on(t.party_id),
    customer_idx: index('bridal_party_members_customer_idx').on(t.customer_id),
  })
);

/**
 * `dress_vote_sessions`
 * A shareable voting session where friends vote on a customer's shortlisted dresses.
 * The `share_token` is a cryptographically random 64-char hex string.
 */
export const dress_vote_sessions = pgTable(
  'dress_vote_sessions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    customer_id: uuid('customer_id')
      .notNull()
      .references(() => customers.id, { onDelete: 'cascade' }),
    tenant_id: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    share_token: varchar('share_token', { length: 64 }).notNull().unique(),
    title: varchar('title', { length: 120 }),
    dress_ids: jsonb('dress_ids').$type<string[]>().notNull().default([]),
    is_active: boolean('is_active').notNull().default(true),
    expires_at: timestamp('expires_at', { withTimezone: true }).notNull(),
    vote_count: integer('vote_count').notNull().default(0),
    ...timestamps,
  },
  (t) => ({
    customer_idx: index('dress_vote_sessions_customer_idx').on(t.customer_id),
    share_token_unique: uniqueIndex('dress_vote_sessions_share_token_unique').on(t.share_token),
  })
);

/**
 * `dress_votes`
 * An individual vote cast by a friend (fingerprinted, no auth required).
 */
export const dress_votes = pgTable(
  'dress_votes',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    session_id: uuid('session_id')
      .notNull()
      .references(() => dress_vote_sessions.id, { onDelete: 'cascade' }),
    dress_id: uuid('dress_id')
      .notNull()
      .references(() => dresses.id, { onDelete: 'cascade' }),
    vote_type: voteTypeEnum('vote_type').notNull(),
    voter_fingerprint: varchar('voter_fingerprint', { length: 64 }).notNull(),
    voter_display_name: varchar('voter_display_name', { length: 60 }),
    comment: text('comment'),
    ...timestamps,
  },
  (t) => ({
    session_dress_voter_unique: uniqueIndex('dress_votes_session_dress_voter_unique').on(
      t.session_id,
      t.dress_id,
      t.voter_fingerprint
    ),
    session_idx: index('dress_votes_session_idx').on(t.session_id),
    dress_idx: index('dress_votes_dress_idx').on(t.dress_id),
  })
);

// ─── PHASE 9 RELATIONS ───────────────────────────────────────────────────────

export const bridalPartiesRelations = relations(bridal_parties, ({ one, many }) => ({
  tenant: one(tenants, { fields: [bridal_parties.tenant_id], references: [tenants.id] }),
  lead_customer: one(customers, { fields: [bridal_parties.lead_customer_id], references: [customers.id] }),
  members: many(bridal_party_members),
}));

export const bridalPartyMembersRelations = relations(bridal_party_members, ({ one }) => ({
  party: one(bridal_parties, { fields: [bridal_party_members.party_id], references: [bridal_parties.id] }),
  customer: one(customers, { fields: [bridal_party_members.customer_id], references: [customers.id] }),
}));

export const dressVoteSessionsRelations = relations(dress_vote_sessions, ({ one, many }) => ({
  customer: one(customers, { fields: [dress_vote_sessions.customer_id], references: [customers.id] }),
  tenant: one(tenants, { fields: [dress_vote_sessions.tenant_id], references: [tenants.id] }),
  votes: many(dress_votes),
}));

export const dressVotesRelations = relations(dress_votes, ({ one }) => ({
  session: one(dress_vote_sessions, { fields: [dress_votes.session_id], references: [dress_vote_sessions.id] }),
  dress: one(dresses, { fields: [dress_votes.dress_id], references: [dresses.id] }),
}));

// ─── PHASE 10: GUARDIAN PORTAL & NOTIFICATION SCHEMA ─────────────────────────

export const notificationChannelEnum = pgEnum('notification_channel', [
  'email',
  'sms',
  'both',
]);

export const notificationStatusEnum = pgEnum('notification_status', [
  'queued',
  'sent',
  'delivered',
  'failed',
  'bounced',
]);

export const notificationTypeEnum = pgEnum('notification_type', [
  'appointment_confirmation',
  'appointment_reminder',
  'appointment_cancelled',
  'appointment_rescheduled',
  'reservation_created',
  'reservation_confirmed',
  'reservation_expired',
  'walk_in_called',
  'guardian_portal_invite',
  'payment_receipt',
]);

export const guardian_profiles = pgTable(
  'guardian_profiles',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    customer_id: uuid('customer_id')
      .notNull()
      .references(() => customers.id, { onDelete: 'cascade' }),
    first_name: varchar('first_name', { length: 80 }).notNull(),
    last_name: varchar('last_name', { length: 80 }).notNull(),
    relationship: varchar('relationship', { length: 60 }).notNull(),
    email: varchar('email', { length: 320 }),
    phone: varchar('phone', { length: 30 }),
    preferred_channel: notificationChannelEnum('preferred_channel').notNull().default('both'),
    is_primary: boolean('is_primary').notNull().default(false),
    is_consent_given: boolean('is_consent_given').notNull().default(false),
    consent_given_at: timestamp('consent_given_at', { withTimezone: true }),
    ...timestamps,
  },
  (t) => ({
    customer_idx: index('guardian_profiles_customer_idx').on(t.customer_id),
  })
);

export const guardian_portal_tokens = pgTable(
  'guardian_portal_tokens',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    guardian_profile_id: uuid('guardian_profile_id')
      .notNull()
      .references(() => guardian_profiles.id, { onDelete: 'cascade' }),
    customer_id: uuid('customer_id')
      .notNull()
      .references(() => customers.id, { onDelete: 'cascade' }),
    token_hash: varchar('token_hash', { length: 255 }).notNull(),
    expires_at: timestamp('expires_at', { withTimezone: true }).notNull(),
    used_at: timestamp('used_at', { withTimezone: true }),
    is_revoked: boolean('is_revoked').notNull().default(false),
    ...timestamps,
  },
  (t) => ({
    guardian_idx: index('guardian_portal_tokens_guardian_idx').on(t.guardian_profile_id),
    customer_idx: index('guardian_portal_tokens_customer_idx').on(t.customer_id),
  })
);

export const guardian_notifications = pgTable(
  'guardian_notifications',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    guardian_profile_id: uuid('guardian_profile_id')
      .notNull()
      .references(() => guardian_profiles.id, { onDelete: 'cascade' }),
    customer_id: uuid('customer_id')
      .notNull()
      .references(() => customers.id, { onDelete: 'cascade' }),
    tenant_id: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    notification_type: notificationTypeEnum('notification_type').notNull(),
    channel: notificationChannelEnum('channel').notNull(),
    status: notificationStatusEnum('status').notNull().default('queued'),
    subject: varchar('subject', { length: 255 }),
    body_preview: text('body_preview'),
    provider_message_id: varchar('provider_message_id', { length: 255 }),
    delivered_at: timestamp('delivered_at', { withTimezone: true }),
    failed_reason: text('failed_reason'),
    retry_count: integer('retry_count').notNull().default(0),
    reference_id: uuid('reference_id'),
    reference_type: varchar('reference_type', { length: 60 }),
    ...timestamps,
  },
  (t) => ({
    guardian_idx: index('guardian_notifications_guardian_idx').on(t.guardian_profile_id),
    customer_idx: index('guardian_notifications_customer_idx').on(t.customer_id),
    tenant_idx: index('guardian_notifications_tenant_idx').on(t.tenant_id),
    status_idx: index('guardian_notifications_status_idx').on(t.status),
    type_idx: index('guardian_notifications_type_idx').on(t.notification_type),
  })
);

// ─── PHASE 10 RELATIONS ──────────────────────────────────────────────────────

export const guardianProfilesRelations = relations(guardian_profiles, ({ one, many }) => ({
  customer: one(customers, { fields: [guardian_profiles.customer_id], references: [customers.id] }),
  portal_tokens: many(guardian_portal_tokens),
  notifications: many(guardian_notifications),
}));

export const guardianPortalTokensRelations = relations(guardian_portal_tokens, ({ one }) => ({
  guardian: one(guardian_profiles, { fields: [guardian_portal_tokens.guardian_profile_id], references: [guardian_profiles.id] }),
  customer: one(customers, { fields: [guardian_portal_tokens.customer_id], references: [customers.id] }),
}));

export const guardianNotificationsRelations = relations(guardian_notifications, ({ one }) => ({
  guardian: one(guardian_profiles, { fields: [guardian_notifications.guardian_profile_id], references: [guardian_profiles.id] }),
  customer: one(customers, { fields: [guardian_notifications.customer_id], references: [customers.id] }),
  tenant: one(tenants, { fields: [guardian_notifications.tenant_id], references: [tenants.id] }),
}));
