'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { db } from '@toptenprom/database';
import {
  guardian_profiles,
  guardian_portal_tokens,
  customers,
  users,
} from '@toptenprom/database';
import { eq, and } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { sendGuardianNotification } from '@/lib/notifications/send-guardian-notification';
import { guardianPortalInviteEmail } from '@/lib/notifications/templates';

// ─── ADD GUARDIAN ─────────────────────────────────────────────────────────────

export async function addGuardianProfile(params: {
  firstName: string;
  lastName: string;
  relationship: string;
  email?: string;
  phone?: string;
  preferredChannel: 'email' | 'sms' | 'both';
  isPrimary: boolean;
  consentGiven: boolean;
}): Promise<{ success: boolean; guardianId?: string; error?: string }> {
  if (!params.consentGiven) {
    return { success: false, error: 'Guardian consent is required to add a guardian profile.' };
  }

  if (!params.email && !params.phone) {
    return { success: false, error: 'At least one contact method (email or phone) is required.' };
  }

  const supabase = await createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  if (!authUser) return { success: false, error: 'Authentication required.' };

  let customerId: string;
  try {
    const result = await db
      .select({ id: customers.id })
      .from(customers)
      .where(eq(customers.user_id, authUser.id))
      .limit(1);
    if (!result[0]?.id) return { success: false, error: 'Customer profile not found.' };
    customerId = result[0].id;
  } catch {
    return { success: false, error: 'Failed to resolve customer.' };
  }

  try {
    const existingGuardians = await db
      .select({ id: guardian_profiles.id })
      .from(guardian_profiles)
      .where(eq(guardian_profiles.customer_id, customerId));

    if (existingGuardians.length >= 2) {
      return { success: false, error: 'Maximum of 2 guardians allowed per account.' };
    }
  } catch {
    return { success: false, error: 'Failed to check existing guardians.' };
  }

  try {
    const result = await db
      .insert(guardian_profiles)
      .values({
        customer_id: customerId,
        first_name: params.firstName,
        last_name: params.lastName,
        relationship: params.relationship,
        email: params.email ?? null,
        phone: params.phone ?? null,
        preferred_channel: params.preferredChannel,
        is_primary: params.isPrimary,
        is_consent_given: true,
        consent_given_at: new Date(),
      })
      .returning({ id: guardian_profiles.id });

    revalidatePath('/dashboard/account');
    return { success: true, guardianId: result[0]!.id };
  } catch (error) {
    console.error('[addGuardianProfile] Failed:', error);
    return { success: false, error: 'Failed to add guardian. Please try again.' };
  }
}

// ─── SEND GUARDIAN PORTAL INVITE ─────────────────────────────────────────────

export async function sendGuardianPortalInvite(params: {
  guardianProfileId: string;
  tenantId: string;
}): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  if (!authUser) return { success: false, error: 'Authentication required.' };

  let customerId: string;
  let guardian: { id: string; first_name: string; email: string | null; customer_id: string } | undefined;

  try {
    const customerResult = await db
      .select({ id: customers.id })
      .from(customers)
      .where(eq(customers.user_id, authUser.id))
      .limit(1);
    if (!customerResult[0]) return { success: false, error: 'Customer not found.' };
    customerId = customerResult[0].id;
  } catch {
    return { success: false, error: 'Failed to resolve customer.' };
  }

  try {
    const result = await db
      .select({
        id: guardian_profiles.id,
        first_name: guardian_profiles.first_name,
        email: guardian_profiles.email,
        customer_id: guardian_profiles.customer_id,
      })
      .from(guardian_profiles)
      .where(
        and(
          eq(guardian_profiles.id, params.guardianProfileId),
          eq(guardian_profiles.customer_id, customerId)
        )
      )
      .limit(1);
    guardian = result[0];
  } catch {
    return { success: false, error: 'Failed to resolve guardian.' };
  }

  if (!guardian) return { success: false, error: 'Guardian not found or access denied.' };
  if (!guardian.email) return { success: false, error: 'This guardian has no email address on file.' };

  const rawToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = await bcrypt.hash(rawToken, 12);
  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + 48);

  try {
    const tokenResult = await db
      .insert(guardian_portal_tokens)
      .values({
        guardian_profile_id: guardian.id,
        customer_id: customerId,
        token_hash: tokenHash,
        expires_at: expiresAt,
      })
      .returning({ id: guardian_portal_tokens.id });

    const portalUrl = `${process.env.NEXT_PUBLIC_BASE_URL}/guardian-portal/${tokenResult[0]!.id}?token=${rawToken}`;

    const customerNameResult = await db
      .select({ first_name: users.first_name })
      .from(customers)
      .innerJoin(users, eq(customers.user_id, users.id))
      .where(eq(customers.id, customerId))
      .limit(1);
    const customerFirstName = customerNameResult[0]?.first_name ?? 'your family member';

    const emailTemplate = guardianPortalInviteEmail({
      guardianFirstName: guardian.first_name,
      customerFirstName,
      portalUrl,
      expiresAt: '48 hours',
    });

    await sendGuardianNotification({
      guardianProfileId: guardian.id,
      customerId,
      tenantId: params.tenantId,
      notificationType: 'guardian_portal_invite',
      emailPayload: {
        to: guardian.email,
        ...emailTemplate,
      },
    });

    return { success: true };
  } catch (error) {
    console.error('[sendGuardianPortalInvite] Failed:', error);
    return { success: false, error: 'Failed to send portal invite.' };
  }
}
