import { NextResponse } from 'next/server';
import { db } from '@toptenprom/database';
import { tenants } from '@toptenprom/database';
import { eq } from 'drizzle-orm';

export async function GET() {
  try {
    const results = await db
      .select({
        id: tenants.id,
        name: tenants.name,
        city: tenants.city,
        state: tenants.state,
      })
      .from(tenants)
      .where(eq(tenants.is_active, true))
      .orderBy(tenants.name);

    return NextResponse.json({ boutiques: results });
  } catch (e) {
    console.error('[GET /api/boutiques]', e);
    return NextResponse.json({ boutiques: [] });
  }
}
