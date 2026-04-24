import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { db, vto_sessions } from '@toptenprom/database';
import { eq } from 'drizzle-orm';

export async function POST(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    return NextResponse.json(
      { error: 'Virtual Try-On webhook is not configured on this deployment.' },
      { status: 503 },
    );
  }
  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

  const sessionId = request.nextUrl.searchParams.get('session_id');
  const channelId = request.nextUrl.searchParams.get('channel_id');

  if (!sessionId || !channelId) {
    return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
  }

  let falResult: { images?: Array<{ url: string }>; error?: string };
  try {
    falResult = await request.json() as typeof falResult;
  } catch {
    return NextResponse.json({ error: 'Invalid webhook body' }, { status: 400 });
  }

  const outputUrl = falResult.images?.[0]?.url ?? null;
  const hasError = !outputUrl || !!falResult.error;

  // Update vto_sessions record
  try {
    await db
      .update(vto_sessions)
      .set({
        status: hasError ? 'failed' : 'completed',
        output_image_url: outputUrl,
        processing_completed_at: new Date(),
        error_message: falResult.error ?? null,
      })
      .where(eq(vto_sessions.id, sessionId));
  } catch (dbError) {
    console.error('[VTO Webhook] DB update failed:', dbError);
  }

  // Broadcast result to Supabase Realtime channel — client is subscribed waiting for this
  try {
    await supabaseAdmin.channel(channelId).send({
      type: 'broadcast',
      event: 'vto_complete',
      payload: {
        status: hasError ? 'failed' : 'completed',
        output_image_url: outputUrl,
        error: falResult.error ?? null,
      },
    });
  } catch (realtimeError) {
    console.error('[VTO Webhook] Realtime broadcast failed:', realtimeError);
  }

  return NextResponse.json({ received: true });
}
