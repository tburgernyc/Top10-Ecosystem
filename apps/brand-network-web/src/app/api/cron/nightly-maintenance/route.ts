import { NextResponse, type NextRequest } from 'next/server';
import { db, walk_ins, client_style_profiles } from '@toptenprom/database';
import { sql, eq, and, isNotNull, isNull } from 'drizzle-orm';
import { embed } from 'ai';
import { google } from '@ai-sdk/google';

export const runtime = 'nodejs';
export const maxDuration = 300;

type Result = {
  walkInsPruned: number;
  profilesEmbedded: number;
  errors: string[];
};

export async function GET(request: NextRequest): Promise<NextResponse<Result | { error: string }>> {
  const expected = process.env['CRON_SECRET'];
  if (!expected) {
    return NextResponse.json({ error: 'CRON_SECRET not configured' }, { status: 500 });
  }
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${expected}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const results: Result = { walkInsPruned: 0, profilesEmbedded: 0, errors: [] };

  try {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const pruned = await db
      .delete(walk_ins)
      .where(
        and(
          sql`${walk_ins.created_at} < ${sevenDaysAgo.toISOString()}`,
          sql`${walk_ins.status} IN ('completed', 'left')`,
        ),
      )
      .returning({ id: walk_ins.id });

    results.walkInsPruned = pruned.length;
  } catch (error) {
    results.errors.push(`walk-in pruning failed: ${error instanceof Error ? error.message : String(error)}`);
  }

  try {
    const profilesNeedingEmbeddings = await db
      .select({
        id: client_style_profiles.id,
        summary: client_style_profiles.raw_conversation_summary,
      })
      .from(client_style_profiles)
      .where(
        and(
          isNotNull(client_style_profiles.raw_conversation_summary),
          isNull(client_style_profiles.embedding_vector),
        ),
      )
      .limit(50);

    for (const profile of profilesNeedingEmbeddings) {
      if (!profile.summary) continue;
      try {
        const { embedding } = await embed({
          model: google.textEmbeddingModel('text-embedding-004'),
          value: profile.summary,
        });

        await db
          .update(client_style_profiles)
          .set({ embedding_vector: embedding })
          .where(eq(client_style_profiles.id, profile.id));

        results.profilesEmbedded++;
      } catch (embedError) {
        results.errors.push(
          `embedding profile ${profile.id} failed: ${embedError instanceof Error ? embedError.message : String(embedError)}`,
        );
      }
    }
  } catch (error) {
    results.errors.push(`vector generation failed: ${error instanceof Error ? error.message : String(error)}`);
  }

  return NextResponse.json(results);
}
