import { db } from '@toptenprom/database';
import { tenants } from '@toptenprom/database';
import { eq } from 'drizzle-orm';

export type ResolvedTenant = typeof tenants.$inferSelect;

/**
 * `resolveTenant` — Looks up a boutique by its URL subdomain slug.
 *
 * ARCHITECTURE RULE: This function is always called inside a try/catch in layouts.
 * Returns null on any failure — never throws.
 */
export async function resolveTenant(subdomain: string): Promise<ResolvedTenant | null> {
  try {
    const result = await db
      .select()
      .from(tenants)
      .where(eq(tenants.subdomain, subdomain))
      .limit(1);

    return result[0] ?? null;
  } catch (error) {
    console.error(`[resolveTenant] Failed to resolve subdomain "${subdomain}":`, error);
    return null;
  }
}
