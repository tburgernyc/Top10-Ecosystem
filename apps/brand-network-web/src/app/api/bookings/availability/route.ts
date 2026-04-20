import { NextResponse } from 'next/server';
import { db } from '@toptenprom/database';
import { appointments } from '@toptenprom/database';
import { eq, and, gte, lt } from 'drizzle-orm';

const ALL_SLOTS = ['10:00 AM', '11:00 AM', '12:00 PM', '1:00 PM', '2:00 PM', '3:00 PM', '4:00 PM', '5:00 PM'];

function slotLabel(d: Date): string {
  const h = d.getHours();
  const m = d.getMinutes();
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h > 12 ? h - 12 : h === 0 ? 12 : h;
  return `${h12}:${String(m).padStart(2, '0')} ${ampm}`;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const tenantId = searchParams.get('tenantId');
  const date = searchParams.get('date'); // YYYY-MM-DD

  if (!tenantId || !date) {
    return NextResponse.json({ error: 'tenantId and date required' }, { status: 400 });
  }

  try {
    const dayStart = new Date(`${date}T00:00:00`);
    const dayEnd = new Date(`${date}T23:59:59`);

    const existing = await db
      .select({ appointment_date: appointments.appointment_date })
      .from(appointments)
      .where(and(
        eq(appointments.tenant_id, tenantId),
        gte(appointments.appointment_date, dayStart),
        lt(appointments.appointment_date, dayEnd),
      ));

    const takenSlots = new Set(existing.map((a) => slotLabel(a.appointment_date)));
    const available = ALL_SLOTS.filter((s) => !takenSlots.has(s));

    return NextResponse.json({ available, date, tenantId });
  } catch (e) {
    console.error('[GET /api/bookings/availability]', e);
    return NextResponse.json({ available: ALL_SLOTS });
  }
}
