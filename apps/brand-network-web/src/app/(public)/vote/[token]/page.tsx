import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { db } from '@toptenprom/database';
import { dress_vote_sessions, dresses, dress_votes } from '@toptenprom/database';
import { eq, and, sql } from 'drizzle-orm';
import VoteClient from './VoteClient';

interface VotePageProps {
  params: Promise<{ token: string }>;
}

export async function generateMetadata({ params }: VotePageProps): Promise<Metadata> {
  const { token } = await params;
  try {
    const result = await db
      .select({ title: dress_vote_sessions.title, vote_count: dress_vote_sessions.vote_count })
      .from(dress_vote_sessions)
      .where(and(eq(dress_vote_sessions.share_token, token), eq(dress_vote_sessions.is_active, true)))
      .limit(1);

    const session = result[0];
    if (!session) return { title: 'Vote | Top 10 Prom' };

    return {
      title: `${session.title ?? 'Vote on my dresses!'} | Top 10 Prom`,
      description: `${session.vote_count} people have already voted. Cast your vote now!`,
      openGraph: {
        images: [
          {
            url: `/api/og/vote?title=${encodeURIComponent(session.title ?? 'Help me pick!')}&votes=${session.vote_count}`,
            width: 1200,
            height: 630,
          },
        ],
      },
      twitter: {
        card: 'summary_large_image',
      },
    };
  } catch {
    return { title: 'Vote | Top 10 Prom' };
  }
}

async function getVoteSessionData(token: string) {

  const sessionResult = await db
    .select()
    .from(dress_vote_sessions)
    .where(and(eq(dress_vote_sessions.share_token, token), eq(dress_vote_sessions.is_active, true)))
    .limit(1);

  const session = sessionResult[0];
  if (!session) return null;

  if (new Date() > new Date(session.expires_at)) return null;

  const dressIds = session.dress_ids as string[];
  const dressData = await db
    .select({
      id: dresses.id,
      name: dresses.name,
      designer: dresses.designer,
      image_urls: dresses.image_urls,
      price: dresses.retail_price,
      occasion: dresses.occasion,
    })
    .from(dresses)
    .where(sql`${dresses.id} = ANY(${dressIds}::uuid[])`);

  const voteTally = await db
    .select({
      dress_id: dress_votes.dress_id,
      vote_type: dress_votes.vote_type,
      count: sql<number>`cast(count(*) as int)`,
    })
    .from(dress_votes)
    .where(eq(dress_votes.session_id, session.id))
    .groupBy(dress_votes.dress_id, dress_votes.vote_type);

  return { session, dresses: dressData, voteTally };
}

export default async function VotePage({ params }: VotePageProps) {
  const { token } = await params;
  const data = await getVoteSessionData(token);

  if (!data) {
    notFound();
  }

  return (
    <div
      className="mesh-bg"
      style={{ minHeight: '100dvh', padding: 'clamp(5rem, 10vw, 7rem) 1.5rem 3rem' }}
    >
      <div style={{ maxWidth: '900px', margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
          <p className="label-luxury" style={{ marginBottom: '0.75rem' }}>
            Friend Vote · {data.session.vote_count} votes cast
          </p>
          <h1
            className="heading-display"
            style={{ fontSize: 'clamp(2rem, 5vw, 3.5rem)', lineHeight: 1.1 }}
          >
            {data.session.title ?? 'Help me pick! 💖'}
          </h1>
          <p style={{ color: 'var(--color-text-secondary)', marginTop: '1rem', fontSize: '0.9375rem' }}>
            Expires {new Date(data.session.expires_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}
          </p>
        </div>

        <VoteClient
          sessionId={data.session.id}
          shareToken={token}
          dresses={data.dresses}
          voteTally={data.voteTally}
        />
      </div>
    </div>
  );
}
