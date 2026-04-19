import { NextRequest, NextResponse } from 'next/server';
import { fal } from '@fal-ai/client';
import { createClient as createSupabaseClient } from '@/lib/supabase/server';
import { db, vto_sessions } from '@toptenprom/database';

fal.config({ credentials: process.env.FAL_KEY! });

export async function POST(request: NextRequest) {
  const supabase = await createSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: { dress_id: string; color_name: string; image_base64: string; tenant_id?: string };
  try {
    body = await request.json() as typeof body;
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const { dress_id, color_name, image_base64, tenant_id } = body;
  const channelId = `vto-${user.id}-${Date.now()}`;

  // Upload input image to Supabase Storage
  let inputImageUrl = '';
  try {
    const imageBuffer = Buffer.from(image_base64, 'base64');
    const filePath = `vto/inputs/${user.id}/${Date.now()}.jpg`;
    const { error: uploadError } = await supabase.storage
      .from('vto-images')
      .upload(filePath, imageBuffer, { contentType: 'image/jpeg', upsert: false });

    if (uploadError) throw uploadError;

    const { data: urlData } = supabase.storage.from('vto-images').getPublicUrl(filePath);
    inputImageUrl = urlData.publicUrl;
  } catch {
    return NextResponse.json({ error: 'Image upload failed' }, { status: 500 });
  }

  // Create VTO session record
  let sessionId = '';
  try {
    const [session] = await db
      .insert(vto_sessions)
      .values({
        user_id: user.id,
        tenant_id: tenant_id ?? null,
        dress_id,
        color_name,
        realtime_channel_id: channelId,
        status: 'queued',
        input_image_url: inputImageUrl,
        processing_started_at: new Date(),
      })
      .returning({ id: vto_sessions.id });

    sessionId = session?.id ?? '';
  } catch {
    return NextResponse.json({ error: 'Session creation failed' }, { status: 500 });
  }

  // Submit async job to Fal.ai flux-kontext-pro
  try {
    await fal.queue.submit('fal-ai/flux-kontext-pro', {
      input: {
        image_url: inputImageUrl,
        prompt: `A person wearing a ${color_name} prom dress, photorealistic, luxury boutique setting, editorial quality`,
        num_inference_steps: 28,
        guidance_scale: 3.5,
      },
      webhookUrl: `${process.env.NEXT_PUBLIC_BASE_URL}/api/vto/webhook?session_id=${sessionId}&channel_id=${channelId}`,
    });
  } catch (error) {
    console.error('[VTO Initiate] Fal.ai submission failed:', error);
    // Don't fail the request — the session is created, webhook will handle completion
  }

  return NextResponse.json({ session_id: sessionId, channel_id: channelId }, { status: 202 });
}
