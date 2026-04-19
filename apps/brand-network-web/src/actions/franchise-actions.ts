'use server';

import { revalidatePath } from 'next/cache';
import { requireDashboardSession } from '@/lib/auth';
import { db } from '@toptenprom/database';
import { tenants, boutique_staff, users } from '@toptenprom/database';
import { createClient } from '@/lib/supabase/server';
import { eq } from 'drizzle-orm';
import crypto from 'crypto';

interface OnboardFranchiseParams {
  name: string;
  subdomain: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  phone: string;
  email: string;
  lat: number;
  lng: number;
  timezone: string;
  maxDailyAppointments: number;
  ownerFirstName: string;
  ownerLastName: string;
  ownerEmail: string;
}

type OnboardResult =
  | { success: true; tenantId: string; ownerId: string; inviteLink: string }
  | { success: false; error: string };

export async function onboardFranchiseLocation(
  params: OnboardFranchiseParams
): Promise<OnboardResult> {
  let session: Awaited<ReturnType<typeof requireDashboardSession>>;
  try {
    session = await requireDashboardSession();
  } catch {
    return { success: false, error: 'Authentication required.' };
  }

  if (session.role !== 'super_admin') {
    return { success: false, error: 'Only super_admin may onboard new franchise locations.' };
  }

  const subdomainRegex = /^[a-z0-9-]{2,30}$/;
  if (!subdomainRegex.test(params.subdomain)) {
    return { success: false, error: 'Subdomain must be 2–30 lowercase alphanumeric characters or hyphens.' };
  }

  try {
    const existing = await db
      .select({ id: tenants.id })
      .from(tenants)
      .where(eq(tenants.subdomain, params.subdomain))
      .limit(1);
    if (existing.length > 0) {
      return { success: false, error: `Subdomain "${params.subdomain}" is already in use.` };
    }
  } catch {
    return { success: false, error: 'Failed to verify subdomain uniqueness.' };
  }

  try {
    const existingUser = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, params.ownerEmail))
      .limit(1);
    if (existingUser.length > 0) {
      return { success: false, error: `A user with email "${params.ownerEmail}" already exists.` };
    }
  } catch {
    return { success: false, error: 'Failed to verify owner email uniqueness.' };
  }

  const supabase = await createClient();

  try {
    return await db.transaction(async (tx) => {
      const tenantResult = await tx
        .insert(tenants)
        .values({
          name: params.name,
          subdomain: params.subdomain,
          address: params.address,
          city: params.city,
          state: params.state,
          zip: params.zip,
          phone: params.phone,
          email: params.email,
          location_data: {
            lat: params.lat,
            lng: params.lng,
            timezone: params.timezone,
            place_id: '',
          },
          business_hours: {
            monday: { open: '10:00', close: '20:00', closed: false },
            tuesday: { open: '10:00', close: '20:00', closed: false },
            wednesday: { open: '10:00', close: '20:00', closed: false },
            thursday: { open: '10:00', close: '20:00', closed: false },
            friday: { open: '10:00', close: '21:00', closed: false },
            saturday: { open: '09:00', close: '20:00', closed: false },
            sunday: { open: '11:00', close: '18:00', closed: false },
          },
          is_active: true,
          max_daily_appointments: params.maxDailyAppointments,
        })
        .returning({ id: tenants.id });

      const newTenantId = tenantResult[0]!.id;

      const tempPassword = crypto.randomBytes(16).toString('base64url');
      const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email: params.ownerEmail,
        password: tempPassword,
        email_confirm: true,
        user_metadata: {
          first_name: params.ownerFirstName,
          last_name: params.ownerLastName,
          tenant_id: newTenantId,
          role: 'owner',
        },
      });

      if (authError || !authData.user) {
        throw new Error(`Supabase auth user creation failed: ${authError?.message ?? 'Unknown error'}`);
      }

      const newUserId = authData.user.id;

      await tx.insert(users).values({
        id: newUserId,
        email: params.ownerEmail,
        first_name: params.ownerFirstName,
        last_name: params.ownerLastName,
      });

      const staffResult = await tx
        .insert(boutique_staff)
        .values({
          user_id: newUserId,
          tenant_id: newTenantId,
          role: 'owner',
          is_active: true,
        })
        .returning({ id: boutique_staff.id });

      const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
        type: 'recovery',
        email: params.ownerEmail,
        options: { redirectTo: `${process.env.NEXT_PUBLIC_BASE_URL}/dashboard` },
      });

      const inviteLink = linkError
        ? `${process.env.NEXT_PUBLIC_BASE_URL}/login`
        : (linkData.properties?.action_link ?? `${process.env.NEXT_PUBLIC_BASE_URL}/login`);

      revalidatePath('/dashboard/franchise');
      revalidatePath('/dashboard/analytics');

      return {
        success: true as const,
        tenantId: newTenantId,
        ownerId: staffResult[0]!.id,
        inviteLink,
      };
    });
  } catch (error) {
    console.error('[onboardFranchiseLocation] Transaction failed — rolled back:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, error: `Franchise onboarding failed: ${message}` };
  }
}
