'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { db } from '@toptenprom/database';
import {
  bridal_parties,
  bridal_party_members,
  customers,
} from '@toptenprom/database';
import { eq, and } from 'drizzle-orm';
import crypto from 'crypto';

function assertAuthenticated(
  user: { id: string } | null
): asserts user is { id: string } {
  if (!user) throw new Error('UNAUTHENTICATED');
}

export async function createBridalParty(params: {
  tenantId: string;
  name: string;
  occasion: 'prom' | 'wedding' | 'homecoming';
  eventDate?: string;
  schoolName?: string;
  notes?: string;
}): Promise<{ success: boolean; partyId?: string; inviteCode?: string; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  assertAuthenticated(authUser);

  let customerId: string;
  try {
    const result = await db
      .select({ id: customers.id })
      .from(customers)
      .where(eq(customers.user_id, authUser.id))
      .limit(1);
    if (!result[0]?.id) {
      return { success: false, error: 'Customer profile not found. Please complete your profile first.' };
    }
    customerId = result[0].id;
  } catch {
    return { success: false, error: 'Failed to resolve customer profile.' };
  }

  const inviteCode = crypto.randomBytes(16).toString('hex');

  try {
    const result = await db
      .insert(bridal_parties)
      .values({
        tenant_id: params.tenantId,
        lead_customer_id: customerId,
        name: params.name,
        occasion: params.occasion,
        event_date: params.eventDate ? new Date(params.eventDate) : null,
        school_name: params.schoolName ?? null,
        invite_code: inviteCode,
        notes: params.notes ?? null,
      })
      .returning({ id: bridal_parties.id });

    await db.insert(bridal_party_members).values({
      party_id: result[0]!.id,
      customer_id: customerId,
      role: 'lead',
      is_confirmed: true,
    });

    revalidatePath('/dashboard/bridal-party');
    return { success: true, partyId: result[0]!.id, inviteCode };
  } catch (error) {
    console.error('[createBridalParty] Failed:', error);
    return { success: false, error: 'Failed to create party. Please try again.' };
  }
}

export async function joinBridalParty(params: {
  inviteCode: string;
  role?: 'bridesmaid' | 'groomsman' | 'flower_girl' | 'guest';
}): Promise<{ success: boolean; partyId?: string; partyName?: string; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  assertAuthenticated(authUser);

  let customerId: string;
  try {
    const result = await db
      .select({ id: customers.id })
      .from(customers)
      .where(eq(customers.user_id, authUser.id))
      .limit(1);
    if (!result[0]?.id) {
      return { success: false, error: 'Complete your customer profile before joining a party.' };
    }
    customerId = result[0].id;
  } catch {
    return { success: false, error: 'Failed to resolve customer profile.' };
  }

  let party: { id: string; name: string; max_members: number } | undefined;
  try {
    const result = await db
      .select({ id: bridal_parties.id, name: bridal_parties.name, max_members: bridal_parties.max_members })
      .from(bridal_parties)
      .where(and(eq(bridal_parties.invite_code, params.inviteCode), eq(bridal_parties.is_active, true)))
      .limit(1);
    party = result[0];
  } catch {
    return { success: false, error: 'Failed to look up party.' };
  }

  if (!party) {
    return { success: false, error: 'Invalid or expired invite code.' };
  }

  const memberCount = await db
    .select({ id: bridal_party_members.id })
    .from(bridal_party_members)
    .where(eq(bridal_party_members.party_id, party.id));

  if (memberCount.length >= party.max_members) {
    return { success: false, error: 'This party is full.' };
  }

  try {
    await db
      .insert(bridal_party_members)
      .values({
        party_id: party.id,
        customer_id: customerId,
        role: params.role ?? 'bridesmaid',
        is_confirmed: true,
      })
      .onConflictDoNothing();

    revalidatePath('/dashboard/bridal-party');
    return { success: true, partyId: party.id, partyName: party.name };
  } catch (error) {
    console.error('[joinBridalParty] Failed:', error);
    return { success: false, error: 'Failed to join party. Please try again.' };
  }
}

export async function updateMemberShortlist(params: {
  partyId: string;
  dressIds: string[];
}): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  assertAuthenticated(authUser);

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
    await db
      .update(bridal_party_members)
      .set({ shortlisted_dress_ids: params.dressIds, updated_at: new Date() })
      .where(
        and(
          eq(bridal_party_members.party_id, params.partyId),
          eq(bridal_party_members.customer_id, customerId)
        )
      );

    revalidatePath(`/dashboard/bridal-party/${params.partyId}`);
    return { success: true };
  } catch (error) {
    console.error('[updateMemberShortlist] Failed:', error);
    return { success: false, error: 'Failed to update shortlist.' };
  }
}
