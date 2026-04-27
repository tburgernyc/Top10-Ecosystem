import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { db } from '@toptenprom/database';
import { boutique_staff, users } from '@toptenprom/database';
import { eq } from 'drizzle-orm';

export type CustomerSession = {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
};

/** Auth guard for customer-only pages — no staff role required. */
export async function requireCustomerSession(): Promise<CustomerSession> {
  const supabase = await createClient();
  let userId: string | null = null;

  try {
    const { data: { user }, error } = await supabase.auth.getUser();
    if (!error && user) userId = user.id;
  } catch { /* fall through */ }

  if (!userId) redirect('/login');

  let session: CustomerSession | null = null;
  try {
    const [u] = await db.select({ id: users.id, email: users.email, first_name: users.first_name, last_name: users.last_name })
      .from(users).where(eq(users.id, userId)).limit(1);
    if (u) session = u;
  } catch { /* fall through */ }

  if (!session) redirect('/login');
  return session;
}

export type AuthUser = {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  role: 'super_admin' | 'owner' | 'manager' | 'stylist' | 'receptionist';
  tenant_id: string | null;
};

export type StaffRole = AuthUser['role'];

const STAFF_ROLE_ROUTES: Record<StaffRole, string> = {
  super_admin: '/dashboard/owner',
  owner: '/dashboard/owner',
  manager: '/dashboard/owner',
  stylist: '/dashboard/associate',
  receptionist: '/dashboard/receptionist',
};

/** Maps a staff role to its landing route. Single source of truth for role-based routing. */
export function staffRoleToRoute(role: string): string {
  return STAFF_ROLE_ROUTES[role as StaffRole] ?? '/dashboard/receptionist';
}

/**
 * `requireDashboardSession` — Server-side auth guard for all dashboard routes.
 *
 * ARCHITECTURE RULE: `redirect()` is called OUTSIDE the try/catch block.
 * Next.js `redirect()` throws `NEXT_REDIRECT` internally — if caught, it breaks.
 */
export async function requireDashboardSession(): Promise<AuthUser> {
  const supabase = await createClient();

  let userId: string | null = null;

  try {
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error || !user) {
      // Intentionally fall through to redirect below
    } else {
      userId = user.id;
    }
  } catch {
    // DB/auth error — fall through to redirect
  }

  // redirect() MUST be outside try/catch — it throws NEXT_REDIRECT internally
  if (!userId) {
    redirect('/login');
  }

  // Fetch staff record with role
  let authUser: AuthUser | null = null;

  try {
    const result = await db
      .select({
        id: users.id,
        email: users.email,
        first_name: users.first_name,
        last_name: users.last_name,
        role: boutique_staff.role,
        tenant_id: boutique_staff.tenant_id,
      })
      .from(users)
      .innerJoin(boutique_staff, eq(users.id, boutique_staff.user_id))
      .where(eq(users.id, userId))
      .limit(1);

    if (result.length > 0 && result[0]) {
      authUser = result[0] as AuthUser;
    }
  } catch {
    // DB error — fall through to redirect
  }

  // redirect() MUST be outside try/catch.
  // User IS authenticated at this point (would have redirected above otherwise) —
  // they just lack a staff record, so route them to the customer side, not /login.
  if (!authUser) {
    redirect('/account');
  }

  return authUser;
}
