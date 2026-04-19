import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema.js';

// ─── LAZY-INITIALIZED DATABASE CLIENT ────────────────────────────────────────
// ARCHITECTURE RULE: The postgres connection is created LAZILY on first use.
// This prevents the Next.js build from hanging — during `next build`, modules
// are loaded for static analysis/prerendering but no DB should be contacted.

let _db: ReturnType<typeof drizzle<typeof schema>> | null = null;

function getDb() {
  if (_db) return _db;

  const databaseUrl = process.env['DATABASE_URL'];
  if (!databaseUrl) {
    // During `next build` the env may not be available.
    // Return null — the proxy will throw a clear error if 
    // a DB method is actually invoked at build time.
    return null;
  }

  // Transaction-mode pooler connection (port 6543 for Supabase)
  const poolClient = postgres(databaseUrl, {
    prepare: false, // Required for Supabase transaction-mode pooler
    connect_timeout: 10, // 10 second timeout — prevents infinite hangs
    idle_timeout: 20,
  });

  _db = drizzle(poolClient, {
    schema,
    logger: process.env['NODE_ENV'] === 'development',
  });

  return _db;
}

// Export a proxy that lazily initializes the connection on first access
export const db = new Proxy({} as ReturnType<typeof drizzle<typeof schema>>, {
  get(_target, prop, receiver) {
    // Allow typeof checks and Symbol.toStringTag without throwing
    if (typeof prop === 'symbol' || prop === 'then') return undefined;
    
    const realDb = getDb();
    if (!realDb) {
      throw new Error(
        `DATABASE_URL is not set. The database client cannot be used during build. ` +
        `Ensure .env.local is in the app directory or mark this route as dynamic.`
      );
    }
    const value = Reflect.get(realDb, prop, receiver);
    if (typeof value === 'function') {
      return value.bind(realDb);
    }
    return value;
  },
});

export type Database = ReturnType<typeof drizzle<typeof schema>>;

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
  role:
    | 'super_admin'
    | 'owner'
    | 'manager'
    | 'stylist'
    | 'receptionist'
    | 'customer',
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

