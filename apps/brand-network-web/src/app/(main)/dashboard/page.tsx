import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { db } from '@toptenprom/database';
import { boutique_staff, users } from '@toptenprom/database';
import { eq } from 'drizzle-orm';
import { staffRoleToRoute } from '@/lib/auth';

export default async function DashboardIndexPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  let staffRole: string | null = null;
  try {
    const [staffRow] = await db
      .select({ role: boutique_staff.role })
      .from(users)
      .innerJoin(boutique_staff, eq(users.id, boutique_staff.user_id))
      .where(eq(users.id, user.id))
      .limit(1);

    if (staffRow) staffRole = staffRow.role;
  } catch { /* no staff record — treat as customer */ }

  redirect(staffRole ? staffRoleToRoute(staffRole) : '/account');
}
