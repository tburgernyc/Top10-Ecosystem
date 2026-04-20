import { NextRequest, NextResponse } from 'next/server';
import { db, tenants, boutique_staff, users } from '@toptenprom/database';
import { eq } from 'drizzle-orm';

interface AuthRequest {
  store_code: string;
}

interface Stylist {
  id: string;
  name: string;
}

export async function POST(request: NextRequest) {
  let body: Partial<AuthRequest>;
  try {
    body = await request.json() as Partial<AuthRequest>;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { store_code } = body;
  if (!store_code || typeof store_code !== 'string') {
    return NextResponse.json({ error: 'store_code is required' }, { status: 400 });
  }

  const [tenant] = await db
    .select({
      id: tenants.id,
      name: tenants.name,
      mobile_sync_secret: tenants.mobile_sync_secret,
    })
    .from(tenants)
    .where(eq(tenants.store_code, store_code.trim().toUpperCase()))
    .limit(1);

  if (!tenant) {
    return NextResponse.json({ error: 'Invalid store code' }, { status: 401 });
  }

  // Fetch active stylists for this tenant (join boutique_staff → users for display name)
  const staffRows = await db
    .select({
      id: boutique_staff.id,
      first_name: users.first_name,
      last_name: users.last_name,
    })
    .from(boutique_staff)
    .innerJoin(users, eq(boutique_staff.user_id, users.id))
    .where(eq(boutique_staff.tenant_id, tenant.id));

  const stylists: Stylist[] = staffRows.map((s) => ({
    id: s.id,
    name: `${s.first_name} ${s.last_name}`,
  }));

  return NextResponse.json({
    tenant_id: tenant.id,
    store_name: tenant.name,
    sync_secret: tenant.mobile_sync_secret ?? process.env['MOBILE_SYNC_API_SECRET'] ?? '',
    stylists,
  });
}
