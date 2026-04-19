'use client';

import type { TenantKPIRow } from '@/lib/analytics/network-queries';

interface TenantKPITableProps {
  rows: TenantKPIRow[];
}

export default function TenantKPITable({ rows }: TenantKPITableProps) {
  if (rows.length === 0) {
    return (
      <div className="glass-card" style={{ padding: '2rem', textAlign: 'center' }}>
        <p style={{ color: 'var(--color-text-tertiary)' }}>No tenant data available.</p>
      </div>
    );
  }

  const columns = [
    { key: 'tenantName', label: 'Location' },
    { key: 'appointmentsThisMonth', label: 'Appts (Mo)' },
    { key: 'confirmedAppointments', label: 'Confirmed' },
    { key: 'activeReservations', label: 'Reservations' },
    { key: 'vtoSessionsThisMonth', label: 'VTO' },
    { key: 'avgWalkInWaitMinutes', label: 'Avg Wait (min)' },
    { key: 'staffCount', label: 'Staff' },
    { key: 'totalDressInventory', label: 'Inventory' },
  ] as const;

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '800px' }}>
        <thead>
          <tr>
            {columns.map((col) => (
              <th
                key={col.key}
                style={{
                  padding: '0.75rem 1rem',
                  textAlign: col.key === 'tenantName' ? 'left' : 'center',
                  color: 'var(--color-text-tertiary)',
                  fontSize: '0.6875rem',
                  textTransform: 'uppercase',
                  letterSpacing: '0.1em',
                  borderBottom: '1px solid var(--color-border)',
                  fontFamily: 'var(--font-ui)',
                  fontWeight: 500,
                  whiteSpace: 'nowrap',
                }}
              >
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, idx) => (
            <tr
              key={row.tenantId}
              style={{
                background: idx % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.015)',
              }}
            >
              <td style={{ padding: '0.875rem 1rem', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                <p style={{ fontWeight: 600, color: 'var(--color-text)', fontSize: '0.9375rem', marginBottom: '0.125rem' }}>
                  {row.tenantName}
                </p>
                <p style={{ color: 'var(--color-text-tertiary)', fontSize: '0.75rem', fontFamily: 'var(--font-mono)' }}>
                  {row.subdomain}.toptenprom.com
                </p>
              </td>
              {(['appointmentsThisMonth', 'confirmedAppointments', 'activeReservations', 'vtoSessionsThisMonth', 'avgWalkInWaitMinutes', 'staffCount', 'totalDressInventory'] as const).map((key) => (
                <td
                  key={key}
                  style={{
                    padding: '0.875rem 1rem',
                    textAlign: 'center',
                    borderBottom: '1px solid rgba(255,255,255,0.04)',
                    fontFamily: 'var(--font-mono)',
                    fontSize: '0.9375rem',
                    color: key === 'activeReservations' ? 'var(--color-primary)' : key === 'vtoSessionsThisMonth' ? 'var(--color-brand-accent)' : 'var(--color-text)',
                  }}
                >
                  {row[key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
