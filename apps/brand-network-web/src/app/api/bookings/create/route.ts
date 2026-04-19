import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { db } from '@toptenprom/database';
import { appointments, customers, tenants, guardian_profiles, users } from '@toptenprom/database';
import { eq, and } from 'drizzle-orm';
import crypto from 'crypto';

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: { locationId: string; serviceId: string; date: string; time: string };
  try {
    body = await request.json() as typeof body;
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const { locationId, serviceId, date, time } = body;

  if (!locationId || !serviceId || !date || !time) {
    return NextResponse.json({ error: 'All booking fields are required' }, { status: 400 });
  }

  let customerId: string | null = null;
  try {
    const result = await db.select({ id: customers.id }).from(customers).where(eq(customers.user_id, user.id)).limit(1);
    customerId = result[0]?.id ?? null;
  } catch {
    return NextResponse.json({ error: 'Customer profile not found' }, { status: 404 });
  }

  if (!customerId) {
    return NextResponse.json({ error: 'Please complete your customer profile first.' }, { status: 403 });
  }

  let tenantExists = false;
  try {
    const tenantResult = await db.select({ id: tenants.id }).from(tenants).where(and(eq(tenants.id, locationId), eq(tenants.is_active, true))).limit(1);
    tenantExists = tenantResult.length > 0;
  } catch {
    return NextResponse.json({ error: 'Location lookup failed' }, { status: 500 });
  }

  if (!tenantExists) {
    return NextResponse.json({ error: 'Selected location is not available.', nearbyLocation: null }, { status: 409 });
  }

  const confirmationCode = `T10-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
  const appointmentDateTime = new Date(`${date}T${time.replace(' AM', '').replace(' PM', '')}`);

  try {
    await db.insert(appointments).values({
      tenant_id: locationId,
      customer_id: customerId,
      appointment_date: appointmentDateTime,
      duration_minutes: 90,
      service_type: serviceId,
      status: 'pending',
      confirmation_code: confirmationCode,
    });
  } catch (error) {
    console.error('[Booking Create] Failed:', error);
    return NextResponse.json({ error: 'Booking creation failed. Please try again.' }, { status: 500 });
  }

  // Dispatch guardian notifications (fire-and-forget — never block the response)
  void (async () => {
    try {
      const customerGuardians = await db
        .select({
          id: guardian_profiles.id,
          first_name: guardian_profiles.first_name,
          email: guardian_profiles.email,
          phone: guardian_profiles.phone,
          preferred_channel: guardian_profiles.preferred_channel,
          is_consent_given: guardian_profiles.is_consent_given,
        })
        .from(guardian_profiles)
        .where(
          and(
            eq(guardian_profiles.customer_id, customerId!),
            eq(guardian_profiles.is_consent_given, true)
          )
        );

      if (customerGuardians.length === 0) return;

      const tenantInfo = await db
        .select({ name: tenants.name, address: tenants.address, phone: tenants.phone })
        .from(tenants)
        .where(eq(tenants.id, locationId))
        .limit(1);

      const tenant = tenantInfo[0];
      if (!tenant) return;

      const customerInfo = await db
        .select({ first_name: users.first_name })
        .from(customers)
        .innerJoin(users, eq(customers.user_id, users.id))
        .where(eq(customers.id, customerId!))
        .limit(1);

      const customerFirstName = customerInfo[0]?.first_name ?? 'your family member';

      const { appointmentConfirmationEmail, appointmentConfirmationSMS } = await import('@/lib/notifications/templates');
      const { sendGuardianNotification } = await import('@/lib/notifications/send-guardian-notification');

      for (const guardian of customerGuardians) {
        const ctx = {
          customerFirstName,
          guardianFirstName: guardian.first_name,
          boutiqueName: tenant.name,
          appointmentDate: appointmentDateTime.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }),
          appointmentTime: appointmentDateTime.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
          confirmationCode,
          boutiqueAddress: tenant.address ?? '',
          boutiquePhone: tenant.phone ?? '',
        };

        const emailPl = (guardian.email && guardian.preferred_channel !== 'sms')
          ? { to: guardian.email, ...appointmentConfirmationEmail(ctx) }
          : undefined;
        const smsPl = (guardian.phone && guardian.preferred_channel !== 'email')
          ? { to: guardian.phone, body: appointmentConfirmationSMS(ctx) }
          : undefined;

        await sendGuardianNotification({
          guardianProfileId: guardian.id,
          customerId: customerId!,
          tenantId: locationId,
          notificationType: 'appointment_confirmation',
          ...(emailPl ? { emailPayload: emailPl } : {}),
          ...(smsPl ? { smsPayload: smsPl } : {}),
          referenceType: 'appointment',
        });
      }
    } catch (notifError) {
      console.error('[Booking] Guardian notification dispatch failed:', notifError);
    }
  })();

  return NextResponse.json({ confirmation_code: confirmationCode }, { status: 201 });
}
