import { NextRequest, NextResponse } from 'next/server';
import { db, vto_sessions } from '@toptenprom/database';
import { eq } from 'drizzle-orm';

function validateSyncSecret(request: NextRequest): boolean {
  const secret = request.headers.get('x-sync-secret');
  return !!secret && secret === process.env['MOBILE_SYNC_API_SECRET'];
}

export async function GET(
  request: NextRequest,
  props: { params: Promise<{ sessionId: string }> }
) {
  if (!validateSyncSecret(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { sessionId } = await props.params;

  const [session] = await db
    .select({
      id: vto_sessions.id,
      status: vto_sessions.status,
      output_image_url: vto_sessions.output_image_url,
      error_message: vto_sessions.error_message,
    })
    .from(vto_sessions)
    .where(eq(vto_sessions.id, sessionId))
    .limit(1);

  if (!session) {
    return NextResponse.json({ error: 'Session not found' }, { status: 404 });
  }

  return NextResponse.json({
    session_id: session.id,
    status: session.status,
    output_image_url: session.output_image_url ?? undefined,
    error_message: session.error_message ?? undefined,
  });
}
