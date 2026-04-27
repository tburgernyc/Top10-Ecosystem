'use server';

import { redirect } from 'next/navigation';
import { eq } from 'drizzle-orm';
import { db } from '@toptenprom/database';
import { boutique_staff, users } from '@toptenprom/database';
import { createClient } from '@/lib/supabase/server';
import { staffRoleToRoute } from '@/lib/auth';

export type LoginActionState = { error: string | null };

export async function signInAction(
  _prev: LoginActionState,
  formData: FormData,
): Promise<LoginActionState> {
  const email = String(formData.get('email') ?? '').trim();
  const password = String(formData.get('password') ?? '');

  if (!email || !password) {
    return { error: 'Please enter your email and password.' };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error || !data.user) {
    return { error: 'Invalid email or password. Please try again.' };
  }

  let target = '/account';
  try {
    const [staffRow] = await db
      .select({ role: boutique_staff.role })
      .from(users)
      .innerJoin(boutique_staff, eq(users.id, boutique_staff.user_id))
      .where(eq(users.id, data.user.id))
      .limit(1);

    if (staffRow) target = staffRoleToRoute(staffRow.role);
  } catch {
    // No staff row or DB hiccup — customer fallback below is safe.
  }

  redirect(target);
}
