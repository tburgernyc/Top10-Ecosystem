import { NextRequest, NextResponse } from 'next/server';
import { db, walk_ins, appointments } from '@toptenprom/database';
import { eq } from 'drizzle-orm';
import { randomBytes } from 'crypto';

interface ConvertRequest {
  walk_in_id: string;
  appointment_date: string; // ISO string
  duration_minutes: number;
  service_type: string;
  stylist_id?: string;
}

function validateSyncSecret(request: NextRequest): boolean {
  const secret = request.headers.get('x-sync-secret');
  return !!secret && secret === process.env['MOBILE_SYNC_API_SECRET'];
}

function generateConfirmationCode(): string {
  return randomBytes(4).toString('hex').toUpperCase(); // e.g. "A3F9B2C1"
}

export async function POST(request: NextRequest) {
  if (!validateSyncSecret(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: Partial<ConvertRequest>;
  try {
    body = await request.json() as Partial<ConvertRequest>;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { walk_in_id, appointment_date, duration_minutes, service_type, stylist_id } = body;

  if (!walk_in_id || !appointment_date || !duration_minutes || !service_type) {
    return NextResponse.json({ error: 'walk_in_id, appointment_date, duration_minutes, service_type are required' }, { status: 400 });
  }

  // Look up the walk-in to get tenant_id and verify it exists
  const [walkIn] = await db
    .select({ id: walk_ins.id, tenant_id: walk_ins.tenant_id, status: walk_ins.status })
    .from(walk_ins)
    .where(eq(walk_ins.id, walk_in_id))
    .limit(1);

  if (!walkIn) {
    return NextResponse.json({ error: 'Walk-in not found' }, { status: 404 });
  }

  const confirmationCode = generateConfirmationCode();
  const appointmentDate = new Date(appointment_date);

  // Create appointment — customer_id is null (anonymous walk-in)
  const [appointment] = await db
    .insert(appointments)
    .values({
      tenant_id: walkIn.tenant_id,
      customer_id: null,
      stylist_id: stylist_id ?? null,
      appointment_date: appointmentDate,
      duration_minutes: duration_minutes,
      service_type: service_type,
      status: 'confirmed',
      notes: `Converted from walk-in ${walk_in_id}`,
      confirmation_code: confirmationCode,
    })
    .returning({ id: appointments.id, confirmation_code: appointments.confirmation_code });

  // Update walk-in status to with_stylist
  await db
    .update(walk_ins)
    .set({ status: 'with_stylist', updated_at: new Date() })
    .where(eq(walk_ins.id, walk_in_id));

  return NextResponse.json({
    appointment_id: appointment?.id,
    confirmation_code: appointment?.confirmation_code,
  });
}
