import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { db } from '@toptenprom/database';
import { bridal_parties, bridal_party_members, customers } from '@toptenprom/database';
import { eq } from 'drizzle-orm';
import BridalPartyClient from './BridalPartyClient';

export const metadata: Metadata = {
  title: 'Bridal Party | Top 10 Prom Dashboard',
  robots: { index: false },
};

export default async function BridalPartyPage() {
  const supabase = await createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  if (!authUser) redirect('/login');

  let customerId: string | null = null;
  try {
    const result = await db
      .select({ id: customers.id })
      .from(customers)
      .where(eq(customers.user_id, authUser.id))
      .limit(1);
    customerId = result[0]?.id ?? null;
  } catch {
    // Non-fatal — handled in client
  }

  let parties: { id: string; name: string; occasion: string; invite_code: string; is_active: boolean }[] = [];
  if (customerId) {
    try {
      const memberRecords = await db
        .select({ party_id: bridal_party_members.party_id })
        .from(bridal_party_members)
        .where(eq(bridal_party_members.customer_id, customerId));

      const partyIds = memberRecords.map((r) => r.party_id);

      if (partyIds.length > 0) {
        parties = await db
          .select({
            id: bridal_parties.id,
            name: bridal_parties.name,
            occasion: bridal_parties.occasion,
            invite_code: bridal_parties.invite_code,
            is_active: bridal_parties.is_active,
          })
          .from(bridal_parties)
          .where(eq(bridal_parties.is_active, true));
      }
    } catch {
      // Non-fatal
    }
  }

  return (
    <div style={{ padding: 'clamp(1.5rem, 4vw, 3rem)' }}>
      <div style={{ marginBottom: '2.5rem' }}>
        <p className="label-luxury" style={{ marginBottom: '0.5rem' }}>Dashboard</p>
        <h1 className="heading-section" style={{ fontSize: 'clamp(1.75rem, 4vw, 2.5rem)' }}>
          Bridal Party
        </h1>
        <p style={{ color: 'var(--color-text-muted)', marginTop: '0.5rem', maxWidth: '560px' }}>
          Create or join a shopping group. Coordinate outfits and see each member&apos;s shortlisted dresses in one place.
        </p>
      </div>

      <BridalPartyClient customerId={customerId} parties={parties} />
    </div>
  );
}
