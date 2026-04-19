'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { db } from '@toptenprom/database';
import {
  dress_vote_sessions,
  dress_votes,
  customers,
} from '@toptenprom/database';
import { eq, sql } from 'drizzle-orm';
import crypto from 'crypto';
import { headers } from 'next/headers';

export async function createVoteSession(params: {
  tenantId: string;
  dressIds: string[];
  title?: string;
  expiresInDays?: number;
}): Promise<{ success: boolean; shareToken?: string; sessionId?: string; error?: string }> {
  if (params.dressIds.length < 2 || params.dressIds.length > 6) {
    return { success: false, error: 'Select between 2 and 6 dresses to vote on.' };
  }

  const supabase = await createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  if (!authUser) return { success: false, error: 'You must be signed in to create a vote.' };

  let customerId: string;
  try {
    const result = await db
      .select({ id: customers.id })
      .from(customers)
      .where(eq(customers.user_id, authUser.id))
      .limit(1);
    if (!result[0]?.id) return { success: false, error: 'Customer profile not found.' };
    customerId = result[0].id;
  } catch {
    return { success: false, error: 'Failed to resolve customer.' };
  }

  const shareToken = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + (params.expiresInDays ?? 7));

  try {
    const result = await db
      .insert(dress_vote_sessions)
      .values({
        customer_id: customerId,
        tenant_id: params.tenantId,
        share_token: shareToken,
        title: params.title ?? 'Help me pick my dress! 💖',
        dress_ids: params.dressIds,
        expires_at: expiresAt,
      })
      .returning({ id: dress_vote_sessions.id });

    return { success: true, shareToken, sessionId: result[0]!.id };
  } catch (error) {
    console.error('[createVoteSession] Failed:', error);
    return { success: false, error: 'Failed to create vote session.' };
  }
}

export async function castVote(params: {
  shareToken: string;
  dressId: string;
  voteType: 'love' | 'like' | 'maybe' | 'pass';
  voterDisplayName?: string;
  comment?: string;
}): Promise<{ success: boolean; error?: string }> {
  let sessionId: string | undefined;
  try {
    const result = await db
      .select({
        id: dress_vote_sessions.id,
        is_active: dress_vote_sessions.is_active,
        expires_at: dress_vote_sessions.expires_at,
        dress_ids: dress_vote_sessions.dress_ids,
      })
      .from(dress_vote_sessions)
      .where(eq(dress_vote_sessions.share_token, params.shareToken))
      .limit(1);

    const session = result[0];
    if (!session) return { success: false, error: 'Vote session not found.' };
    if (!session.is_active) return { success: false, error: 'This vote session has been closed.' };
    if (new Date() > new Date(session.expires_at)) return { success: false, error: 'This vote session has expired.' };
    if (!(session.dress_ids as string[]).includes(params.dressId)) {
      return { success: false, error: 'This dress is not part of this vote session.' };
    }
    sessionId = session.id;
  } catch {
    return { success: false, error: 'Failed to validate vote session.' };
  }

  const requestHeaders = await headers();
  const ip = requestHeaders.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  const ua = requestHeaders.get('user-agent') ?? 'unknown';
  const fingerprint = crypto
    .createHash('sha256')
    .update(`${ip}:${ua}:${sessionId}`)
    .digest('hex');

  const comment = params.comment ? params.comment.slice(0, 140) : null;

  try {
    await db
      .insert(dress_votes)
      .values({
        session_id: sessionId,
        dress_id: params.dressId,
        vote_type: params.voteType,
        voter_fingerprint: fingerprint,
        voter_display_name: params.voterDisplayName?.slice(0, 60) ?? null,
        comment,
      })
      .onConflictDoNothing();

    await db
      .update(dress_vote_sessions)
      .set({
        vote_count: sql`${dress_vote_sessions.vote_count} + 1`,
        updated_at: new Date(),
      })
      .where(eq(dress_vote_sessions.id, sessionId));

    revalidatePath(`/vote/${params.shareToken}`);
    return { success: true };
  } catch (error) {
    console.error('[castVote] Failed:', error);
    return { success: false, error: 'Failed to cast vote.' };
  }
}
