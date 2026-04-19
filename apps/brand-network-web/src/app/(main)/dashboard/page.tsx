import { requireDashboardSession } from '@/lib/auth';
import { redirect } from 'next/navigation';

export default async function DashboardIndexPage() {
  const user = await requireDashboardSession();

  const roleRoutes: Record<string, string> = {
    super_admin: '/dashboard/owner',
    owner: '/dashboard/owner',
    manager: '/dashboard/owner',
    stylist: '/dashboard/associate',
    receptionist: '/dashboard/receptionist',
  };

  const targetRoute = roleRoutes[user.role] ?? '/dashboard/receptionist';
  redirect(targetRoute);
}
