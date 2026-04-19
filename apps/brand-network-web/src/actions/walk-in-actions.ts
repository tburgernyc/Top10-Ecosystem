'use server';

import { revalidatePath } from 'next/cache';
import { requireDashboardSession } from '@/lib/auth';
import { withTenant, db } from '@toptenprom/database';
import { walk_ins } from '@toptenprom/database';
import { eq } from 'drizzle-orm';

export async function checkInWalkIn(walkInId: string): Promise<void> {
  // requireDashboardSession redirect() is outside try/catch — intentional
  const user = await requireDashboardSession();

  if (!user.tenant_id) {
    throw new Error('No tenant assigned to this user');
  }

  try {
    await withTenant(user.tenant_id, user.id, user.role, async (tx) => {
      await tx
        .update(walk_ins)
        .set({
          status: 'called',
          called_at: new Date(),
        })
        .where(eq(walk_ins.id, walkInId));
    });
  } catch (error) {
    console.error('[checkInWalkIn] Server action failed:', error);
    throw new Error('Failed to update walk-in status. Please try again.');
  }

  revalidatePath('/dashboard/receptionist');
}

/**
 * Server Action: Create a walk-in kiosk entry.
 * Table: walk_ins — NOT availability_inquiries (that table does not exist)
 */
export async function createWalkIn(formData: {
  customerName: string;
  phoneNumber: string;
  partySize: number;
  occasion?: string;
  notes?: string;
}): Promise<{ success: boolean; walkInId?: string; error?: string }> {
  const user = await requireDashboardSession();

  if (!user.tenant_id) {
    return { success: false, error: 'No tenant assigned to this account' };
  }

  try {
    const existingQueue = await db
      .select({ id: walk_ins.id })
      .from(walk_ins)
      .where(eq(walk_ins.tenant_id, user.tenant_id));

    const queuePosition = existingQueue.length + 1;

    const result = await withTenant(user.tenant_id, user.id, user.role, async (tx) => {
      return tx.insert(walk_ins).values({
        tenant_id: user.tenant_id!,
        customer_name: formData.customerName,
        phone_number: formData.phoneNumber,
        party_size: formData.partySize,
        occasion: formData.occasion as 'prom' | 'wedding' | 'homecoming' | null,
        notes: formData.notes ?? null,
        status: 'waiting',
        queue_position: queuePosition,
        estimated_wait_minutes: queuePosition * 15,
        checked_in_at: new Date(),
      }).returning({ id: walk_ins.id });
    });

    revalidatePath('/dashboard/receptionist');
    return { success: true, ...(result[0]?.id ? { walkInId: result[0].id } : {}) };
  } catch (error) {
    console.error('[createWalkIn] Server action failed:', error);
    return { success: false, error: 'Failed to add to queue. Please try again.' };
  }
}
