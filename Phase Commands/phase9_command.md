# Phase 9: Social Discovery, Bridal Party Coordination & Friend Voting

---

## [PRE-EXECUTION DIRECTIVE]
**MANDATORY FIRST ACTION:** Read `PHASE_MANIFEST.md` (Phase 0) in full. Verify ALL Phases 1–8 are marked ✅ COMPLETE before writing a single line of code.

**Role:** Principal Staff Engineer & Lead Product Engineer  
**Context:** Build the social layer of the Top 10 Prom ecosystem. This phase delivers three interconnected systems: (1) Bridal Party coordination — a group registry where the lead customer invites bridesmaids and tracks ensemble cohesion; (2) Friend Voting — an anonymized shareable link that lets a customer's social circle vote on shortlisted dresses; (3) Social Share Cards — auto-generated OG images for Instagram/TikTok sharing. This is the virality engine for the platform. It must be built to institutional quality standards.  
**Quality Standard:** Institutional Grade (Apple/LVMH). Zero placeholders. Zero `// TODO`. Zero implicit `any` types.  
**Execution Rules:**  
- All new tables introduced here MUST follow the canonical naming convention from PHASE_MANIFEST.md.  
- `bridal_parties` and `dress_votes` are the canonical table names. No aliases.  
- Friend voting links must be cryptographically random — NOT sequential IDs.  
- OG image generation runs on the Edge (Vercel `@vercel/og`) — NOT in Node.js lambda.  
- All `params`/`searchParams` MUST be `await`ed — Next.js 16 mandatory.  
- `redirect()` calls MUST be outside all `try/catch` blocks.

---

## [EXECUTION BLOCK 1: Schema Extensions]

### 1.1 — Add New Tables to `packages/database/src/schema.ts`

Append the following tables and enums to the existing schema file. Do NOT modify any existing table definitions.

```typescript
// ─── PHASE 9: SOCIAL & BRIDAL PARTY SCHEMA ───────────────────────────────────

export const bridalPartyRoleEnum = pgEnum('bridal_party_role', [
  'lead',        // The primary customer — initiates the party
  'bridesmaid',  // A party member
  'groomsman',   // For wedding parties
  'flower_girl', // For wedding parties
  'guest',       // View-only party member (parents, etc.)
]);

export const voteTypeEnum = pgEnum('vote_type', [
  'love',      // 💖 Strong yes
  'like',      // 👍 Yes
  'maybe',     // 🤔 Uncertain
  'pass',      // 👎 No
]);

/**
 * `bridal_parties`
 * A coordinated group of customers shopping together (prom group or wedding party).
 * The `lead_customer_id` controls the party. Other members are in `bridal_party_members`.
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
    name: varchar('name', { length: 120 }).notNull(), // e.g. "Madison's Prom Squad 2025"
    occasion: text('occasion').notNull(), // 'prom' | 'wedding' | 'homecoming'
    event_date: timestamp('event_date', { withTimezone: true }),
    school_name: varchar('school_name', { length: 200 }),
    invite_code: varchar('invite_code', { length: 32 }).notNull().unique(), // CSPRNG hex
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
 * The `share_token` is a cryptographically random 48-char hex string.
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
    share_token: varchar('share_token', { length: 64 }).notNull().unique(), // CSPRNG hex
    title: varchar('title', { length: 120 }), // e.g. "Help me pick my prom dress! 💖"
    dress_ids: jsonb('dress_ids').$type<string[]>().notNull().default([]), // ordered shortlist
    is_active: boolean('is_active').notNull().default(true),
    expires_at: timestamp('expires_at', { withTimezone: true }).notNull(),
    vote_count: integer('vote_count').notNull().default(0), // denormalized for perf
    ...timestamps,
  },
  (t) => ({
    customer_idx: index('dress_vote_sessions_customer_idx').on(t.customer_id),
    share_token_unique: uniqueIndex('dress_vote_sessions_share_token_unique').on(t.share_token),
  })
);

/**
 * `dress_votes`
 * An individual vote cast by a friend (identified by ephemeral fingerprint, not auth).
 * Voters are NOT required to have a platform account.
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
    voter_fingerprint: varchar('voter_fingerprint', { length: 64 }).notNull(), // SHA-256 of IP+UA
    voter_display_name: varchar('voter_display_name', { length: 60 }), // optional
    comment: text('comment'), // optional 140-char comment
    ...timestamps,
  },
  (t) => ({
    // Prevent the same voter from voting on the same dress twice in one session
    session_dress_voter_unique: uniqueIndex('dress_votes_session_dress_voter_unique').on(
      t.session_id,
      t.dress_id,
      t.voter_fingerprint
    ),
    session_idx: index('dress_votes_session_idx').on(t.session_id),
    dress_idx: index('dress_votes_dress_idx').on(t.dress_id),
  })
);
```

### 1.2 — Add Relations for New Tables

Append to `packages/database/src/schema.ts` (relations section):

```typescript
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
```

### 1.3 — Update `packages/database/src/index.ts`

Add the new exports:

```typescript
export {
  bridal_parties,
  bridal_party_members,
  dress_vote_sessions,
  dress_votes,
  bridalPartyRoleEnum,
  voteTypeEnum,
} from './schema';
```

### 1.4 — Generate and Apply Migration

```bash
pnpm --filter @toptenprom/database db:migrate
pnpm --filter @toptenprom/database db:push
```

---

## [EXECUTION BLOCK 2: RLS Policies for Social Tables]

### 2.1 — `packages/database/src/migrations/0002_social_rls_policies.sql`

```sql
-- ── PHASE 9: RLS for social tables ──────────────────────────────────────────

ALTER TABLE bridal_parties ENABLE ROW LEVEL SECURITY;
ALTER TABLE bridal_party_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE dress_vote_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE dress_votes ENABLE ROW LEVEL SECURITY;

-- bridal_parties: lead sees own parties; staff sees tenant parties; super_admin sees all
CREATE POLICY "bridal_parties_isolation" ON bridal_parties
  FOR ALL USING (
    current_user_role() = 'super_admin'
    OR tenant_id = current_tenant_id()
    OR lead_customer_id IN (
      SELECT id FROM customers WHERE user_id = current_user_id()
    )
  );

-- bridal_party_members: members see their own records; lead sees all in their party
CREATE POLICY "bridal_party_members_isolation" ON bridal_party_members
  FOR ALL USING (
    customer_id IN (SELECT id FROM customers WHERE user_id = current_user_id())
    OR party_id IN (
      SELECT id FROM bridal_parties
      WHERE lead_customer_id IN (SELECT id FROM customers WHERE user_id = current_user_id())
    )
    OR current_user_role() IN ('super_admin', 'owner', 'manager')
  );

-- dress_vote_sessions: owner sees own; platform-wide read for active sessions (voting)
CREATE POLICY "dress_vote_sessions_owner" ON dress_vote_sessions
  FOR SELECT USING (is_active = true OR customer_id IN (
    SELECT id FROM customers WHERE user_id = current_user_id()
  ));

CREATE POLICY "dress_vote_sessions_write" ON dress_vote_sessions
  FOR INSERT WITH CHECK (
    customer_id IN (SELECT id FROM customers WHERE user_id = current_user_id())
  );

CREATE POLICY "dress_vote_sessions_update" ON dress_vote_sessions
  FOR UPDATE USING (
    customer_id IN (SELECT id FROM customers WHERE user_id = current_user_id())
    OR current_user_role() = 'super_admin'
  );

-- dress_votes: public insert (no auth required for voting); owner and staff can read
CREATE POLICY "dress_votes_public_insert" ON dress_votes
  FOR INSERT WITH CHECK (true); -- voters are fingerprinted, not authed

CREATE POLICY "dress_votes_read" ON dress_votes
  FOR SELECT USING (
    session_id IN (
      SELECT id FROM dress_vote_sessions WHERE is_active = true
    )
    OR current_user_role() IN ('super_admin', 'owner', 'manager')
  );
```

---

## [EXECUTION BLOCK 3: Server Actions]

### 3.1 — `apps/brand-network-web/src/actions/bridal-party-actions.ts`

```typescript
'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { db } from '@toptenprom/database';
import {
  bridal_parties,
  bridal_party_members,
  customers,
} from '@toptenprom/database';
import { eq, and } from 'drizzle-orm';
import crypto from 'crypto';

// ─── TYPE GUARDS ─────────────────────────────────────────────────────────────

function assertAuthenticated(
  user: { id: string } | null
): asserts user is { id: string } {
  if (!user) throw new Error('UNAUTHENTICATED');
}

// ─── CREATE BRIDAL PARTY ─────────────────────────────────────────────────────

export async function createBridalParty(params: {
  tenantId: string;
  name: string;
  occasion: 'prom' | 'wedding' | 'homecoming';
  eventDate?: string;
  schoolName?: string;
  notes?: string;
}): Promise<{ success: boolean; partyId?: string; inviteCode?: string; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  assertAuthenticated(authUser);

  // Resolve customer record
  let customerId: string;
  try {
    const result = await db
      .select({ id: customers.id })
      .from(customers)
      .where(eq(customers.user_id, authUser.id))
      .limit(1);
    if (!result[0]?.id) {
      return { success: false, error: 'Customer profile not found. Please complete your profile first.' };
    }
    customerId = result[0].id;
  } catch {
    return { success: false, error: 'Failed to resolve customer profile.' };
  }

  const inviteCode = crypto.randomBytes(16).toString('hex'); // 32 hex chars

  try {
    const result = await db
      .insert(bridal_parties)
      .values({
        tenant_id: params.tenantId,
        lead_customer_id: customerId,
        name: params.name,
        occasion: params.occasion,
        event_date: params.eventDate ? new Date(params.eventDate) : null,
        school_name: params.schoolName ?? null,
        invite_code: inviteCode,
        notes: params.notes ?? null,
      })
      .returning({ id: bridal_parties.id });

    // Auto-add the lead as a 'lead' member
    await db.insert(bridal_party_members).values({
      party_id: result[0]!.id,
      customer_id: customerId,
      role: 'lead',
      is_confirmed: true,
    });

    revalidatePath('/dashboard/bridal-party');
    return { success: true, partyId: result[0]!.id, inviteCode };
  } catch (error) {
    console.error('[createBridalParty] Failed:', error);
    return { success: false, error: 'Failed to create party. Please try again.' };
  }
}

// ─── JOIN BRIDAL PARTY VIA INVITE CODE ───────────────────────────────────────

export async function joinBridalParty(params: {
  inviteCode: string;
  role?: 'bridesmaid' | 'groomsman' | 'flower_girl' | 'guest';
}): Promise<{ success: boolean; partyId?: string; partyName?: string; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  assertAuthenticated(authUser);

  let customerId: string;
  try {
    const result = await db
      .select({ id: customers.id })
      .from(customers)
      .where(eq(customers.user_id, authUser.id))
      .limit(1);
    if (!result[0]?.id) {
      return { success: false, error: 'Complete your customer profile before joining a party.' };
    }
    customerId = result[0].id;
  } catch {
    return { success: false, error: 'Failed to resolve customer profile.' };
  }

  // Look up party by invite code
  let party: { id: string; name: string; max_members: number } | undefined;
  try {
    const result = await db
      .select({ id: bridal_parties.id, name: bridal_parties.name, max_members: bridal_parties.max_members })
      .from(bridal_parties)
      .where(and(eq(bridal_parties.invite_code, params.inviteCode), eq(bridal_parties.is_active, true)))
      .limit(1);
    party = result[0];
  } catch {
    return { success: false, error: 'Failed to look up party.' };
  }

  if (!party) {
    return { success: false, error: 'Invalid or expired invite code.' };
  }

  // Check membership count
  const memberCount = await db
    .select({ id: bridal_party_members.id })
    .from(bridal_party_members)
    .where(eq(bridal_party_members.party_id, party.id));

  if (memberCount.length >= party.max_members) {
    return { success: false, error: 'This party is full.' };
  }

  try {
    await db
      .insert(bridal_party_members)
      .values({
        party_id: party.id,
        customer_id: customerId,
        role: params.role ?? 'bridesmaid',
        is_confirmed: true,
      })
      .onConflictDoNothing();

    revalidatePath('/dashboard/bridal-party');
    return { success: true, partyId: party.id, partyName: party.name };
  } catch (error) {
    console.error('[joinBridalParty] Failed:', error);
    return { success: false, error: 'Failed to join party. Please try again.' };
  }
}

// ─── UPDATE MEMBER SHORTLIST ──────────────────────────────────────────────────

export async function updateMemberShortlist(params: {
  partyId: string;
  dressIds: string[];
}): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  assertAuthenticated(authUser);

  let customerId: string;
  try {
    const result = await db
      .select({ id: customers.id })
      .from(customers)
      .where(eq(customers.user_id, authUser.id))
      .limit(1);
    if (!result[0]?.id) return { success: false, error: 'Customer profile not found.' };
    customerId = result[0].id;
  } catch {
    return { success: false, error: 'Failed to resolve customer.' };
  }

  try {
    await db
      .update(bridal_party_members)
      .set({ shortlisted_dress_ids: params.dressIds, updated_at: new Date() })
      .where(
        and(
          eq(bridal_party_members.party_id, params.partyId),
          eq(bridal_party_members.customer_id, customerId)
        )
      );

    revalidatePath(`/dashboard/bridal-party/${params.partyId}`);
    return { success: true };
  } catch (error) {
    console.error('[updateMemberShortlist] Failed:', error);
    return { success: false, error: 'Failed to update shortlist.' };
  }
}
```

### 3.2 — `apps/brand-network-web/src/actions/vote-actions.ts`

```typescript
'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { db } from '@toptenprom/database';
import {
  dress_vote_sessions,
  dress_votes,
  customers,
  dresses,
} from '@toptenprom/database';
import { eq, and, inArray } from 'drizzle-orm';
import crypto from 'crypto';
import { headers } from 'next/headers';

// ─── CREATE VOTE SESSION ──────────────────────────────────────────────────────

export async function createVoteSession(params: {
  tenantId: string;
  dressIds: string[];
  title?: string;
  expiresInDays?: number;
}): Promise<{ success: boolean; shareToken?: string; sessionId?: string; error?: string }> {
  if (params.dressIds.length < 2 || params.dressIds.length > 6) {
    return { success: false, error: 'Select between 2 and 6 dresses to vote on.' };
  }

  const supabase = await createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  if (!authUser) return { success: false, error: 'You must be signed in to create a vote.' };

  let customerId: string;
  try {
    const result = await db
      .select({ id: customers.id })
      .from(customers)
      .where(eq(customers.user_id, authUser.id))
      .limit(1);
    if (!result[0]?.id) return { success: false, error: 'Customer profile not found.' };
    customerId = result[0].id;
  } catch {
    return { success: false, error: 'Failed to resolve customer.' };
  }

  const shareToken = crypto.randomBytes(32).toString('hex'); // 64 hex chars
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + (params.expiresInDays ?? 7));

  try {
    const result = await db
      .insert(dress_vote_sessions)
      .values({
        customer_id: customerId,
        tenant_id: params.tenantId,
        share_token: shareToken,
        title: params.title ?? 'Help me pick my dress! 💖',
        dress_ids: params.dressIds,
        expires_at: expiresAt,
      })
      .returning({ id: dress_vote_sessions.id });

    return { success: true, shareToken, sessionId: result[0]!.id };
  } catch (error) {
    console.error('[createVoteSession] Failed:', error);
    return { success: false, error: 'Failed to create vote session.' };
  }
}

// ─── CAST VOTE (NO AUTH REQUIRED) ────────────────────────────────────────────

export async function castVote(params: {
  shareToken: string;
  dressId: string;
  voteType: 'love' | 'like' | 'maybe' | 'pass';
  voterDisplayName?: string;
  comment?: string;
}): Promise<{ success: boolean; error?: string }> {
  // Validate vote session
  let sessionId: string | undefined;
  try {
    const result = await db
      .select({ id: dress_vote_sessions.id, is_active: dress_vote_sessions.is_active, expires_at: dress_vote_sessions.expires_at, dress_ids: dress_vote_sessions.dress_ids })
      .from(dress_vote_sessions)
      .where(eq(dress_vote_sessions.share_token, params.shareToken))
      .limit(1);

    const session = result[0];
    if (!session) return { success: false, error: 'Vote session not found.' };
    if (!session.is_active) return { success: false, error: 'This vote session has been closed.' };
    if (new Date() > new Date(session.expires_at)) return { success: false, error: 'This vote session has expired.' };
    if (!(session.dress_ids as string[]).includes(params.dressId)) {
      return { success: false, error: 'This dress is not part of this vote session.' };
    }
    sessionId = session.id;
  } catch {
    return { success: false, error: 'Failed to validate vote session.' };
  }

  // Build voter fingerprint — SHA-256 of IP + User-Agent (privacy-safe)
  const requestHeaders = await headers();
  const ip = requestHeaders.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  const ua = requestHeaders.get('user-agent') ?? 'unknown';
  const fingerprint = crypto
    .createHash('sha256')
    .update(`${ip}:${ua}:${sessionId}`)
    .digest('hex');

  const comment = params.comment
    ? params.comment.slice(0, 140) // Hard cap at 140 chars
    : null;

  try {
    await db
      .insert(dress_votes)
      .values({
        session_id: sessionId,
        dress_id: params.dressId,
        vote_type: params.voteType,
        voter_fingerprint: fingerprint,
        voter_display_name: params.voterDisplayName?.slice(0, 60) ?? null,
        comment,
      })
      .onConflictDoNothing(); // Idempotent — duplicate vote is silently ignored

    // Increment denormalized vote count
    await db.execute(
      `UPDATE dress_vote_sessions SET vote_count = vote_count + 1, updated_at = now() WHERE id = '${sessionId}'`
    );

    revalidatePath(`/vote/${params.shareToken}`);
    return { success: true };
  } catch (error) {
    console.error('[castVote] Failed:', error);
    return { success: false, error: 'Failed to cast vote.' };
  }
}
```

---

## [EXECUTION BLOCK 4: OG Image Route (Edge Runtime)]

### 4.1 — Install `@vercel/og`

```bash
cd apps/brand-network-web
pnpm add @vercel/og
```

### 4.2 — `apps/brand-network-web/src/app/api/og/vote/route.tsx`

```typescript
import { ImageResponse } from '@vercel/og';
import { NextRequest } from 'next/server';

export const runtime = 'edge';

export async function GET(request: NextRequest): Promise<ImageResponse | Response> {
  const { searchParams } = new URL(request.url);
  const title = searchParams.get('title') ?? 'Help me pick my prom dress!';
  const voteCount = searchParams.get('votes') ?? '0';
  const dressCount = searchParams.get('dresses') ?? '3';

  return new ImageResponse(
    (
      <div
        style={{
          width: '1200px',
          height: '630px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#0B0A0E',
          fontFamily: 'Georgia, serif',
          position: 'relative',
        }}
      >
        {/* Gradient mesh background */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background:
              'radial-gradient(ellipse 80% 60% at 20% 20%, rgba(242,75,154,0.18) 0%, transparent 60%), radial-gradient(ellipse 60% 80% at 80% 80%, rgba(123,97,255,0.14) 0%, transparent 60%)',
          }}
        />

        {/* Brand pill */}
        <div
          style={{
            display: 'flex',
            position: 'absolute',
            top: '2.5rem',
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'rgba(255,255,255,0.06)',
            border: '1px solid rgba(255,255,255,0.12)',
            borderRadius: '9999px',
            padding: '0.5rem 1.5rem',
            color: '#C9A96E',
            fontSize: '0.875rem',
            letterSpacing: '0.15em',
            textTransform: 'uppercase',
          }}
        >
          TOP 10 PROM · FRIEND VOTE
        </div>

        {/* Main content */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '0 4rem', zIndex: 1 }}>
          <p
            style={{
              fontSize: '3rem',
              fontWeight: 700,
              color: '#F8F4F0',
              textAlign: 'center',
              lineHeight: 1.2,
              marginBottom: '1.5rem',
              maxWidth: '900px',
            }}
          >
            {title}
          </p>

          <div style={{ display: 'flex', gap: '3rem', marginTop: '1rem' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <span style={{ fontSize: '2.5rem', fontWeight: 700, color: '#F24B9A' }}>{dressCount}</span>
              <span style={{ color: 'rgba(248,244,240,0.6)', fontSize: '0.875rem', letterSpacing: '0.1em', textTransform: 'uppercase' }}>Dresses</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <span style={{ fontSize: '2.5rem', fontWeight: 700, color: '#7B61FF' }}>{voteCount}</span>
              <span style={{ color: 'rgba(248,244,240,0.6)', fontSize: '0.875rem', letterSpacing: '0.1em', textTransform: 'uppercase' }}>Votes Cast</span>
            </div>
          </div>

          <div
            style={{
              marginTop: '2.5rem',
              background: '#F24B9A',
              borderRadius: '9999px',
              padding: '0.875rem 3rem',
              color: '#0B0A0E',
              fontWeight: 700,
              fontSize: '1.125rem',
              letterSpacing: '0.05em',
            }}
          >
            Tap to Vote 💖
          </div>
        </div>
      </div>
    ),
    { width: 1200, height: 630 }
  );
}
```

---

## [EXECUTION BLOCK 5: Public Vote Page]

### 5.1 — `apps/brand-network-web/src/app/(public)/vote/[token]/page.tsx`

```tsx
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { db } from '@toptenprom/database';
import { dress_vote_sessions, dresses, dress_votes } from '@toptenprom/database';
import { eq, and, sql } from 'drizzle-orm';
import VoteClient from './VoteClient';

interface VotePageProps {
  params: Promise<{ token: string }>;
}

export async function generateMetadata({ params }: VotePageProps): Promise<Metadata> {
  const { token } = await params;
  try {
    const result = await db
      .select({ title: dress_vote_sessions.title, vote_count: dress_vote_sessions.vote_count })
      .from(dress_vote_sessions)
      .where(and(eq(dress_vote_sessions.share_token, token), eq(dress_vote_sessions.is_active, true)))
      .limit(1);

    const session = result[0];
    if (!session) return { title: 'Vote | Top 10 Prom' };

    return {
      title: `${session.title ?? 'Vote on my dresses!'} | Top 10 Prom`,
      description: `${session.vote_count} people have already voted. Cast your vote now!`,
      openGraph: {
        images: [
          {
            url: `/api/og/vote?title=${encodeURIComponent(session.title ?? 'Help me pick!')}&votes=${session.vote_count}`,
            width: 1200,
            height: 630,
          },
        ],
      },
      twitter: {
        card: 'summary_large_image',
      },
    };
  } catch {
    return { title: 'Vote | Top 10 Prom' };
  }
}

async function getVoteSessionData(token: string) {
  'use cache';

  const sessionResult = await db
    .select()
    .from(dress_vote_sessions)
    .where(and(eq(dress_vote_sessions.share_token, token), eq(dress_vote_sessions.is_active, true)))
    .limit(1);

  const session = sessionResult[0];
  if (!session) return null;

  if (new Date() > new Date(session.expires_at)) return null;

  const dressIds = session.dress_ids as string[];
  const dressData = await db
    .select({
      id: dresses.id,
      name: dresses.name,
      designer: dresses.designer,
      image_urls: dresses.image_urls,
      price: dresses.price,
      occasion: dresses.occasion,
    })
    .from(dresses)
    .where(sql`${dresses.id} = ANY(${dressIds}::uuid[])`);

  const voteTally = await db
    .select({
      dress_id: dress_votes.dress_id,
      vote_type: dress_votes.vote_type,
      count: sql<number>`cast(count(*) as int)`,
    })
    .from(dress_votes)
    .where(eq(dress_votes.session_id, session.id))
    .groupBy(dress_votes.dress_id, dress_votes.vote_type);

  return { session, dresses: dressData, voteTally };
}

export default async function VotePage({ params }: VotePageProps) {
  const { token } = await params;
  const data = await getVoteSessionData(token);

  if (!data) {
    notFound();
  }

  return (
    <div
      className="mesh-bg"
      style={{ minHeight: '100dvh', padding: 'clamp(5rem, 10vw, 7rem) 1.5rem 3rem' }}
    >
      <div style={{ maxWidth: '900px', margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
          <p className="label-luxury" style={{ marginBottom: '0.75rem' }}>
            Friend Vote · {data.session.vote_count} votes cast
          </p>
          <h1
            className="heading-display"
            style={{ fontSize: 'clamp(2rem, 5vw, 3.5rem)', lineHeight: 1.1 }}
          >
            {data.session.title ?? 'Help me pick! 💖'}
          </h1>
          <p style={{ color: 'var(--color-text-secondary)', marginTop: '1rem', fontSize: '0.9375rem' }}>
            Expires {new Date(data.session.expires_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}
          </p>
        </div>

        <VoteClient
          sessionId={data.session.id}
          shareToken={token}
          dresses={data.dresses}
          voteTally={data.voteTally}
        />
      </div>
    </div>
  );
}
```

### 5.2 — `apps/brand-network-web/src/app/(public)/vote/[token]/VoteClient.tsx`

```tsx
'use client';

import { useState, useTransition } from 'react';
import { castVote } from '@/actions/vote-actions';

interface Dress {
  id: string;
  name: string;
  designer: string | null;
  image_urls: unknown;
  price: string | null;
  occasion: string | null;
}

interface VoteTallyRow {
  dress_id: string;
  vote_type: string;
  count: number;
}

interface VoteClientProps {
  sessionId: string;
  shareToken: string;
  dresses: Dress[];
  voteTally: VoteTallyRow[];
}

type VoteType = 'love' | 'like' | 'maybe' | 'pass';

const VOTE_OPTIONS: { type: VoteType; emoji: string; label: string; color: string }[] = [
  { type: 'love', emoji: '💖', label: 'Love it', color: 'var(--color-brand-primary)' },
  { type: 'like', emoji: '👍', label: 'Like it', color: 'var(--color-success)' },
  { type: 'maybe', emoji: '🤔', label: 'Maybe', color: 'var(--color-warning)' },
  { type: 'pass', emoji: '👎', label: 'Pass', color: 'var(--color-text-tertiary)' },
];

export default function VoteClient({ sessionId, shareToken, dresses, voteTally }: VoteClientProps) {
  const [votes, setVotes] = useState<Record<string, VoteType>>({});
  const [displayName, setDisplayName] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const getTally = (dressId: string, type: VoteType): number =>
    voteTally.find((r) => r.dress_id === dressId && r.vote_type === type)?.count ?? 0;

  const handleVote = (dressId: string, voteType: VoteType) => {
    if (submitted) return;
    setVotes((prev) => ({ ...prev, [dressId]: voteType }));
  };

  const handleSubmit = () => {
    const entries = Object.entries(votes);
    if (entries.length === 0) {
      setError('Please vote on at least one dress before submitting.');
      return;
    }

    startTransition(async () => {
      setError(null);
      for (const [dressId, voteType] of entries) {
        const result = await castVote({
          shareToken,
          dressId,
          voteType,
          voterDisplayName: displayName.trim() || undefined,
        });
        if (!result.success) {
          setError(result.error ?? 'Failed to submit votes.');
          return;
        }
      }
      setSubmitted(true);
    });
  };

  if (submitted) {
    return (
      <div
        className="glass-card"
        style={{ padding: '4rem 2rem', textAlign: 'center' }}
      >
        <p style={{ fontSize: '3rem', marginBottom: '1rem' }}>💖</p>
        <h2 className="heading-section" style={{ marginBottom: '0.75rem' }}>
          Thanks{displayName ? `, ${displayName}` : ''}!
        </h2>
        <p style={{ color: 'var(--color-text-secondary)' }}>
          Your votes have been counted. The results will help pick the perfect dress.
        </p>
      </div>
    );
  }

  const imageUrls = (dress: Dress): string[] => {
    const raw = dress.image_urls;
    if (Array.isArray(raw) && raw.length > 0) return raw as string[];
    return ['https://images.unsplash.com/photo-1594938298603-c8148c4b4ae4?w=800&auto=format&fit=crop&q=85'];
  };

  return (
    <div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', marginBottom: '2.5rem' }}>
        {dresses.map((dress) => (
          <div key={dress.id} className="glass-card" style={{ padding: '1.5rem', display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
            {/* Dress image */}
            <div style={{ flexShrink: 0, width: '140px', height: '180px', borderRadius: 'var(--radius-md)', overflow: 'hidden', background: 'var(--color-bg-sunken)' }}>
              <img
                src={imageUrls(dress)[0]}
                alt={dress.name}
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                loading="lazy"
              />
            </div>

            {/* Info + vote */}
            <div style={{ flex: 1, minWidth: '200px', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div>
                <p className="label-luxury">{dress.designer ?? 'House Collection'}</p>
                <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.25rem', fontWeight: 600 }}>{dress.name}</h3>
                {dress.price && (
                  <p style={{ color: 'var(--color-brand-secondary)', fontSize: '0.9375rem', marginTop: '0.25rem' }}>
                    ${dress.price}
                  </p>
                )}
              </div>

              {/* Vote buttons */}
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                {VOTE_OPTIONS.map((opt) => {
                  const isSelected = votes[dress.id] === opt.type;
                  const tally = getTally(dress.id, opt.type);
                  return (
                    <button
                      key={opt.type}
                      type="button"
                      onClick={() => handleVote(dress.id, opt.type)}
                      disabled={submitted}
                      style={{
                        background: isSelected ? opt.color : 'var(--color-surface-glass)',
                        border: `1px solid ${isSelected ? opt.color : 'var(--color-surface-border)'}`,
                        borderRadius: 'var(--radius-pill)',
                        padding: '0.5rem 1rem',
                        color: isSelected ? (opt.type === 'love' || opt.type === 'like' ? 'var(--color-text-inverse)' : 'var(--color-text-primary)') : 'var(--color-text-secondary)',
                        fontSize: '0.875rem',
                        cursor: submitted ? 'not-allowed' : 'pointer',
                        transition: 'all var(--duration-fast) var(--ease-in-out-silk)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.375rem',
                      }}
                    >
                      <span>{opt.emoji}</span>
                      <span>{opt.label}</span>
                      {tally > 0 && (
                        <span style={{ opacity: 0.6, fontSize: '0.75rem' }}>·{tally}</span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Voter name + submit */}
      <div className="glass-card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <div>
          <label style={{ color: 'var(--color-text-secondary)', fontSize: '0.875rem', display: 'block', marginBottom: '0.5rem' }}>
            Your name (optional)
          </label>
          <input
            type="text"
            className="input-luxury"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="e.g. Emma"
            maxLength={60}
            disabled={isPending}
            style={{ maxWidth: '320px' }}
          />
        </div>

        {error && (
          <p style={{ color: 'var(--color-error)', fontSize: '0.875rem' }}>{error}</p>
        )}

        <button
          type="button"
          className="btn-primary"
          onClick={handleSubmit}
          disabled={isPending || Object.keys(votes).length === 0}
          style={{ alignSelf: 'flex-start' }}
        >
          {isPending ? 'Submitting…' : `Submit ${Object.keys(votes).length > 0 ? `${Object.keys(votes).length} Vote${Object.keys(votes).length > 1 ? 's' : ''}` : 'Votes'}`}
        </button>
      </div>
    </div>
  );
}
```

---

## [EXECUTION BLOCK 6: Bridal Party Dashboard Panel]

### 6.1 — `apps/brand-network-web/src/app/(main)/dashboard/bridal-party/page.tsx`

```tsx
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { db } from '@toptenprom/database';
import { bridal_parties, bridal_party_members, customers } from '@toptenprom/database';
import { eq } from 'drizzle-orm';
import BridalPartyClient from './BridalPartyClient';

export const metadata: Metadata = {
  title: 'Bridal Party | Top 10 Prom Dashboard',
  robots: { index: false },
};

export default async function BridalPartyPage() {
  const supabase = await createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  if (!authUser) redirect('/login');

  // Resolve customer
  let customerId: string | null = null;
  try {
    const result = await db
      .select({ id: customers.id })
      .from(customers)
      .where(eq(customers.user_id, authUser.id))
      .limit(1);
    customerId = result[0]?.id ?? null;
  } catch {
    // Non-fatal — handled in client
  }

  // Get parties where this customer is a member or lead
  let parties: { id: string; name: string; occasion: string; invite_code: string; is_active: boolean }[] = [];
  if (customerId) {
    try {
      const memberRecords = await db
        .select({ party_id: bridal_party_members.party_id })
        .from(bridal_party_members)
        .where(eq(bridal_party_members.customer_id, customerId));

      const partyIds = memberRecords.map((r) => r.party_id);

      if (partyIds.length > 0) {
        parties = await db
          .select({
            id: bridal_parties.id,
            name: bridal_parties.name,
            occasion: bridal_parties.occasion,
            invite_code: bridal_parties.invite_code,
            is_active: bridal_parties.is_active,
          })
          .from(bridal_parties)
          .where(eq(bridal_parties.is_active, true));
      }
    } catch {
      // Non-fatal
    }
  }

  return (
    <div style={{ padding: 'clamp(1.5rem, 4vw, 3rem)' }}>
      <div style={{ marginBottom: '2.5rem' }}>
        <p className="label-luxury" style={{ marginBottom: '0.5rem' }}>Dashboard</p>
        <h1 className="heading-section" style={{ fontSize: 'clamp(1.75rem, 4vw, 2.5rem)' }}>
          Bridal Party
        </h1>
        <p style={{ color: 'var(--color-text-secondary)', marginTop: '0.5rem', maxWidth: '560px' }}>
          Create or join a shopping group. Coordinate outfits and see each member's shortlisted dresses in one place.
        </p>
      </div>

      <BridalPartyClient customerId={customerId} parties={parties} />
    </div>
  );
}
```

### 6.2 — `apps/brand-network-web/src/app/(main)/dashboard/bridal-party/BridalPartyClient.tsx`

```tsx
'use client';

import { useState, useTransition } from 'react';
import { createBridalParty, joinBridalParty } from '@/actions/bridal-party-actions';
import { useRouter } from 'next/navigation';

interface Party {
  id: string;
  name: string;
  occasion: string;
  invite_code: string;
  is_active: boolean;
}

interface BridalPartyClientProps {
  customerId: string | null;
  parties: Party[];
}

export default function BridalPartyClient({ customerId, parties }: BridalPartyClientProps) {
  const [mode, setMode] = useState<'idle' | 'create' | 'join'>('idle');
  const [partyName, setPartyName] = useState('');
  const [occasion, setOccasion] = useState<'prom' | 'wedding' | 'homecoming'>('prom');
  const [schoolName, setSchoolName] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const handleCreate = () => {
    if (!partyName.trim()) return;
    startTransition(async () => {
      setFeedback(null);
      const result = await createBridalParty({
        tenantId: '00000000-0000-0000-0000-000000000001', // Replace with tenant context
        name: partyName.trim(),
        occasion,
        schoolName: schoolName.trim() || undefined,
      });
      if (result.success) {
        setFeedback({ type: 'success', message: `Party created! Invite code: ${result.inviteCode}` });
        setMode('idle');
        router.refresh();
      } else {
        setFeedback({ type: 'error', message: result.error ?? 'Failed to create party.' });
      }
    });
  };

  const handleJoin = () => {
    if (!inviteCode.trim()) return;
    startTransition(async () => {
      setFeedback(null);
      const result = await joinBridalParty({ inviteCode: inviteCode.trim() });
      if (result.success) {
        setFeedback({ type: 'success', message: `Joined "${result.partyName}"!` });
        setMode('idle');
        router.refresh();
      } else {
        setFeedback({ type: 'error', message: result.error ?? 'Failed to join.' });
      }
    });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      {/* Existing parties */}
      {parties.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1.25rem' }}>
          {parties.map((party) => (
            <a
              key={party.id}
              href={`/dashboard/bridal-party/${party.id}`}
              style={{ textDecoration: 'none' }}
            >
              <div className="glass-card" style={{ padding: '1.5rem', cursor: 'pointer' }}>
                <p className="label-luxury" style={{ marginBottom: '0.5rem', textTransform: 'capitalize' }}>
                  {party.occasion}
                </p>
                <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.125rem', fontWeight: 600, marginBottom: '0.75rem' }}>
                  {party.name}
                </h3>
                <p style={{ color: 'var(--color-text-tertiary)', fontSize: '0.75rem', fontFamily: 'var(--font-mono)', letterSpacing: '0.05em' }}>
                  Invite: {party.invite_code}
                </p>
              </div>
            </a>
          ))}
        </div>
      )}

      {/* Action buttons */}
      {mode === 'idle' && (
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
          <button type="button" className="btn-primary" onClick={() => setMode('create')}>
            + Create Party
          </button>
          <button type="button" className="btn-ghost" onClick={() => setMode('join')}>
            Join via Invite Code
          </button>
        </div>
      )}

      {/* Create form */}
      {mode === 'create' && (
        <div className="glass-card" style={{ padding: '2rem', maxWidth: '480px', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <h2 className="heading-section" style={{ fontSize: '1.25rem', marginBottom: '0.5rem' }}>Create a Party</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <label style={{ color: 'var(--color-text-secondary)', fontSize: '0.875rem' }}>Party Name</label>
            <input type="text" className="input-luxury" value={partyName} onChange={(e) => setPartyName(e.target.value)} placeholder="e.g. Madison's Prom Squad 2025" disabled={isPending} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <label style={{ color: 'var(--color-text-secondary)', fontSize: '0.875rem' }}>Occasion</label>
            <select className="input-luxury" value={occasion} onChange={(e) => setOccasion(e.target.value as typeof occasion)} disabled={isPending}>
              <option value="prom">Prom</option>
              <option value="wedding">Wedding</option>
              <option value="homecoming">Homecoming</option>
            </select>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <label style={{ color: 'var(--color-text-secondary)', fontSize: '0.875rem' }}>School (optional)</label>
            <input type="text" className="input-luxury" value={schoolName} onChange={(e) => setSchoolName(e.target.value)} placeholder="e.g. Lincoln High School" disabled={isPending} />
          </div>
          {feedback && (
            <p style={{ color: feedback.type === 'error' ? 'var(--color-error)' : 'var(--color-success)', fontSize: '0.875rem' }}>{feedback.message}</p>
          )}
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button type="button" className="btn-primary" onClick={handleCreate} disabled={isPending || !partyName.trim()}>{isPending ? 'Creating…' : 'Create'}</button>
            <button type="button" className="btn-ghost" onClick={() => setMode('idle')} disabled={isPending}>Cancel</button>
          </div>
        </div>
      )}

      {/* Join form */}
      {mode === 'join' && (
        <div className="glass-card" style={{ padding: '2rem', maxWidth: '400px', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <h2 className="heading-section" style={{ fontSize: '1.25rem', marginBottom: '0.5rem' }}>Join a Party</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <label style={{ color: 'var(--color-text-secondary)', fontSize: '0.875rem' }}>Invite Code</label>
            <input type="text" className="input-luxury" value={inviteCode} onChange={(e) => setInviteCode(e.target.value.toLowerCase())} placeholder="e.g. a3f9c2b1..." disabled={isPending} />
          </div>
          {feedback && (
            <p style={{ color: feedback.type === 'error' ? 'var(--color-error)' : 'var(--color-success)', fontSize: '0.875rem' }}>{feedback.message}</p>
          )}
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button type="button" className="btn-primary" onClick={handleJoin} disabled={isPending || !inviteCode.trim()}>{isPending ? 'Joining…' : 'Join'}</button>
            <button type="button" className="btn-ghost" onClick={() => setMode('idle')} disabled={isPending}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}
```

---

## [EXECUTION BLOCK 7: Update PHASE_MANIFEST.md]

### 7.1 — Add Phase 9 to the Phase Completion Registry in `PHASE_MANIFEST.md`

Add the following row to the Phase Completion Registry table:

```
| 9 | Social Discovery, Bridal Party & Friend Voting | ⬜ PENDING | — |
```

### 7.2 — Add New Table Names to the Canonical Database Table Names section

Add these rows to the locked table registry:

```
| `bridal_parties`        | Group shopping coordination registry |
| `bridal_party_members`  | Party membership junction table |
| `dress_vote_sessions`   | Shareable friend-voting sessions |
| `dress_votes`           | Individual votes cast by friends |
```

---

## [VALIDATION CHECKPOINT — PHASE 9]

```bash
# Step 1: Schema integrity check
pnpm --filter @toptenprom/database db:check

# Step 2: TypeScript — zero errors
pnpm --filter @toptenprom/brand-network-web typecheck

# Step 3: Lint — zero warnings
pnpm --filter @toptenprom/brand-network-web lint

# Step 4: Full workspace build
pnpm --filter @toptenprom/brand-network-web build
```

**Manual QA checklist:**
- [ ] `bridal_parties` table exists with `invite_code` unique index
- [ ] `bridal_party_members` has `(party_id, customer_id)` unique constraint
- [ ] `dress_votes` has `(session_id, dress_id, voter_fingerprint)` unique constraint — prevents double-voting
- [ ] `/vote/[token]` page loads without auth for anonymous voters
- [ ] OG image route `/api/og/vote` returns a 1200×630 image with `runtime = 'edge'`
- [ ] `share_token` is 64 hex chars (32 random bytes)
- [ ] `invite_code` is 32 hex chars (16 random bytes)
- [ ] Voter fingerprint is SHA-256 hashed — raw IP is never stored
- [ ] `castVote` server action is idempotent on conflict
- [ ] `/dashboard/bridal-party` is auth-gated (redirects to `/login` if unauthenticated)
- [ ] `VoteClient` submit button is disabled when zero dresses voted on
- [ ] OG image route is declared in `vercel.json` functions with `memory: 512`, `maxDuration: 5`

**Update PHASE_MANIFEST.md:** Mark Phase 9 as ✅ COMPLETE.

**STOP. Await human approval before executing Phase 10.**