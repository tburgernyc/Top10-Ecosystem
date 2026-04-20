# Expo In-Store Mobile App Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Scaffold the `apps/mobile-instore-app` Expo app with store-code auth, offline-first walk-in queue (+ appointments), walk-in check-in, walk-in→appointment conversion, and VTO photo capture.

**Architecture:** Expo Router v3 file-based navigation with `(auth)` / `(app)` route groups; WatermelonDB + expo-sqlite for offline-first local storage synced against the existing `/api/sync` endpoint; two new Next.js API routes for mobile auth and walk-in conversion.

**Tech Stack:** Expo SDK 52, Expo Router 4, WatermelonDB 0.27, expo-camera, expo-secure-store, react-native-mmkv, @react-native-community/netinfo, Drizzle ORM (server), Next.js 15 (server)

---

## File Map

### New files — server (`apps/brand-network-web`)
| File | Purpose |
|---|---|
| `src/app/api/mobile/auth/route.ts` | POST: validate store code → return tenant_id + sync_secret + stylists |
| `src/app/api/mobile/convert-walkin/route.ts` | POST: atomically convert walk-in to appointment |

### Modified files — server
| File | Change |
|---|---|
| `packages/database/src/schema.ts` | Add `store_code` + `mobile_sync_secret` to `tenants`; make `appointments.customer_id` nullable |

### New files — mobile (`apps/mobile-instore-app`)
| File | Purpose |
|---|---|
| `package.json` | Expo 52 deps, scripts, workspace config |
| `tsconfig.json` | TypeScript config extending root |
| `babel.config.js` | Expo preset + WatermelonDB decorator plugin |
| `src/db/schema.ts` | WatermelonDB table/column definitions |
| `src/db/models/WalkIn.ts` | WatermelonDB WalkIn model |
| `src/db/models/Appointment.ts` | WatermelonDB Appointment model |
| `src/db/database.ts` | WatermelonDB instance (expo-sqlite adapter) |
| `src/db/sync.ts` | `synchronize()` wrapper calling `/api/sync` |
| `src/store/auth.ts` | expo-secure-store helpers: save/load/clear session |
| `src/lib/api.ts` | fetch wrapper with `x-sync-secret` header |
| `app/_layout.tsx` | Root layout: reads auth, routes to (auth) or (app) |
| `app/(auth)/index.tsx` | Store code entry screen |
| `app/(app)/_layout.tsx` | Bottom tab navigator: Queue | VTO |
| `app/(app)/queue/index.tsx` | Unified walk-ins + appointments queue screen |
| `app/(app)/queue/check-in.tsx` | New walk-in form screen |
| `app/(app)/vto/index.tsx` | Camera capture + dress ID + VTO submission |
| `src/components/WalkInSheet.tsx` | Bottom sheet: status actions + convert button |
| `src/components/ConvertModal.tsx` | Walk-in → appointment conversion modal |

---

## Task 1: Schema — add store_code/mobile_sync_secret + make customer_id nullable

**Files:**
- Modify: `packages/database/src/schema.ts`

The auth endpoint needs `store_code` (unique per tenant) and `mobile_sync_secret` (returned to device). Walk-in→appointment conversion requires `customer_id` to be nullable because walk-in customers don't have app accounts.

- [ ] **Step 1: Add columns to tenants and relax customer_id constraint**

In `packages/database/src/schema.ts`, find the `tenants` table and add two columns before `...timestamps`:

```typescript
// After max_daily_appointments line, before ...timestamps:
store_code: varchar('store_code', { length: 50 }),
mobile_sync_secret: varchar('mobile_sync_secret', { length: 255 }),
```

Find the `appointments` table. Change:
```typescript
// BEFORE:
customer_id: uuid('customer_id')
  .notNull()
  .references(() => customers.id),
```
to:
```typescript
// AFTER (nullable for walk-in-originated appointments):
customer_id: uuid('customer_id')
  .references(() => customers.id),
```

- [ ] **Step 2: Generate the migration**

```bash
cd /mnt/c/Users/tburg/Top10PromWebsite/top-10-prom-ecosystem
pnpm --filter @toptenprom/database exec drizzle-kit generate
```

Expected: a new SQL file created in `packages/database/drizzle/` with ALTER TABLE statements.

- [ ] **Step 3: Apply the migration**

```bash
pnpm db:migrate
```

Expected: `✓ migrations applied` (no errors).

- [ ] **Step 4: Seed store codes into tenants**

In `packages/database/src/seed.ts`, find where tenants are inserted/updated and add:

```typescript
// After each tenant insert, add store_code and mobile_sync_secret.
// Example for dev seed — real store codes set via admin UI later.
await db.update(tenants).set({
  store_code: 'STORE001',
  mobile_sync_secret: process.env['MOBILE_SYNC_API_SECRET'] ?? 'dev-secret-change-in-production',
}).where(eq(tenants.subdomain, 'flagship')); // adjust to match your seed tenant subdomain
```

- [ ] **Step 5: Commit**

```bash
git add packages/database/src/schema.ts packages/database/drizzle/ packages/database/src/seed.ts
git commit -m "feat(db): add store_code/mobile_sync_secret to tenants, relax appointments.customer_id"
```

---

## Task 2: Server route — POST /api/mobile/auth

**Files:**
- Create: `apps/brand-network-web/src/app/api/mobile/auth/route.ts`

Validates `store_code`, returns `{ tenant_id, store_name, sync_secret, stylists }`. Stylists are returned at login so the device can populate pickers without extra round trips.

- [ ] **Step 1: Write a failing test**

Create `apps/brand-network-web/src/app/api/mobile/auth/route.test.ts`:

```typescript
import { NextRequest } from 'next/server';

jest.mock('@toptenprom/database', () => ({
  db: { select: jest.fn() },
  tenants: {},
  boutique_staff: {},
  users: {},
}));
jest.mock('drizzle-orm', () => ({ eq: jest.fn((a, b) => ({ col: a, val: b })) }));

// We'll import POST after mocks are set up
describe('POST /api/mobile/auth', () => {
  it('returns 400 when store_code is missing', async () => {
    const { POST } = await import('./route');
    const req = new NextRequest('http://localhost/api/mobile/auth', {
      method: 'POST',
      body: JSON.stringify({}),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });
});
```

- [ ] **Step 2: Run to confirm failure**

```bash
cd apps/brand-network-web
pnpm jest src/app/api/mobile/auth/route.test.ts --no-coverage 2>&1 | tail -10
```

Expected: FAIL — module not found or test setup error (route doesn't exist yet).

- [ ] **Step 3: Create the route**

Create `apps/brand-network-web/src/app/api/mobile/auth/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { db, tenants, boutique_staff, users } from '@toptenprom/database';
import { eq } from 'drizzle-orm';

interface AuthRequest {
  store_code: string;
}

interface Stylist {
  id: string;
  name: string;
}

export async function POST(request: NextRequest) {
  let body: Partial<AuthRequest>;
  try {
    body = await request.json() as Partial<AuthRequest>;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { store_code } = body;
  if (!store_code || typeof store_code !== 'string') {
    return NextResponse.json({ error: 'store_code is required' }, { status: 400 });
  }

  const [tenant] = await db
    .select({
      id: tenants.id,
      name: tenants.name,
      mobile_sync_secret: tenants.mobile_sync_secret,
    })
    .from(tenants)
    .where(eq(tenants.store_code, store_code.trim().toUpperCase()))
    .limit(1);

  if (!tenant) {
    return NextResponse.json({ error: 'Invalid store code' }, { status: 401 });
  }

  // Fetch active stylists for this tenant (join boutique_staff → users for display name)
  const staffRows = await db
    .select({
      id: boutique_staff.id,
      first_name: users.first_name,
      last_name: users.last_name,
    })
    .from(boutique_staff)
    .innerJoin(users, eq(boutique_staff.user_id, users.id))
    .where(eq(boutique_staff.tenant_id, tenant.id));

  const stylists: Stylist[] = staffRows.map((s) => ({
    id: s.id,
    name: `${s.first_name} ${s.last_name}`,
  }));

  return NextResponse.json({
    tenant_id: tenant.id,
    store_name: tenant.name,
    sync_secret: tenant.mobile_sync_secret ?? process.env['MOBILE_SYNC_API_SECRET'] ?? '',
    stylists,
  });
}
```

- [ ] **Step 4: Run tests to confirm passing**

```bash
cd apps/brand-network-web
pnpm jest src/app/api/mobile/auth/route.test.ts --no-coverage 2>&1 | tail -10
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/brand-network-web/src/app/api/mobile/auth/
git commit -m "feat(api): add POST /api/mobile/auth for store code login"
```

---

## Task 3: Server route — POST /api/mobile/convert-walkin

**Files:**
- Create: `apps/brand-network-web/src/app/api/mobile/convert-walkin/route.ts`

Validates sync secret, looks up the walk-in, creates an appointment (with `customer_id: null` since walk-ins are anonymous), and updates walk-in status to `with_stylist`.

- [ ] **Step 1: Write a failing test**

Create `apps/brand-network-web/src/app/api/mobile/convert-walkin/route.test.ts`:

```typescript
import { NextRequest } from 'next/server';

jest.mock('@toptenprom/database', () => ({
  db: { select: jest.fn(), insert: jest.fn(), update: jest.fn() },
  walk_ins: {},
  appointments: {},
}));
jest.mock('drizzle-orm', () => ({ eq: jest.fn() }));

describe('POST /api/mobile/convert-walkin', () => {
  it('returns 401 when sync secret is missing', async () => {
    const { POST } = await import('./route');
    const req = new NextRequest('http://localhost/api/mobile/convert-walkin', {
      method: 'POST',
      body: JSON.stringify({}),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });
});
```

- [ ] **Step 2: Run to confirm failure**

```bash
cd apps/brand-network-web
pnpm jest src/app/api/mobile/convert-walkin/route.test.ts --no-coverage 2>&1 | tail -10
```

Expected: FAIL — module not found.

- [ ] **Step 3: Create the route**

Create `apps/brand-network-web/src/app/api/mobile/convert-walkin/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { db, walk_ins, appointments } from '@toptenprom/database';
import { eq } from 'drizzle-orm';
import { randomBytes } from 'crypto';

interface ConvertRequest {
  walk_in_id: string;
  appointment_date: string; // ISO string
  duration_minutes: number;
  service_type: string;
  stylist_id?: string;
}

function validateSyncSecret(request: NextRequest): boolean {
  const secret = request.headers.get('x-sync-secret');
  return !!secret && secret === process.env['MOBILE_SYNC_API_SECRET'];
}

function generateConfirmationCode(): string {
  return randomBytes(4).toString('hex').toUpperCase(); // e.g. "A3F9B2C1"
}

export async function POST(request: NextRequest) {
  if (!validateSyncSecret(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: Partial<ConvertRequest>;
  try {
    body = await request.json() as Partial<ConvertRequest>;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { walk_in_id, appointment_date, duration_minutes, service_type, stylist_id } = body;

  if (!walk_in_id || !appointment_date || !duration_minutes || !service_type) {
    return NextResponse.json({ error: 'walk_in_id, appointment_date, duration_minutes, service_type are required' }, { status: 400 });
  }

  // Look up the walk-in to get tenant_id and verify it exists
  const [walkIn] = await db
    .select({ id: walk_ins.id, tenant_id: walk_ins.tenant_id, status: walk_ins.status })
    .from(walk_ins)
    .where(eq(walk_ins.id, walk_in_id))
    .limit(1);

  if (!walkIn) {
    return NextResponse.json({ error: 'Walk-in not found' }, { status: 404 });
  }

  const confirmationCode = generateConfirmationCode();
  const appointmentDate = new Date(appointment_date);

  // Create appointment — customer_id is null (anonymous walk-in)
  const [appointment] = await db
    .insert(appointments)
    .values({
      tenant_id: walkIn.tenant_id,
      customer_id: null,
      stylist_id: stylist_id ?? null,
      appointment_date: appointmentDate,
      duration_minutes: duration_minutes,
      service_type: service_type,
      status: 'confirmed',
      notes: `Converted from walk-in ${walk_in_id}`,
      confirmation_code: confirmationCode,
    })
    .returning({ id: appointments.id, confirmation_code: appointments.confirmation_code });

  // Update walk-in status to with_stylist
  await db
    .update(walk_ins)
    .set({ status: 'with_stylist', updated_at: new Date() })
    .where(eq(walk_ins.id, walk_in_id));

  return NextResponse.json({
    appointment_id: appointment?.id,
    confirmation_code: appointment?.confirmation_code,
  });
}
```

- [ ] **Step 4: Run tests to confirm passing**

```bash
cd apps/brand-network-web
pnpm jest src/app/api/mobile/convert-walkin/route.test.ts --no-coverage 2>&1 | tail -10
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/brand-network-web/src/app/api/mobile/convert-walkin/
git commit -m "feat(api): add POST /api/mobile/convert-walkin for walk-in to appointment conversion"
```

---

## Task 4: Mobile app — scaffold package.json, tsconfig, babel config

**Files:**
- Create: `apps/mobile-instore-app/package.json`
- Create: `apps/mobile-instore-app/tsconfig.json`
- Create: `apps/mobile-instore-app/babel.config.js`

- [ ] **Step 1: Create package.json**

Create `apps/mobile-instore-app/package.json`:

```json
{
  "name": "@toptenprom/mobile-instore-app",
  "version": "1.0.0",
  "private": true,
  "main": "expo-router/entry",
  "scripts": {
    "start": "expo start",
    "android": "expo run:android",
    "ios": "expo run:ios",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@nozbe/watermelondb": "^0.27.1",
    "@nozbe/with-observables": "^1.6.0",
    "@react-native-community/netinfo": "^11.4.1",
    "expo": "~52.0.46",
    "expo-camera": "~16.0.18",
    "expo-router": "~4.0.20",
    "expo-secure-store": "~14.0.1",
    "expo-sqlite": "~15.1.4",
    "expo-status-bar": "~2.0.1",
    "react": "18.3.1",
    "react-native": "0.76.9",
    "react-native-mmkv": "^3.1.0",
    "react-native-reanimated": "~3.16.7",
    "react-native-safe-area-context": "4.12.0",
    "react-native-screens": "~4.4.0"
  },
  "devDependencies": {
    "@babel/core": "^7.25.2",
    "@babel/plugin-proposal-decorators": "^7.25.2",
    "@toptenprom/eslint-config": "workspace:*",
    "@toptenprom/typescript-config": "workspace:*",
    "@types/react": "~18.3.12",
    "typescript": "^5.3.3"
  }
}
```

- [ ] **Step 2: Create tsconfig.json**

Create `apps/mobile-instore-app/tsconfig.json`:

```json
{
  "extends": "expo/tsconfig.base",
  "compilerOptions": {
    "strict": true,
    "experimentalDecorators": true,
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["**/*.ts", "**/*.tsx", ".expo/types/**/*.d.ts", "expo-env.d.ts"]
}
```

- [ ] **Step 3: Create babel.config.js**

Create `apps/mobile-instore-app/babel.config.js`:

```javascript
module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      ['@babel/plugin-proposal-decorators', { legacy: true }],
      'react-native-reanimated/plugin',
    ],
  };
};
```

- [ ] **Step 4: Install dependencies**

```bash
cd /mnt/c/Users/tburg/Top10PromWebsite/top-10-prom-ecosystem
pnpm install
```

Expected: no errors; `node_modules` inside `apps/mobile-instore-app` populated.

- [ ] **Step 5: Typecheck**

```bash
cd apps/mobile-instore-app
pnpm typecheck 2>&1 | head -20
```

Expected: Errors only about missing source files (expected at this stage), no config errors.

- [ ] **Step 6: Commit**

```bash
git add apps/mobile-instore-app/package.json apps/mobile-instore-app/tsconfig.json apps/mobile-instore-app/babel.config.js pnpm-lock.yaml
git commit -m "feat(mobile): scaffold Expo app with WatermelonDB dependencies"
```

---

## Task 5: WatermelonDB schema

**Files:**
- Create: `apps/mobile-instore-app/src/db/schema.ts`

WatermelonDB schema defines the local SQLite tables that mirror the server's `walk_ins` and `appointments` tables. All columns are strings or numbers (WatermelonDB has no native UUID or timestamp types — use `text` for UUIDs and `number` for epoch timestamps).

- [ ] **Step 1: Create the schema file**

Create `apps/mobile-instore-app/src/db/schema.ts`:

```typescript
import { appSchema, tableSchema } from '@nozbe/watermelondb';

export const dbSchema = appSchema({
  version: 1,
  tables: [
    tableSchema({
      name: 'walk_ins',
      columns: [
        { name: 'tenant_id', type: 'string' },
        { name: 'customer_name', type: 'string' },
        { name: 'phone_number', type: 'string' },
        { name: 'party_size', type: 'number' },
        { name: 'occasion', type: 'string', isOptional: true },
        { name: 'notes', type: 'string', isOptional: true },
        { name: 'status', type: 'string' },
        { name: 'queue_position', type: 'number' },
        { name: 'estimated_wait_minutes', type: 'number', isOptional: true },
        { name: 'assigned_stylist_id', type: 'string', isOptional: true },
        { name: 'checked_in_at', type: 'number' },  // epoch ms
        { name: 'called_at', type: 'number', isOptional: true },
        { name: 'completed_at', type: 'number', isOptional: true },
      ],
    }),
    tableSchema({
      name: 'appointments',
      columns: [
        { name: 'tenant_id', type: 'string' },
        { name: 'customer_id', type: 'string', isOptional: true },
        { name: 'stylist_id', type: 'string', isOptional: true },
        { name: 'appointment_date', type: 'number' },  // epoch ms
        { name: 'duration_minutes', type: 'number' },
        { name: 'service_type', type: 'string' },
        { name: 'status', type: 'string' },
        { name: 'notes', type: 'string', isOptional: true },
        { name: 'confirmation_code', type: 'string' },
      ],
    }),
  ],
});
```

- [ ] **Step 2: Commit**

```bash
git add apps/mobile-instore-app/src/db/schema.ts
git commit -m "feat(mobile): add WatermelonDB schema for walk_ins and appointments"
```

---

## Task 6: WatermelonDB models

**Files:**
- Create: `apps/mobile-instore-app/src/db/models/WalkIn.ts`
- Create: `apps/mobile-instore-app/src/db/models/Appointment.ts`

Models expose typed accessors over WatermelonDB's raw column storage. The `@field` decorator maps a property name to a column name. Timestamps are stored as epoch milliseconds (number) and exposed as `Date` objects via `@date`.

- [ ] **Step 1: Create WalkIn model**

Create `apps/mobile-instore-app/src/db/models/WalkIn.ts`:

```typescript
import { Model } from '@nozbe/watermelondb';
import { field, text, date, readonly } from '@nozbe/watermelondb/decorators';

export type WalkInStatus = 'waiting' | 'called' | 'with_stylist' | 'completed' | 'left';

export default class WalkIn extends Model {
  static table = 'walk_ins';

  @text('tenant_id') tenantId!: string;
  @text('customer_name') customerName!: string;
  @text('phone_number') phoneNumber!: string;
  @field('party_size') partySize!: number;
  @text('occasion') occasion!: string | null;
  @text('notes') notes!: string | null;
  @text('status') status!: WalkInStatus;
  @field('queue_position') queuePosition!: number;
  @field('estimated_wait_minutes') estimatedWaitMinutes!: number | null;
  @text('assigned_stylist_id') assignedStylistId!: string | null;
  @date('checked_in_at') checkedInAt!: Date;
  @date('called_at') calledAt!: Date | null;
  @date('completed_at') completedAt!: Date | null;
}
```

- [ ] **Step 2: Create Appointment model**

Create `apps/mobile-instore-app/src/db/models/Appointment.ts`:

```typescript
import { Model } from '@nozbe/watermelondb';
import { field, text, date } from '@nozbe/watermelondb/decorators';

export type AppointmentStatus = 'pending' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled' | 'no_show';

export default class Appointment extends Model {
  static table = 'appointments';

  @text('tenant_id') tenantId!: string;
  @text('customer_id') customerId!: string | null;
  @text('stylist_id') stylistId!: string | null;
  @date('appointment_date') appointmentDate!: Date;
  @field('duration_minutes') durationMinutes!: number;
  @text('service_type') serviceType!: string;
  @text('status') status!: AppointmentStatus;
  @text('notes') notes!: string | null;
  @text('confirmation_code') confirmationCode!: string;
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/mobile-instore-app/src/db/models/
git commit -m "feat(mobile): add WatermelonDB WalkIn and Appointment models"
```

---

## Task 7: WatermelonDB database instance

**Files:**
- Create: `apps/mobile-instore-app/src/db/database.ts`

Single shared WatermelonDB instance using the expo-sqlite adapter. Export as a singleton so every part of the app uses the same database.

- [ ] **Step 1: Create database.ts**

Create `apps/mobile-instore-app/src/db/database.ts`:

```typescript
import { Database } from '@nozbe/watermelondb';
import SQLiteAdapter from '@nozbe/watermelondb/adapters/sqlite';
import { dbSchema } from './schema';
import WalkIn from './models/WalkIn';
import Appointment from './models/Appointment';

const adapter = new SQLiteAdapter({
  schema: dbSchema,
  dbName: 'toptenprom_instore',
  // jsi: true enables faster JSI bridge (available in Expo SDK 52 + hermes)
  jsi: true,
});

export const database = new Database({
  adapter,
  modelClasses: [WalkIn, Appointment],
});
```

- [ ] **Step 2: Commit**

```bash
git add apps/mobile-instore-app/src/db/database.ts
git commit -m "feat(mobile): add WatermelonDB database singleton"
```

---

## Task 8: Auth store

**Files:**
- Create: `apps/mobile-instore-app/src/store/auth.ts`

Persist `tenant_id`, `store_name`, `sync_secret`, and `stylists` in `expo-secure-store`. Expose typed save/load/clear helpers plus a React hook for reading session state.

- [ ] **Step 1: Write a failing test**

Create `apps/mobile-instore-app/src/store/auth.test.ts`:

```typescript
jest.mock('expo-secure-store', () => ({
  setItemAsync: jest.fn(),
  getItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));

import * as SecureStore from 'expo-secure-store';
import { saveSession, loadSession, clearSession } from './auth';

const mockStore = SecureStore as jest.Mocked<typeof SecureStore>;

describe('auth store', () => {
  beforeEach(() => jest.clearAllMocks());

  it('saveSession stores all fields', async () => {
    const session = { tenant_id: 't1', store_name: 'Flagship', sync_secret: 's3cr3t', stylists: [] };
    await saveSession(session);
    expect(mockStore.setItemAsync).toHaveBeenCalledWith('auth_session', JSON.stringify(session));
  });

  it('loadSession returns null when nothing stored', async () => {
    mockStore.getItemAsync.mockResolvedValueOnce(null);
    const result = await loadSession();
    expect(result).toBeNull();
  });

  it('loadSession parses stored JSON', async () => {
    const session = { tenant_id: 't1', store_name: 'Flagship', sync_secret: 's3cr3t', stylists: [] };
    mockStore.getItemAsync.mockResolvedValueOnce(JSON.stringify(session));
    const result = await loadSession();
    expect(result).toEqual(session);
  });

  it('clearSession deletes the key', async () => {
    await clearSession();
    expect(mockStore.deleteItemAsync).toHaveBeenCalledWith('auth_session');
  });
});
```

- [ ] **Step 2: Run to confirm failure**

```bash
cd apps/mobile-instore-app
pnpm jest src/store/auth.test.ts --no-coverage 2>&1 | tail -10
```

Expected: FAIL — `auth.ts` not found.

- [ ] **Step 3: Create auth.ts**

Create `apps/mobile-instore-app/src/store/auth.ts`:

```typescript
import * as SecureStore from 'expo-secure-store';

const SESSION_KEY = 'auth_session';

export interface Stylist {
  id: string;
  name: string;
}

export interface AuthSession {
  tenant_id: string;
  store_name: string;
  sync_secret: string;
  stylists: Stylist[];
}

export async function saveSession(session: AuthSession): Promise<void> {
  await SecureStore.setItemAsync(SESSION_KEY, JSON.stringify(session));
}

export async function loadSession(): Promise<AuthSession | null> {
  const raw = await SecureStore.getItemAsync(SESSION_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AuthSession;
  } catch {
    return null;
  }
}

export async function clearSession(): Promise<void> {
  await SecureStore.deleteItemAsync(SESSION_KEY);
}
```

- [ ] **Step 4: Run tests to confirm passing**

```bash
pnpm jest src/store/auth.test.ts --no-coverage 2>&1 | tail -10
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/mobile-instore-app/src/store/
git commit -m "feat(mobile): add auth session store with expo-secure-store"
```

---

## Task 9: API fetch wrapper

**Files:**
- Create: `apps/mobile-instore-app/src/lib/api.ts`

All server calls must include `x-sync-secret` and `Content-Type: application/json`. This wrapper reads the secret from the current auth session and adds it automatically.

- [ ] **Step 1: Write a failing test**

Create `apps/mobile-instore-app/src/lib/api.test.ts`:

```typescript
jest.mock('../store/auth', () => ({
  loadSession: jest.fn(),
}));

import { loadSession } from '../store/auth';
import { apiFetch } from './api';

const mockLoadSession = loadSession as jest.MockedFunction<typeof loadSession>;

describe('apiFetch', () => {
  const realFetch = global.fetch;
  beforeEach(() => {
    global.fetch = jest.fn();
    jest.clearAllMocks();
  });
  afterEach(() => { global.fetch = realFetch; });

  it('includes x-sync-secret header when session exists', async () => {
    mockLoadSession.mockResolvedValueOnce({
      tenant_id: 't1', store_name: 'S', sync_secret: 'abc123', stylists: [],
    });
    (global.fetch as jest.Mock).mockResolvedValueOnce({ ok: true, json: async () => ({}) });

    await apiFetch('/api/test', { method: 'GET' });

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/test'),
      expect.objectContaining({
        headers: expect.objectContaining({ 'x-sync-secret': 'abc123' }),
      })
    );
  });

  it('throws when response is not ok', async () => {
    mockLoadSession.mockResolvedValueOnce({
      tenant_id: 't1', store_name: 'S', sync_secret: 'abc123', stylists: [],
    });
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => ({ error: 'Server error' }),
    });

    await expect(apiFetch('/api/test')).rejects.toThrow('Server error');
  });
});
```

- [ ] **Step 2: Run to confirm failure**

```bash
pnpm jest src/lib/api.test.ts --no-coverage 2>&1 | tail -10
```

Expected: FAIL — module not found.

- [ ] **Step 3: Create api.ts**

Create `apps/mobile-instore-app/src/lib/api.ts`:

```typescript
import { loadSession } from '../store/auth';

const BASE_URL = process.env['EXPO_PUBLIC_API_URL'] ?? 'http://localhost:3000';

export async function apiFetch(path: string, init: RequestInit = {}): Promise<unknown> {
  const session = await loadSession();

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(init.headers as Record<string, string> ?? {}),
  };

  if (session?.sync_secret) {
    headers['x-sync-secret'] = session.sync_secret;
  }

  const response = await fetch(`${BASE_URL}${path}`, { ...init, headers });

  if (!response.ok) {
    const body = await response.json().catch(() => ({})) as { error?: string };
    throw new Error(body.error ?? `HTTP ${response.status}`);
  }

  return response.json();
}
```

- [ ] **Step 4: Run tests to confirm passing**

```bash
pnpm jest src/lib/api.test.ts --no-coverage 2>&1 | tail -10
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/mobile-instore-app/src/lib/
git commit -m "feat(mobile): add apiFetch wrapper with sync secret header"
```

---

## Task 10: Sync wrapper

**Files:**
- Create: `apps/mobile-instore-app/src/db/sync.ts`

Wraps WatermelonDB's `synchronize()` with the correct pull/push shapes to match the existing `/api/sync` endpoint. Persists `lastPulledAt` in MMKV so it survives app restarts.

- [ ] **Step 1: Create sync.ts**

Create `apps/mobile-instore-app/src/db/sync.ts`:

```typescript
import { synchronize } from '@nozbe/watermelondb/sync';
import { MMKV } from 'react-native-mmkv';
import { database } from './database';
import { apiFetch } from '../lib/api';
import { loadSession } from '../store/auth';

const storage = new MMKV({ id: 'sync-storage' });
const LAST_PULLED_AT_KEY = 'last_pulled_at';

function getLastPulledAt(): number {
  return storage.getNumber(LAST_PULLED_AT_KEY) ?? 0;
}

function setLastPulledAt(timestamp: number): void {
  storage.set(LAST_PULLED_AT_KEY, timestamp);
}

interface SyncChanges {
  walk_ins?: { created: unknown[]; updated: unknown[]; deleted: string[] };
  appointments?: { created: unknown[]; updated: unknown[]; deleted: string[] };
}

interface PullResponse {
  changes: SyncChanges;
  timestamp: number;
}

export async function syncDatabase(): Promise<void> {
  const session = await loadSession();
  if (!session) return;

  const lastPulledAt = getLastPulledAt();

  await synchronize({
    database,
    pullChanges: async ({ lastPulledAt: wmlLastPulledAt }) => {
      const since = wmlLastPulledAt ?? lastPulledAt;
      const data = await apiFetch(
        `/api/sync?tenant_id=${session.tenant_id}&last_pulled_at=${since}`
      ) as PullResponse;
      return { changes: data.changes, timestamp: data.timestamp };
    },
    pushChanges: async ({ changes, lastPulledAt: pushedAt }) => {
      await apiFetch('/api/sync', {
        method: 'POST',
        body: JSON.stringify({
          changes,
          tenantId: session.tenant_id,
          lastPulledAt: pushedAt,
        }),
      });
      setLastPulledAt(Date.now());
    },
  });
}

export function clearSyncState(): void {
  storage.delete(LAST_PULLED_AT_KEY);
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/mobile-instore-app/src/db/sync.ts
git commit -m "feat(mobile): add WatermelonDB sync wrapper for /api/sync"
```

---

## Task 11: Root layout + auth gate

**Files:**
- Create: `apps/mobile-instore-app/app/_layout.tsx`

On mount, loads the session from secure store. If session exists → redirect to `/(app)/queue`; if not → redirect to `/(auth)`. Also triggers a background sync when navigating to `(app)`.

- [ ] **Step 1: Create root layout**

Create `apps/mobile-instore-app/app/_layout.tsx`:

```typescript
import { useEffect, useState } from 'react';
import { Stack, router } from 'expo-router';
import { loadSession } from '@/store/auth';

export default function RootLayout() {
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    loadSession().then((session) => {
      if (session) {
        router.replace('/(app)/queue');
      } else {
        router.replace('/(auth)');
      }
      setChecked(true);
    });
  }, []);

  if (!checked) return null;

  return (
    <Stack screenOptions={{ headerShown: false }} />
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/mobile-instore-app/app/_layout.tsx
git commit -m "feat(mobile): add root layout with auth gate"
```

---

## Task 12: Store code auth screen

**Files:**
- Create: `apps/mobile-instore-app/app/(auth)/index.tsx`

Single screen: Top 10 Prom logo text, store code input field, Sign In button. On submit calls `POST /api/mobile/auth`, saves session, navigates to queue. Shows inline errors for invalid code or network failure.

- [ ] **Step 1: Create the auth screen**

Create `apps/mobile-instore-app/app/(auth)/index.tsx`:

```typescript
import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { router } from 'expo-router';
import { saveSession, type AuthSession } from '@/store/auth';

const BASE_URL = process.env['EXPO_PUBLIC_API_URL'] ?? 'http://localhost:3000';

export default function AuthScreen() {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSignIn() {
    if (!code.trim()) {
      setError('Please enter your store code.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${BASE_URL}/api/mobile/auth`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ store_code: code.trim().toUpperCase() }),
      });
      if (response.status === 401) {
        setError('Code not recognised — check with your manager.');
        return;
      }
      if (!response.ok) {
        setError("Couldn't reach server — check Wi-Fi and try again.");
        return;
      }
      const session = await response.json() as AuthSession;
      await saveSession(session);
      router.replace('/(app)/queue');
    } catch {
      setError("Couldn't reach server — check Wi-Fi and try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Text style={styles.logo}>TOP 10 PROM</Text>
      <Text style={styles.subtitle}>In-Store Staff App</Text>

      <TextInput
        style={[styles.input, error ? styles.inputError : null]}
        placeholder="Store Code"
        placeholderTextColor="#666"
        autoCapitalize="characters"
        autoCorrect={false}
        value={code}
        onChangeText={(t) => { setCode(t); setError(null); }}
        onSubmitEditing={handleSignIn}
        returnKeyType="go"
      />

      {error && <Text style={styles.errorText}>{error}</Text>}

      <TouchableOpacity
        style={[styles.button, loading && styles.buttonDisabled]}
        onPress={handleSignIn}
        disabled={loading}
      >
        {loading
          ? <ActivityIndicator color="#fff" />
          : <Text style={styles.buttonText}>Sign In</Text>
        }
      </TouchableOpacity>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1, backgroundColor: '#0B0A0E', alignItems: 'center', justifyContent: 'center', padding: 32,
  },
  logo: { fontSize: 28, fontWeight: '700', color: '#fff', letterSpacing: 4, marginBottom: 8 },
  subtitle: { fontSize: 14, color: '#888', marginBottom: 48 },
  input: {
    width: '100%', height: 52, borderWidth: 1, borderColor: '#333', borderRadius: 8,
    paddingHorizontal: 16, color: '#fff', fontSize: 18, letterSpacing: 4,
    backgroundColor: '#1A1A1F', textAlign: 'center',
  },
  inputError: { borderColor: '#FF4444' },
  errorText: { color: '#FF4444', fontSize: 13, marginTop: 8, textAlign: 'center' },
  button: {
    marginTop: 24, width: '100%', height: 52, backgroundColor: '#8B5CF6',
    borderRadius: 8, alignItems: 'center', justifyContent: 'center',
  },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
```

- [ ] **Step 2: Commit**

```bash
git add apps/mobile-instore-app/app/(auth)/
git commit -m "feat(mobile): add store code auth screen"
```

---

## Task 13: Tab navigator layout

**Files:**
- Create: `apps/mobile-instore-app/app/(app)/_layout.tsx`

Two bottom tabs: Queue (default) and VTO. Also wires up the foreground sync trigger and NetInfo for the offline banner.

- [ ] **Step 1: Create the tab layout**

Create `apps/mobile-instore-app/app/(app)/_layout.tsx`:

```typescript
import { useEffect } from 'react';
import { Tabs } from 'expo-router';
import { AppState, type AppStateStatus } from 'react-native';
import { syncDatabase } from '@/db/sync';

function useForegroundSync() {
  useEffect(() => {
    syncDatabase().catch(console.warn);
    const sub = AppState.addEventListener('change', (state: AppStateStatus) => {
      if (state === 'active') syncDatabase().catch(console.warn);
    });
    return () => sub.remove();
  }, []);
}

export default function AppLayout() {
  useForegroundSync();

  return (
    <Tabs
      screenOptions={{
        tabBarStyle: { backgroundColor: '#0B0A0E', borderTopColor: '#1A1A1F' },
        tabBarActiveTintColor: '#8B5CF6',
        tabBarInactiveTintColor: '#666',
        headerShown: false,
      }}
    >
      <Tabs.Screen
        name="queue"
        options={{ title: 'Queue', tabBarLabel: 'Queue' }}
      />
      <Tabs.Screen
        name="vto"
        options={{ title: 'VTO', tabBarLabel: 'VTO' }}
      />
    </Tabs>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/mobile-instore-app/app/(app)/_layout.tsx
git commit -m "feat(mobile): add tab navigator with foreground sync"
```

---

## Task 14: Queue screen

**Files:**
- Create: `apps/mobile-instore-app/app/(app)/queue/index.tsx`

Observes WatermelonDB walk_ins (active statuses) and appointments (today), renders two sections, shows offline banner, and hosts the WalkInSheet bottom sheet.

- [ ] **Step 1: Create the queue screen**

Create `apps/mobile-instore-app/app/(app)/queue/index.tsx`:

```typescript
import { useState, useEffect } from 'react';
import {
  View, Text, SectionList, TouchableOpacity, StyleSheet,
  SafeAreaView,
} from 'react-native';
import { router } from 'expo-router';
import { withObservables } from '@nozbe/with-observables';
import NetInfo from '@react-native-community/netinfo';
import { database } from '@/db/database';
import WalkIn from '@/db/models/WalkIn';
import Appointment from '@/db/models/Appointment';
import { Q } from '@nozbe/watermelondb';
import WalkInSheet from '@/components/WalkInSheet';

// ── Status badge colours ──────────────────────────────────────────────────────
const STATUS_COLORS: Record<string, string> = {
  waiting: '#F59E0B',
  called: '#3B82F6',
  with_stylist: '#10B981',
  completed: '#6B7280',
  left: '#6B7280',
  pending: '#F59E0B',
  confirmed: '#10B981',
  in_progress: '#3B82F6',
};

// ── Row components ────────────────────────────────────────────────────────────
function WalkInRow({ item, onPress }: { item: WalkIn; onPress: () => void }) {
  const waited = Math.floor((Date.now() - item.checkedInAt.getTime()) / 60000);
  return (
    <TouchableOpacity style={styles.row} onPress={onPress}>
      <View style={styles.rowLeft}>
        <Text style={styles.rowName}>{item.customerName}</Text>
        <Text style={styles.rowMeta}>Party of {item.partySize} · {waited}m wait</Text>
      </View>
      <View style={[styles.badge, { backgroundColor: STATUS_COLORS[item.status] ?? '#666' }]}>
        <Text style={styles.badgeText}>{item.status.replace('_', ' ')}</Text>
      </View>
    </TouchableOpacity>
  );
}

function AppointmentRow({ item }: { item: Appointment }) {
  const time = item.appointmentDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  return (
    <View style={styles.row}>
      <View style={styles.rowLeft}>
        <Text style={styles.rowName}>{item.confirmationCode}</Text>
        <Text style={styles.rowMeta}>{time} · {item.serviceType}</Text>
      </View>
      <View style={[styles.badge, { backgroundColor: STATUS_COLORS[item.status] ?? '#666' }]}>
        <Text style={styles.badgeText}>{item.status}</Text>
      </View>
    </View>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────
interface Props {
  walkIns: WalkIn[];
  appointments: Appointment[];
}

function QueueScreen({ walkIns, appointments }: Props) {
  const [isOnline, setIsOnline] = useState(true);
  const [selectedWalkIn, setSelectedWalkIn] = useState<WalkIn | null>(null);

  useEffect(() => {
    const unsub = NetInfo.addEventListener((state) => {
      setIsOnline(state.isConnected ?? true);
    });
    return () => unsub();
  }, []);

  const sections = [
    { title: 'Walk-Ins', data: walkIns },
    { title: "Today's Appointments", data: appointments },
  ];

  return (
    <SafeAreaView style={styles.container}>
      {!isOnline && (
        <View style={styles.offlineBanner}>
          <Text style={styles.offlineText}>Offline — changes will sync when connected</Text>
        </View>
      )}

      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id}
        renderSectionHeader={({ section }) => (
          <Text style={styles.sectionHeader}>{section.title}</Text>
        )}
        renderItem={({ item, section }) =>
          section.title === 'Walk-Ins'
            ? <WalkInRow item={item as WalkIn} onPress={() => setSelectedWalkIn(item as WalkIn)} />
            : <AppointmentRow item={item as Appointment} />
        }
        ListEmptyComponent={<Text style={styles.emptyText}>Queue is empty</Text>}
        contentContainerStyle={{ paddingBottom: 100 }}
      />

      {/* FAB */}
      <TouchableOpacity style={styles.fab} onPress={() => router.push('/(app)/queue/check-in')}>
        <Text style={styles.fabText}>+ Check In</Text>
      </TouchableOpacity>

      {selectedWalkIn && (
        <WalkInSheet
          walkIn={selectedWalkIn}
          onClose={() => setSelectedWalkIn(null)}
        />
      )}
    </SafeAreaView>
  );
}

// ── WatermelonDB observer ─────────────────────────────────────────────────────
const todayStart = new Date();
todayStart.setHours(0, 0, 0, 0);
const todayEnd = new Date();
todayEnd.setHours(23, 59, 59, 999);

const enhance = withObservables([], () => ({
  walkIns: database
    .get<WalkIn>('walk_ins')
    .query(Q.where('status', Q.oneOf(['waiting', 'called', 'with_stylist'])))
    .observe(),
  appointments: database
    .get<Appointment>('appointments')
    .query(
      Q.where('status', Q.oneOf(['pending', 'confirmed', 'in_progress'])),
      Q.where('appointment_date', Q.between(todayStart.getTime(), todayEnd.getTime()))
    )
    .observe(),
}));

export default enhance(QueueScreen);

// ── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0B0A0E' },
  offlineBanner: { backgroundColor: '#7C3AED', paddingVertical: 6, alignItems: 'center' },
  offlineText: { color: '#fff', fontSize: 12 },
  sectionHeader: { color: '#888', fontSize: 12, fontWeight: '700', paddingHorizontal: 16, paddingVertical: 8, backgroundColor: '#0B0A0E', letterSpacing: 1, textTransform: 'uppercase' },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#1A1A1F' },
  rowLeft: { flex: 1 },
  rowName: { color: '#fff', fontSize: 16, fontWeight: '600' },
  rowMeta: { color: '#888', fontSize: 13, marginTop: 2 },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  badgeText: { color: '#fff', fontSize: 11, fontWeight: '700', textTransform: 'capitalize' },
  emptyText: { color: '#555', textAlign: 'center', paddingTop: 60, fontSize: 15 },
  fab: { position: 'absolute', bottom: 24, right: 24, backgroundColor: '#8B5CF6', paddingHorizontal: 20, paddingVertical: 14, borderRadius: 32, elevation: 4 },
  fabText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
```

- [ ] **Step 2: Commit**

```bash
git add apps/mobile-instore-app/app/(app)/queue/index.tsx
git commit -m "feat(mobile): add queue screen with WatermelonDB observer"
```

---

## Task 15: Walk-in bottom sheet

**Files:**
- Create: `apps/mobile-instore-app/src/components/WalkInSheet.tsx`

Bottom sheet shown when a walk-in row is tapped. Displays status progression buttons, stylist picker (loaded from session), and "Convert to Appointment" action. Updates WatermelonDB locally, triggers sync.

- [ ] **Step 1: Create WalkInSheet component**

Create `apps/mobile-instore-app/src/components/WalkInSheet.tsx`:

```typescript
import { useState } from 'react';
import {
  View, Text, TouchableOpacity, Modal, StyleSheet,
  ScrollView, ActivityIndicator,
} from 'react-native';
import { database } from '@/db/database';
import WalkIn, { type WalkInStatus } from '@/db/models/WalkIn';
import { loadSession } from '@/store/auth';
import { syncDatabase } from '@/db/sync';
import ConvertModal from './ConvertModal';

interface Props {
  walkIn: WalkIn;
  onClose: () => void;
}

const STATUS_ACTIONS: { label: string; next: WalkInStatus; color: string }[] = [
  { label: 'Call Customer', next: 'called', color: '#3B82F6' },
  { label: 'Seat with Stylist', next: 'with_stylist', color: '#10B981' },
  { label: 'Mark Completed', next: 'completed', color: '#6B7280' },
  { label: 'Mark Left', next: 'left', color: '#EF4444' },
];

export default function WalkInSheet({ walkIn, onClose }: Props) {
  const [loading, setLoading] = useState(false);
  const [showConvert, setShowConvert] = useState(false);
  const [stylists, setStylists] = useState<{ id: string; name: string }[]>([]);

  // Load stylists from session on mount
  useState(() => {
    loadSession().then((s) => setStylists(s?.stylists ?? []));
  });

  async function updateStatus(status: WalkInStatus) {
    setLoading(true);
    try {
      await database.write(async () => {
        await walkIn.update((w) => { w.status = status; });
      });
      syncDatabase().catch(console.warn);
      onClose();
    } finally {
      setLoading(false);
    }
  }

  async function assignStylist(stylistId: string) {
    await database.write(async () => {
      await walkIn.update((w) => { w.assignedStylistId = stylistId; });
    });
    syncDatabase().catch(console.warn);
  }

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />
      <View style={styles.sheet}>
        <View style={styles.handle} />
        <Text style={styles.name}>{walkIn.customerName}</Text>
        <Text style={styles.meta}>Party of {walkIn.partySize} · {walkIn.phoneNumber}</Text>

        <ScrollView showsVerticalScrollIndicator={false}>
          <Text style={styles.sectionLabel}>UPDATE STATUS</Text>
          {STATUS_ACTIONS.map((action) => (
            <TouchableOpacity
              key={action.next}
              style={[styles.actionBtn, { borderColor: action.color }]}
              onPress={() => updateStatus(action.next)}
              disabled={loading}
            >
              {loading
                ? <ActivityIndicator color={action.color} />
                : <Text style={[styles.actionText, { color: action.color }]}>{action.label}</Text>
              }
            </TouchableOpacity>
          ))}

          {stylists.length > 0 && (
            <>
              <Text style={styles.sectionLabel}>ASSIGN STYLIST</Text>
              {stylists.map((s) => (
                <TouchableOpacity
                  key={s.id}
                  style={[
                    styles.actionBtn,
                    walkIn.assignedStylistId === s.id && styles.actionBtnActive,
                  ]}
                  onPress={() => assignStylist(s.id)}
                >
                  <Text style={styles.actionText}>{s.name}</Text>
                </TouchableOpacity>
              ))}
            </>
          )}

          <TouchableOpacity
            style={[styles.actionBtn, { borderColor: '#8B5CF6' }]}
            onPress={() => setShowConvert(true)}
          >
            <Text style={[styles.actionText, { color: '#8B5CF6' }]}>Convert to Appointment →</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>

      {showConvert && (
        <ConvertModal
          walkIn={walkIn}
          stylists={stylists}
          onSuccess={() => { setShowConvert(false); onClose(); }}
          onClose={() => setShowConvert(false)}
        />
      )}
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' },
  sheet: {
    backgroundColor: '#111116', borderTopLeftRadius: 20, borderTopRightRadius: 20,
    padding: 24, maxHeight: '70%',
  },
  handle: { width: 40, height: 4, backgroundColor: '#333', borderRadius: 2, alignSelf: 'center', marginBottom: 20 },
  name: { color: '#fff', fontSize: 20, fontWeight: '700' },
  meta: { color: '#888', fontSize: 14, marginTop: 4, marginBottom: 20 },
  sectionLabel: { color: '#555', fontSize: 11, fontWeight: '700', letterSpacing: 1, marginBottom: 8, marginTop: 8 },
  actionBtn: { borderWidth: 1, borderColor: '#333', borderRadius: 8, paddingVertical: 14, paddingHorizontal: 16, marginBottom: 8, alignItems: 'center' },
  actionBtnActive: { borderColor: '#8B5CF6', backgroundColor: '#1E1028' },
  actionText: { color: '#ccc', fontSize: 15, fontWeight: '600' },
});
```

- [ ] **Step 2: Commit**

```bash
git add apps/mobile-instore-app/src/components/WalkInSheet.tsx
git commit -m "feat(mobile): add WalkInSheet bottom sheet for status actions"
```

---

## Task 16: Convert to appointment modal

**Files:**
- Create: `apps/mobile-instore-app/src/components/ConvertModal.tsx`

Full-screen modal for converting a walk-in to a confirmed appointment. POSTs to `/api/mobile/convert-walkin`. Not optimistic — shows error inline if it fails.

- [ ] **Step 1: Create ConvertModal**

Create `apps/mobile-instore-app/src/components/ConvertModal.tsx`:

```typescript
import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, Modal, StyleSheet,
  ScrollView, ActivityIndicator, Platform,
} from 'react-native';
import WalkIn from '@/db/models/WalkIn';
import { apiFetch } from '@/lib/api';
import { syncDatabase } from '@/db/sync';

interface Stylist { id: string; name: string }

interface Props {
  walkIn: WalkIn;
  stylists: Stylist[];
  onSuccess: () => void;
  onClose: () => void;
}

export default function ConvertModal({ walkIn, stylists, onSuccess, onClose }: Props) {
  const [serviceType, setServiceType] = useState('');
  const [durationMinutes, setDurationMinutes] = useState(60);
  const [selectedStylistId, setSelectedStylistId] = useState<string | null>(null);
  const [appointmentDate] = useState(new Date()); // default: now
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleConvert() {
    if (!serviceType.trim()) { setError('Service type is required.'); return; }
    setLoading(true);
    setError(null);
    try {
      await apiFetch('/api/mobile/convert-walkin', {
        method: 'POST',
        body: JSON.stringify({
          walk_in_id: walkIn.id,
          appointment_date: appointmentDate.toISOString(),
          duration_minutes: durationMinutes,
          service_type: serviceType.trim(),
          stylist_id: selectedStylistId ?? undefined,
        }),
      });
      syncDatabase().catch(console.warn);
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Conversion failed. Try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.modal}>
          <Text style={styles.title}>Convert to Appointment</Text>
          <Text style={styles.subtitle}>{walkIn.customerName}</Text>

          <ScrollView showsVerticalScrollIndicator={false}>
            <Text style={styles.label}>Service Type</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. Dress fitting"
              placeholderTextColor="#555"
              value={serviceType}
              onChangeText={(t) => { setServiceType(t); setError(null); }}
            />

            <Text style={styles.label}>Duration</Text>
            <View style={styles.stepper}>
              <TouchableOpacity style={styles.stepBtn} onPress={() => setDurationMinutes(Math.max(15, durationMinutes - 15))}>
                <Text style={styles.stepBtnText}>−</Text>
              </TouchableOpacity>
              <Text style={styles.stepValue}>{durationMinutes} min</Text>
              <TouchableOpacity style={styles.stepBtn} onPress={() => setDurationMinutes(durationMinutes + 15)}>
                <Text style={styles.stepBtnText}>+</Text>
              </TouchableOpacity>
            </View>

            {stylists.length > 0 && (
              <>
                <Text style={styles.label}>Assign Stylist</Text>
                {stylists.map((s) => (
                  <TouchableOpacity
                    key={s.id}
                    style={[styles.stylistBtn, selectedStylistId === s.id && styles.stylistBtnActive]}
                    onPress={() => setSelectedStylistId(s.id)}
                  >
                    <Text style={styles.stylistText}>{s.name}</Text>
                  </TouchableOpacity>
                ))}
              </>
            )}

            {error && <Text style={styles.errorText}>{error}</Text>}

            <TouchableOpacity
              style={[styles.confirmBtn, loading && styles.confirmBtnDisabled]}
              onPress={handleConvert}
              disabled={loading}
            >
              {loading
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.confirmBtnText}>Confirm Appointment</Text>
              }
            </TouchableOpacity>

            <TouchableOpacity style={styles.cancelBtn} onPress={onClose} disabled={loading}>
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'center', padding: 20 },
  modal: { backgroundColor: '#111116', borderRadius: 16, padding: 24, maxHeight: '80%' },
  title: { color: '#fff', fontSize: 20, fontWeight: '700' },
  subtitle: { color: '#888', fontSize: 14, marginBottom: 20, marginTop: 4 },
  label: { color: '#888', fontSize: 12, fontWeight: '700', letterSpacing: 1, marginBottom: 6, marginTop: 16, textTransform: 'uppercase' },
  input: { borderWidth: 1, borderColor: '#333', borderRadius: 8, paddingHorizontal: 14, paddingVertical: 12, color: '#fff', fontSize: 15, backgroundColor: '#0B0A0E' },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  stepBtn: { width: 40, height: 40, borderRadius: 8, borderWidth: 1, borderColor: '#333', alignItems: 'center', justifyContent: 'center' },
  stepBtnText: { color: '#fff', fontSize: 20 },
  stepValue: { color: '#fff', fontSize: 16, fontWeight: '600', minWidth: 70, textAlign: 'center' },
  stylistBtn: { borderWidth: 1, borderColor: '#333', borderRadius: 8, paddingVertical: 12, paddingHorizontal: 14, marginBottom: 6 },
  stylistBtnActive: { borderColor: '#8B5CF6', backgroundColor: '#1E1028' },
  stylistText: { color: '#ccc', fontSize: 15 },
  errorText: { color: '#FF4444', fontSize: 13, marginTop: 12, textAlign: 'center' },
  confirmBtn: { marginTop: 20, backgroundColor: '#8B5CF6', borderRadius: 8, paddingVertical: 14, alignItems: 'center' },
  confirmBtnDisabled: { opacity: 0.5 },
  confirmBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  cancelBtn: { marginTop: 10, paddingVertical: 14, alignItems: 'center' },
  cancelBtnText: { color: '#888', fontSize: 15 },
});
```

- [ ] **Step 2: Commit**

```bash
git add apps/mobile-instore-app/src/components/ConvertModal.tsx
git commit -m "feat(mobile): add ConvertModal for walk-in to appointment conversion"
```

---

## Task 17: Check-in form screen

**Files:**
- Create: `apps/mobile-instore-app/app/(app)/queue/check-in.tsx`

Full-screen form for checking in a walk-in customer. Writes to WatermelonDB optimistically and triggers background sync.

- [ ] **Step 1: Create check-in screen**

Create `apps/mobile-instore-app/app/(app)/queue/check-in.tsx`:

```typescript
import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, SafeAreaView, ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { Q } from '@nozbe/watermelondb';
import { database } from '@/db/database';
import WalkIn from '@/db/models/WalkIn';
import { loadSession } from '@/store/auth';
import { syncDatabase } from '@/db/sync';

const OCCASIONS = ['prom', 'wedding', 'bridesmaid', 'homecoming', 'pageant', 'cocktail'] as const;
type Occasion = typeof OCCASIONS[number];

export default function CheckInScreen() {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [partySize, setPartySize] = useState(1);
  const [occasion, setOccasion] = useState<Occasion | null>(null);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  function validate(): boolean {
    const e: Record<string, string> = {};
    if (!name.trim()) e['name'] = 'Name is required.';
    if (!phone.trim()) e['phone'] = 'Phone number is required.';
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSubmit() {
    if (!validate()) return;
    setLoading(true);
    try {
      const session = await loadSession();
      if (!session) { router.replace('/(auth)'); return; }

      // Determine next queue position
      const existing = await database.get<WalkIn>('walk_ins')
        .query(Q.where('status', Q.oneOf(['waiting', 'called', 'with_stylist'])))
        .fetch();
      const nextPosition = existing.length > 0
        ? Math.max(...existing.map((w) => w.queuePosition)) + 1
        : 1;

      await database.write(async () => {
        await database.get<WalkIn>('walk_ins').create((w) => {
          w._raw.id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
          w.tenantId = session.tenant_id;
          w.customerName = name.trim();
          w.phoneNumber = phone.trim();
          w.partySize = partySize;
          w.occasion = occasion;
          w.notes = notes.trim() || null;
          w.status = 'waiting';
          w.queuePosition = nextPosition;
          w.checkedInAt = new Date();
        });
      });

      syncDatabase().catch(console.warn);
      router.back();
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backText}>Cancel</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Check In</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView contentContainerStyle={styles.form}>
        <Text style={styles.label}>Customer Name *</Text>
        <TextInput
          style={[styles.input, errors['name'] && styles.inputError]}
          placeholder="Full name"
          placeholderTextColor="#555"
          value={name}
          onChangeText={(t) => { setName(t); setErrors((e) => ({ ...e, name: '' })); }}
        />
        {errors['name'] && <Text style={styles.errorText}>{errors['name']}</Text>}

        <Text style={styles.label}>Phone Number *</Text>
        <TextInput
          style={[styles.input, errors['phone'] && styles.inputError]}
          placeholder="(555) 000-0000"
          placeholderTextColor="#555"
          keyboardType="phone-pad"
          value={phone}
          onChangeText={(t) => { setPhone(t); setErrors((e) => ({ ...e, phone: '' })); }}
        />
        {errors['phone'] && <Text style={styles.errorText}>{errors['phone']}</Text>}

        <Text style={styles.label}>Party Size</Text>
        <View style={styles.stepper}>
          <TouchableOpacity style={styles.stepBtn} onPress={() => setPartySize(Math.max(1, partySize - 1))}>
            <Text style={styles.stepBtnText}>−</Text>
          </TouchableOpacity>
          <Text style={styles.stepValue}>{partySize}</Text>
          <TouchableOpacity style={styles.stepBtn} onPress={() => setPartySize(partySize + 1)}>
            <Text style={styles.stepBtnText}>+</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.label}>Occasion</Text>
        <View style={styles.occasionGrid}>
          {OCCASIONS.map((o) => (
            <TouchableOpacity
              key={o}
              style={[styles.occasionBtn, occasion === o && styles.occasionBtnActive]}
              onPress={() => setOccasion(occasion === o ? null : o)}
            >
              <Text style={[styles.occasionText, occasion === o && styles.occasionTextActive]}>
                {o.charAt(0).toUpperCase() + o.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.label}>Notes (optional)</Text>
        <TextInput
          style={[styles.input, styles.notesInput]}
          placeholder="Any special notes..."
          placeholderTextColor="#555"
          multiline
          numberOfLines={3}
          value={notes}
          onChangeText={setNotes}
        />

        <TouchableOpacity
          style={[styles.submitBtn, loading && styles.submitBtnDisabled]}
          onPress={handleSubmit}
          disabled={loading}
        >
          {loading
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.submitBtnText}>Add to Queue</Text>
          }
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0B0A0E' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#1A1A1F' },
  backText: { color: '#8B5CF6', fontSize: 16, width: 60 },
  title: { color: '#fff', fontSize: 18, fontWeight: '700' },
  form: { padding: 20, paddingBottom: 60 },
  label: { color: '#888', fontSize: 12, fontWeight: '700', letterSpacing: 1, marginBottom: 8, marginTop: 20, textTransform: 'uppercase' },
  input: { borderWidth: 1, borderColor: '#333', borderRadius: 8, paddingHorizontal: 14, paddingVertical: 13, color: '#fff', fontSize: 16, backgroundColor: '#111116' },
  inputError: { borderColor: '#FF4444' },
  errorText: { color: '#FF4444', fontSize: 12, marginTop: 4 },
  notesInput: { height: 80, textAlignVertical: 'top' },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 20 },
  stepBtn: { width: 44, height: 44, borderRadius: 8, borderWidth: 1, borderColor: '#333', alignItems: 'center', justifyContent: 'center' },
  stepBtnText: { color: '#fff', fontSize: 22 },
  stepValue: { color: '#fff', fontSize: 24, fontWeight: '700', minWidth: 40, textAlign: 'center' },
  occasionGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  occasionBtn: { borderWidth: 1, borderColor: '#333', borderRadius: 20, paddingHorizontal: 16, paddingVertical: 8 },
  occasionBtnActive: { borderColor: '#8B5CF6', backgroundColor: '#1E1028' },
  occasionText: { color: '#888', fontSize: 14 },
  occasionTextActive: { color: '#8B5CF6' },
  submitBtn: { marginTop: 32, backgroundColor: '#8B5CF6', borderRadius: 10, paddingVertical: 16, alignItems: 'center' },
  submitBtnDisabled: { opacity: 0.5 },
  submitBtnText: { color: '#fff', fontSize: 17, fontWeight: '700' },
});
```

- [ ] **Step 2: Commit**

```bash
git add apps/mobile-instore-app/app/(app)/queue/check-in.tsx
git commit -m "feat(mobile): add walk-in check-in form screen"
```

---

## Task 18: VTO capture screen

**Files:**
- Create: `apps/mobile-instore-app/app/(app)/vto/index.tsx`

Camera preview (top half), dress ID + color name inputs + barcode scan button (bottom half). On capture, encodes image as base64, POSTs to `/api/vto/initiate`. Shows inline status card (`queued → processing → completed`) with output image.

- [ ] **Step 1: Create the VTO screen**

Create `apps/mobile-instore-app/app/(app)/vto/index.tsx`:

```typescript
import { useState, useRef, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  SafeAreaView, ActivityIndicator, Image, ScrollView,
} from 'react-native';
import { CameraView, useCameraPermissions, BarcodeScanningResult } from 'expo-camera';
import NetInfo from '@react-native-community/netinfo';
import { apiFetch } from '@/lib/api';
import { loadSession } from '@/store/auth';

type VtoStatus = 'idle' | 'submitting' | 'queued' | 'processing' | 'completed' | 'failed';

interface VtoResult {
  session_id: string;
  status: VtoStatus;
  output_image_url?: string;
  error_message?: string;
}

export default function VtoScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const [isScanMode, setIsScanMode] = useState(false);
  const [dressId, setDressId] = useState('');
  const [colorName, setColorName] = useState('');
  const [vtoStatus, setVtoStatus] = useState<VtoStatus>('idle');
  const [result, setResult] = useState<VtoResult | null>(null);
  const [isOnline, setIsOnline] = useState(true);
  const cameraRef = useRef<CameraView>(null);

  useEffect(() => {
    const unsub = NetInfo.addEventListener((s) => setIsOnline(s.isConnected ?? true));
    return () => unsub();
  }, []);

  function handleBarcodeScan({ data }: BarcodeScanningResult) {
    setDressId(data);
    setIsScanMode(false);
  }

  async function handleCaptureAndSend() {
    if (!isOnline) {
      alert('VTO requires an internet connection.');
      return;
    }
    if (!dressId.trim() || !colorName.trim()) return;
    if (!cameraRef.current) return;

    setVtoStatus('submitting');
    try {
      const photo = await cameraRef.current.takePictureAsync({ base64: true, quality: 0.7 });
      if (!photo?.base64) throw new Error('Failed to capture image');

      const session = await loadSession();
      setVtoStatus('queued');

      const response = await apiFetch('/api/vto/initiate', {
        method: 'POST',
        body: JSON.stringify({
          dress_id: dressId.trim(),
          color_name: colorName.trim(),
          image_base64: photo.base64,
          tenant_id: session?.tenant_id ?? undefined,
        }),
      }) as { session_id: string; channel_id: string };

      setResult({ session_id: response.session_id, status: 'queued' });
      pollVtoStatus(response.session_id);
    } catch (err) {
      setVtoStatus('failed');
      setResult({ session_id: '', status: 'failed', error_message: err instanceof Error ? err.message : 'Capture failed' });
    }
  }

  async function pollVtoStatus(sessionId: string) {
    setVtoStatus('processing');
    // Poll every 3 seconds for up to 2 minutes
    const maxAttempts = 40;
    for (let i = 0; i < maxAttempts; i++) {
      await new Promise((r) => setTimeout(r, 3000));
      try {
        const data = await apiFetch(`/api/vto/status/${sessionId}`) as VtoResult;
        setResult(data);
        if (data.status === 'completed' || data.status === 'failed') {
          setVtoStatus(data.status);
          return;
        }
      } catch {
        // Continue polling on error
      }
    }
    setVtoStatus('failed');
    setResult((prev) => prev ? { ...prev, status: 'failed', error_message: 'Timed out waiting for result.' } : null);
  }

  function handleReset() {
    setVtoStatus('idle');
    setResult(null);
    setDressId('');
    setColorName('');
  }

  if (!permission) return <View style={styles.container} />;

  if (!permission.granted) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.permissionBox}>
          <Text style={styles.permissionText}>Camera access is required for VTO capture.</Text>
          <TouchableOpacity style={styles.permissionBtn} onPress={requestPermission}>
            <Text style={styles.permissionBtnText}>Grant Camera Access</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const canCapture = dressId.trim().length > 0 && colorName.trim().length > 0 && vtoStatus === 'idle';

  return (
    <SafeAreaView style={styles.container}>
      {/* Camera */}
      <View style={styles.cameraContainer}>
        <CameraView
          ref={cameraRef}
          style={styles.camera}
          facing="back"
          barcodeScannerSettings={isScanMode ? { barcodeTypes: ['qr', 'code128', 'code39', 'ean13'] } : undefined}
          onBarcodeScanned={isScanMode ? handleBarcodeScan : undefined}
        />
        {isScanMode && (
          <View style={styles.scanOverlay}>
            <Text style={styles.scanHint}>Point at dress barcode or QR tag</Text>
            <TouchableOpacity style={styles.cancelScan} onPress={() => setIsScanMode(false)}>
              <Text style={styles.cancelScanText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Controls */}
      <ScrollView style={styles.controls} keyboardShouldPersistTaps="handled">
        {vtoStatus === 'idle' || vtoStatus === 'submitting' ? (
          <>
            <Text style={styles.label}>Dress ID</Text>
            <View style={styles.dressIdRow}>
              <TextInput
                style={[styles.input, { flex: 1, marginRight: 8 }]}
                placeholder="Enter or scan ID"
                placeholderTextColor="#555"
                value={dressId}
                onChangeText={setDressId}
                autoCapitalize="characters"
              />
              <TouchableOpacity style={styles.scanBtn} onPress={() => setIsScanMode(true)}>
                <Text style={styles.scanBtnText}>Scan</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.label}>Color Name</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. Midnight Blue"
              placeholderTextColor="#555"
              value={colorName}
              onChangeText={setColorName}
            />

            <TouchableOpacity
              style={[styles.captureBtn, !canCapture && styles.captureBtnDisabled]}
              onPress={handleCaptureAndSend}
              disabled={!canCapture}
            >
              {vtoStatus === 'submitting'
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.captureBtnText}>Capture & Send</Text>
              }
            </TouchableOpacity>
          </>
        ) : (
          <View style={styles.statusCard}>
            <Text style={styles.statusLabel}>
              {vtoStatus === 'queued' && '⏳ Queued for processing…'}
              {vtoStatus === 'processing' && '⚙️ Generating VTO image…'}
              {vtoStatus === 'completed' && '✅ VTO Complete'}
              {vtoStatus === 'failed' && '❌ VTO Failed'}
            </Text>

            {vtoStatus === 'completed' && result?.output_image_url && (
              <Image
                source={{ uri: result.output_image_url }}
                style={styles.outputImage}
                resizeMode="contain"
              />
            )}

            {vtoStatus === 'failed' && (
              <Text style={styles.errorText}>{result?.error_message ?? 'Unknown error'}</Text>
            )}

            {(vtoStatus === 'completed' || vtoStatus === 'failed') && (
              <TouchableOpacity style={styles.resetBtn} onPress={handleReset}>
                <Text style={styles.resetBtnText}>
                  {vtoStatus === 'failed' ? 'Retry' : 'New Capture'}
                </Text>
              </TouchableOpacity>
            )}

            {(vtoStatus === 'queued' || vtoStatus === 'processing') && (
              <ActivityIndicator color="#8B5CF6" style={{ marginTop: 12 }} />
            )}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0B0A0E' },
  cameraContainer: { flex: 1, maxHeight: '50%', position: 'relative' },
  camera: { flex: 1 },
  scanOverlay: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'flex-end', paddingBottom: 20, backgroundColor: 'rgba(0,0,0,0.3)' },
  scanHint: { color: '#fff', fontSize: 14, marginBottom: 12 },
  cancelScan: { backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 20 },
  cancelScanText: { color: '#fff', fontSize: 14 },
  controls: { flex: 1, padding: 16 },
  label: { color: '#888', fontSize: 11, fontWeight: '700', letterSpacing: 1, marginBottom: 6, marginTop: 16, textTransform: 'uppercase' },
  dressIdRow: { flexDirection: 'row', alignItems: 'center' },
  input: { borderWidth: 1, borderColor: '#333', borderRadius: 8, paddingHorizontal: 14, paddingVertical: 12, color: '#fff', fontSize: 15, backgroundColor: '#111116' },
  scanBtn: { backgroundColor: '#1A1A1F', borderWidth: 1, borderColor: '#333', borderRadius: 8, paddingHorizontal: 16, paddingVertical: 12 },
  scanBtnText: { color: '#8B5CF6', fontWeight: '700', fontSize: 14 },
  captureBtn: { marginTop: 20, backgroundColor: '#8B5CF6', borderRadius: 10, paddingVertical: 16, alignItems: 'center' },
  captureBtnDisabled: { opacity: 0.35 },
  captureBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  statusCard: { backgroundColor: '#111116', borderRadius: 12, padding: 20, marginTop: 8, alignItems: 'center' },
  statusLabel: { color: '#fff', fontSize: 16, fontWeight: '600', marginBottom: 12 },
  outputImage: { width: '100%', height: 300, borderRadius: 8 },
  errorText: { color: '#FF4444', fontSize: 13, textAlign: 'center', marginBottom: 12 },
  resetBtn: { marginTop: 16, backgroundColor: '#8B5CF6', borderRadius: 8, paddingHorizontal: 24, paddingVertical: 12 },
  resetBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  permissionBox: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  permissionText: { color: '#888', fontSize: 15, textAlign: 'center', marginBottom: 24 },
  permissionBtn: { backgroundColor: '#8B5CF6', paddingHorizontal: 24, paddingVertical: 14, borderRadius: 8 },
  permissionBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
```

**Note:** The VTO status polling calls `GET /api/vto/status/:sessionId`. This route doesn't exist yet — it needs to be added to the web app. See the spec addendum below.

- [ ] **Step 2: Add GET /api/vto/status/[sessionId] route**

Create `apps/brand-network-web/src/app/api/vto/status/[sessionId]/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { db, vto_sessions } from '@toptenprom/database';
import { eq } from 'drizzle-orm';

function validateSyncSecret(request: NextRequest): boolean {
  const secret = request.headers.get('x-sync-secret');
  return !!secret && secret === process.env['MOBILE_SYNC_API_SECRET'];
}

export async function GET(
  request: NextRequest,
  { params }: { params: { sessionId: string } }
) {
  if (!validateSyncSecret(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const [session] = await db
    .select({
      id: vto_sessions.id,
      status: vto_sessions.status,
      output_image_url: vto_sessions.output_image_url,
      error_message: vto_sessions.error_message,
    })
    .from(vto_sessions)
    .where(eq(vto_sessions.id, params.sessionId))
    .limit(1);

  if (!session) {
    return NextResponse.json({ error: 'Session not found' }, { status: 404 });
  }

  return NextResponse.json({
    session_id: session.id,
    status: session.status,
    output_image_url: session.output_image_url ?? undefined,
    error_message: session.error_message ?? undefined,
  });
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/mobile-instore-app/app/(app)/vto/index.tsx apps/brand-network-web/src/app/api/vto/status/
git commit -m "feat(mobile): add VTO capture screen and GET /api/vto/status/[sessionId] route"
```

---

## Task 19: Typecheck and verify

- [ ] **Step 1: Typecheck mobile app**

```bash
cd /mnt/c/Users/tburg/Top10PromWebsite/top-10-prom-ecosystem/apps/mobile-instore-app
pnpm typecheck 2>&1
```

Expected: zero errors. Fix any type errors before continuing.

- [ ] **Step 2: Typecheck web app**

```bash
cd /mnt/c/Users/tburg/Top10PromWebsite/top-10-prom-ecosystem/apps/brand-network-web
pnpm typecheck 2>&1
```

Expected: zero errors.

- [ ] **Step 3: Confirm new API routes appear in the route tree**

```bash
find apps/brand-network-web/src/app/api/mobile -name "route.ts" && find apps/brand-network-web/src/app/api/vto/status -name "route.ts"
```

Expected output:
```
apps/brand-network-web/src/app/api/mobile/auth/route.ts
apps/brand-network-web/src/app/api/mobile/convert-walkin/route.ts
apps/brand-network-web/src/app/api/vto/status/[sessionId]/route.ts
```

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "feat(mobile): complete Expo in-store app scaffold — queue, check-in, VTO, conversion"
```

---

## Manual Testing Checklist

After running an EAS development build (`eas build --profile development --platform ios`):

- [ ] App opens to store code screen on first launch
- [ ] Invalid code shows inline error; valid code navigates to Queue tab
- [ ] Queue screen shows walk-ins and today's appointments in two sections
- [ ] Tapping a walk-in opens the bottom sheet with status actions
- [ ] Status change updates the row badge immediately (WatermelonDB observable)
- [ ] Offline banner appears when Wi-Fi is disabled; disappears on reconnect
- [ ] Check-in form validates required fields; submission adds row to queue immediately
- [ ] "Convert to Appointment" modal appears from the bottom sheet; confirm creates appointment
- [ ] VTO screen shows camera preview; barcode scan populates dress ID field
- [ ] "Capture & Send" is disabled until both dress ID and color name are filled
- [ ] VTO status card shows queued → processing → completed with output image

---

## Spec Notes

- `GET /api/vto/status/:sessionId` was not in the original spec but is required by the polling pattern. It has been added as part of Task 18.
- `appointments.customer_id` is now nullable to support walk-in conversions. This is a migration that must be applied before the convert-walkin route is used.
- Per-tenant `mobile_sync_secret` is returned from `/api/mobile/auth` but the `/api/sync` route still validates against the global `MOBILE_SYNC_API_SECRET` env var. Migrating sync auth to per-tenant secrets is a future improvement.
