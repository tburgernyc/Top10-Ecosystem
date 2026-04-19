'use server';

import { db } from '@toptenprom/database';
import { dress_reservations, customers } from '@toptenprom/database';
import { eq } from 'drizzle-orm';
import { createClient } from '@/lib/supabase/server';

export async function saveToRegistry(params: {
  dressId: string;
  colorName: string;
  size: string;
  tenantId: string;
  schoolName?: string;
  promDate?: string;
}): Promise<{ success: boolean; reservationId?: string; error?: string }> {
  const supabase = await createClient();
  const { data: { user: authUser } } = await supabase.auth.getUser();

  if (!authUser) {
    return { success: false, error: 'You must be signed in to save a reservation.' };
  }

  let customerId: string | null = null;
  try {
    const customerResult = await db
      .select({ id: customers.id })
      .from(customers)
      .where(eq(customers.user_id, authUser.id))
      .limit(1);

    customerId = customerResult[0]?.id ?? null;
  } catch {
    return { success: false, error: 'Customer profile not found.' };
  }

  if (!customerId) {
    return { success: false, error: 'Please complete your customer profile before saving to registry.' };
  }

  try {
    const result = await db
      .insert(dress_reservations)
      .values({
        customer_id: customerId,
        dress_id: params.dressId,
        tenant_id: params.tenantId,
        color_name: params.colorName,
        size: params.size,
        reservation_status: 'active',
        school_name: params.schoolName ?? null,
        prom_date: params.promDate ? new Date(params.promDate) : null,
        expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      })
      .onConflictDoNothing()
      .returning({ id: dress_reservations.id });

    if (!result[0]?.id) {
      return { success: false, error: 'This dress in your size and color is already reserved at this boutique.' };
    }

    return { success: true, reservationId: result[0].id };
  } catch (error) {
    console.error('[saveToRegistry] Failed:', error);
    return { success: false, error: 'Failed to save reservation. Please try again.' };
  }
}
