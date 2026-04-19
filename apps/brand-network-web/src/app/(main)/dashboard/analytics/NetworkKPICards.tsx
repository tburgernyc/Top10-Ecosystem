'use client';

import type { NetworkKPISnapshot } from '@/lib/analytics/network-queries';

interface NetworkKPICardsProps {
  kpi: NetworkKPISnapshot;
  isSuperAdmin: boolean;
}

interface KPICard {
  label: string;
  value: string | number;
  unit?: string;
  accent?: string;
}

export default function NetworkKPICards({ kpi, isSuperAdmin }: NetworkKPICardsProps) {
  const cards: KPICard[] = [
    ...(isSuperAdmin ? [{ label: 'Active Locations', value: kpi.totalActiveTenants, accent: 'var(--color-brand-secondary)' }] : []),
    { label: 'Appointments This Month', value: kpi.totalAppointmentsThisMonth.toLocaleString() },
    { label: 'Confirmation Rate', value: kpi.appointmentConfirmationRate, unit: '%', accent: kpi.appointmentConfirmationRate >= 80 ? 'var(--color-success)' : 'var(--color-warning)' },
    { label: 'Active Reservations', value: kpi.totalReservationsActive.toLocaleString(), accent: 'var(--color-brand-primary)' },
    { label: 'VTO Sessions', value: kpi.totalVtoSessionsThisMonth.toLocaleString(), accent: 'var(--color-brand-accent)' },
    { label: 'Avg Walk-In Wait', value: kpi.avgWalkInWaitMinutes, unit: ' min' },
    ...(isSuperAdmin ? [{ label: 'Inventory Utilization', value: kpi.networkReservationUtilization, unit: '%' }] : []),
  ];

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
        gap: '1rem',
      }}
    >
      {cards.map((card) => (
        <div key={card.label} className="bento-card">
          <p
            style={{
              color: 'var(--color-text-tertiary)',
              fontSize: '0.75rem',
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
              marginBottom: '0.75rem',
            }}
          >
            {card.label}
          </p>
          <p
            style={{
              fontSize: 'clamp(1.75rem, 4vw, 2.5rem)',
              fontWeight: 700,
              color: card.accent ?? 'var(--color-text-primary)',
              fontFamily: 'var(--font-mono)',
              lineHeight: 1,
            }}
          >
            {card.value}
            {card.unit && (
              <span style={{ fontSize: '0.875rem', fontWeight: 400, color: 'var(--color-text-secondary)', marginLeft: '0.25rem' }}>
                {card.unit}
              </span>
            )}
          </p>
        </div>
      ))}
    </div>
  );
}
