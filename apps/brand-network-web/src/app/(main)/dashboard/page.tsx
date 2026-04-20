import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { db } from '@toptenprom/database';
import { boutique_staff, users } from '@toptenprom/database';
import { eq } from 'drizzle-orm';

export default async function DashboardIndexPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  // Check for staff record
  try {
    const [staffRow] = await db
      .select({ role: boutique_staff.role })
      .from(users)
      .innerJoin(boutique_staff, eq(users.id, boutique_staff.user_id))
      .where(eq(users.id, user.id))
      .limit(1);

    if (staffRow) {
      const roleRoutes: Record<string, string> = {
        super_admin: '/dashboard/owner',
        owner: '/dashboard/owner',
        manager: '/dashboard/owner',
        stylist: '/dashboard/associate',
        receptionist: '/dashboard/receptionist',
      };
      redirect(roleRoutes[staffRow.role] ?? '/dashboard/receptionist');
    }
  } catch { /* no staff record — treat as customer */ }

  redirect('/dashboard/customer');
}
