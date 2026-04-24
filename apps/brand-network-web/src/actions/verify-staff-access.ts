'use server';

import { createClient } from '@/lib/supabase/server';
import { db } from '@toptenprom/database';
import { boutique_staff } from '@toptenprom/database';
import { eq } from 'drizzle-orm';

type Result =
  | { ok: true; role: 'super_admin' | 'owner' | 'manager' | 'stylist' | 'receptionist' }
  | { ok: false };

export async function verifyStaffAccess(): Promise<Result> {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return { ok: false };

  const [row] = await db
    .select({ role: boutique_staff.role })
    .from(boutique_staff)
    .where(eq(boutique_staff.user_id, user.id))
    .limit(1);

  if (!row) {
    await supabase.auth.signOut();
    return { ok: false };
  }

  return { ok: true, role: row.role };
}
