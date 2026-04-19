import { withTenant } from '@toptenprom/database';
import { client_style_profiles, customers } from '@toptenprom/database';
import { eq } from 'drizzle-orm';

interface Props {
  tenantId: string;
  userId: string;
}

export default async function ClientProfile({ tenantId, userId }: Props) {
  let profiles: Array<{
    id: string;
    preferred_designers: string[] | null;
    preferred_silhouettes: string[] | null;
    budget_min: string | null;
    budget_max: string | null;
    raw_conversation_summary: string | null;
  }> = [];

  try {
    profiles = await withTenant(tenantId, userId, 'stylist', async (tx) => {
      return tx
        .select({
          id: client_style_profiles.id,
          preferred_designers: client_style_profiles.preferred_designers,
          preferred_silhouettes: client_style_profiles.preferred_silhouettes,
          budget_min: client_style_profiles.budget_min,
          budget_max: client_style_profiles.budget_max,
          raw_conversation_summary: client_style_profiles.raw_conversation_summary,
        })
        .from(client_style_profiles)
        .innerJoin(customers, eq(client_style_profiles.user_id, customers.user_id))
        .where(eq(customers.user_id, userId))
        .limit(10);
    });
  } catch (error) {
    console.error('[ClientProfile] Query failed:', error);
    return (
      <div className="glass-card" style={{ padding: '1.5rem' }}>
        <p style={{ color: 'var(--color-text-tertiary)' }}>Client profiles unavailable</p>
      </div>
    );
  }

  return (
    <div className="glass-card" style={{ padding: '1.5rem' }}>
      <p className="label-luxury" style={{ marginBottom: '1.25rem' }}>Style Profiles</p>
      {profiles.length === 0 ? (
        <p style={{ color: 'var(--color-text-secondary)', textAlign: 'center', padding: '2rem 0', fontSize: '0.875rem' }}>
          No client profiles yet
        </p>
      ) : (
        <ul style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', listStyle: 'none' }}>
          {profiles.map((profile) => (
            <li
              key={profile.id}
              style={{
                padding: '1rem',
                borderRadius: 'var(--radius-md)',
                background: 'var(--color-surface-glass)',
                border: '1px solid var(--color-surface-border)',
              }}
            >
              {profile.preferred_designers && profile.preferred_designers.length > 0 && (
                <p style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)' }}>
                  Designers: {profile.preferred_designers.join(', ')}
                </p>
              )}
              {profile.budget_min != null && profile.budget_max != null && (
                <p style={{ fontSize: '0.75rem', color: 'var(--color-text-tertiary)', marginTop: '0.25rem' }}>
                  Budget: ${profile.budget_min} – ${profile.budget_max}
                </p>
              )}
              {profile.raw_conversation_summary && (
                <p style={{ fontSize: '0.75rem', color: 'var(--color-text-tertiary)', marginTop: '0.5rem', lineHeight: 1.5 }}>
                  {profile.raw_conversation_summary.slice(0, 120)}…
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
