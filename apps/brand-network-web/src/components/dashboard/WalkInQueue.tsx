import { withTenant } from '@toptenprom/database';
import { walk_ins } from '@toptenprom/database';
import { sql } from 'drizzle-orm';
import CheckInButton from './CheckInButton';

interface Props {
  tenantId: string;
  userId: string;
  userRole: string;
}

export default async function WalkInQueue({ tenantId, userId, userRole }: Props) {
  let queue: (typeof walk_ins.$inferSelect)[] = [];

  try {
    queue = await withTenant(tenantId, userId, userRole as 'receptionist', async (tx) => {
      return tx
        .select()
        .from(walk_ins)
        .where(sql`tenant_id = ${tenantId} AND status IN ('waiting', 'called')`)
        .orderBy(walk_ins.queue_position);
    });
  } catch (error) {
    console.error('[WalkInQueue] Query failed:', error);
    return (
      <p style={{ color: 'var(--color-text-tertiary)', fontSize: '0.875rem' }}>
        Queue unavailable
      </p>
    );
  }

  if (queue.length === 0) {
    return (
      <p style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem', textAlign: 'center', padding: '2rem 0' }}>
        No customers currently waiting
      </p>
    );
  }

  return (
    <ul style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', listStyle: 'none' }}>
      {queue.map((walkIn) => (
        <li
          key={walkIn.id}
          className="glass-card"
          style={{ padding: '1rem 1.25rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
        >
          <div>
            <p style={{ fontWeight: 600, color: 'var(--color-text)' }}>{walkIn.customer_name}</p>
            <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '0.25rem' }}>
              Party of {walkIn.party_size} · {walkIn.occasion ?? 'General'}
              {walkIn.estimated_wait_minutes != null && ` · ~${walkIn.estimated_wait_minutes}m wait`}
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span
              style={{
                padding: '0.25rem 0.75rem',
                borderRadius: 'var(--radius-pill)',
                fontSize: '0.75rem',
                fontWeight: 600,
                background: walkIn.status === 'waiting'
                  ? 'rgba(255, 214, 10, 0.15)'
                  : 'rgba(50, 215, 75, 0.15)',
                color: walkIn.status === 'waiting'
                  ? 'var(--color-warning)'
                  : 'var(--color-success)',
              }}
            >
              {walkIn.status}
            </span>
            <CheckInButton walkInId={walkIn.id} currentStatus={walkIn.status} />
          </div>
        </li>
      ))}
    </ul>
  );
}
