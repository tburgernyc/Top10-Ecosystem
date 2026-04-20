import { NextResponse } from 'next/server';
import { db } from '@toptenprom/database';
import { dresses } from '@toptenprom/database';
import { eq } from 'drizzle-orm';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const limit = Math.min(Number(searchParams.get('limit') ?? 20), 50);

  try {
    const results = await db
      .select({
        id: dresses.id,
        name: dresses.name,
        designer: dresses.designer,
        retail_price: dresses.retail_price,
        available_colors: dresses.available_colors,
        image_urls: dresses.image_urls,
      })
      .from(dresses)
      .where(eq(dresses.is_active, true))
      .limit(limit);

    return NextResponse.json({ dresses: results });
  } catch (e) {
    console.error('[GET /api/dresses]', e);
    return NextResponse.json({ dresses: [] });
  }
}
