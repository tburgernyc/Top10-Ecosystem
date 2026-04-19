'use client';

import { useState, useTransition } from 'react';
import { onboardFranchiseLocation } from '@/actions/franchise-actions';

export default function FranchiseOnboardingForm() {
  const [fields, setFields] = useState({
    name: '', subdomain: '', address: '', city: '', state: '', zip: '',
    phone: '', email: '', lat: '', lng: '', timezone: 'America/New_York',
    maxDailyAppointments: '30', ownerFirstName: '', ownerLastName: '', ownerEmail: '',
  });
  const [result, setResult] = useState<{ success: boolean; message: string; inviteLink?: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  const set = (key: keyof typeof fields) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setFields((prev) => ({ ...prev, [key]: e.target.value }));

  const handleSubmit = () => {
    const lat = parseFloat(fields.lat);
    const lng = parseFloat(fields.lng);
    const maxAppts = parseInt(fields.maxDailyAppointments, 10);

    if (isNaN(lat) || isNaN(lng)) {
      setResult({ success: false, message: 'Latitude and longitude must be valid numbers.' });
      return;
    }

    startTransition(async () => {
      setResult(null);
      const res = await onboardFranchiseLocation({
        name: fields.name, subdomain: fields.subdomain, address: fields.address,
        city: fields.city, state: fields.state, zip: fields.zip, phone: fields.phone,
        email: fields.email, lat, lng, timezone: fields.timezone,
        maxDailyAppointments: isNaN(maxAppts) ? 30 : maxAppts,
        ownerFirstName: fields.ownerFirstName, ownerLastName: fields.ownerLastName,
        ownerEmail: fields.ownerEmail,
      });

      if (res.success) {
        setResult({ success: true, message: `Location "${fields.name}" created successfully. Owner invite link generated.`, inviteLink: res.inviteLink });
        setFields({ name: '', subdomain: '', address: '', city: '', state: '', zip: '', phone: '', email: '', lat: '', lng: '', timezone: 'America/New_York', maxDailyAppointments: '30', ownerFirstName: '', ownerLastName: '', ownerEmail: '' });
      } else {
        setResult({ success: false, message: res.error });
      }
    });
  };

  const inputStyle = { display: 'flex', flexDirection: 'column' as const, gap: '0.375rem' };
  const labelStyle: React.CSSProperties = { color: 'var(--color-text-secondary)', fontSize: '0.8125rem' };

  return (
    <div className="glass-card" style={{ padding: '2rem', maxWidth: '720px' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
        <div style={inputStyle}>
          <label style={labelStyle}>Boutique Name *</label>
          <input className="input-luxury" value={fields.name} onChange={set('name')} placeholder="Top 10 Prom — Midtown" disabled={isPending} />
        </div>
        <div style={inputStyle}>
          <label style={labelStyle}>Subdomain *</label>
          <input className="input-luxury" value={fields.subdomain} onChange={set('subdomain')} placeholder="midtown" disabled={isPending} />
        </div>
        <div style={{ ...inputStyle, gridColumn: '1 / -1' }}>
          <label style={labelStyle}>Street Address *</label>
          <input className="input-luxury" value={fields.address} onChange={set('address')} placeholder="123 Fifth Avenue" disabled={isPending} />
        </div>
        <div style={inputStyle}>
          <label style={labelStyle}>City *</label>
          <input className="input-luxury" value={fields.city} onChange={set('city')} placeholder="New York" disabled={isPending} />
        </div>
        <div style={inputStyle}>
          <label style={labelStyle}>State *</label>
          <input className="input-luxury" value={fields.state} onChange={set('state')} placeholder="NY" maxLength={2} disabled={isPending} />
        </div>
        <div style={inputStyle}>
          <label style={labelStyle}>ZIP *</label>
          <input className="input-luxury" value={fields.zip} onChange={set('zip')} placeholder="10036" disabled={isPending} />
        </div>
        <div style={inputStyle}>
          <label style={labelStyle}>Phone *</label>
          <input className="input-luxury" value={fields.phone} onChange={set('phone')} placeholder="(212) 555-0100" disabled={isPending} />
        </div>
        <div style={inputStyle}>
          <label style={labelStyle}>Contact Email *</label>
          <input className="input-luxury" type="email" value={fields.email} onChange={set('email')} placeholder="midtown@toptenprom.com" disabled={isPending} />
        </div>
        <div style={inputStyle}>
          <label style={labelStyle}>Latitude *</label>
          <input className="input-luxury" value={fields.lat} onChange={set('lat')} placeholder="40.7549" disabled={isPending} />
        </div>
        <div style={inputStyle}>
          <label style={labelStyle}>Longitude *</label>
          <input className="input-luxury" value={fields.lng} onChange={set('lng')} placeholder="-73.9840" disabled={isPending} />
        </div>
        <div style={inputStyle}>
          <label style={labelStyle}>Max Daily Appointments</label>
          <input className="input-luxury" type="number" value={fields.maxDailyAppointments} onChange={set('maxDailyAppointments')} min="1" max="200" disabled={isPending} />
        </div>
        <div style={inputStyle}>
          <label style={labelStyle}>Timezone</label>
          <select className="input-luxury" value={fields.timezone} onChange={set('timezone')} disabled={isPending}>
            <option value="America/New_York">Eastern (ET)</option>
            <option value="America/Chicago">Central (CT)</option>
            <option value="America/Denver">Mountain (MT)</option>
            <option value="America/Los_Angeles">Pacific (PT)</option>
          </select>
        </div>
      </div>

      <div style={{ borderTop: '1px solid var(--color-surface-border)', paddingTop: '1.25rem', marginTop: '0.5rem', marginBottom: '1rem' }}>
        <p className="label-luxury" style={{ marginBottom: '0.875rem' }}>Owner Account</p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
          <div style={inputStyle}>
            <label style={labelStyle}>First Name *</label>
            <input className="input-luxury" value={fields.ownerFirstName} onChange={set('ownerFirstName')} placeholder="Morgan" disabled={isPending} />
          </div>
          <div style={inputStyle}>
            <label style={labelStyle}>Last Name *</label>
            <input className="input-luxury" value={fields.ownerLastName} onChange={set('ownerLastName')} placeholder="Flagship" disabled={isPending} />
          </div>
          <div style={{ ...inputStyle, gridColumn: '1 / -1' }}>
            <label style={labelStyle}>Owner Email * (receives login invite)</label>
            <input className="input-luxury" type="email" value={fields.ownerEmail} onChange={set('ownerEmail')} placeholder="owner@toptenprom.com" disabled={isPending} />
          </div>
        </div>
      </div>

      {result && (
        <div
          className="glass-card"
          style={{ padding: '1rem', marginBottom: '1rem', borderColor: result.success ? 'rgba(50,215,75,0.3)' : 'rgba(255,69,58,0.3)' }}
        >
          <p style={{ color: result.success ? 'var(--color-success)' : 'var(--color-error)', fontSize: '0.875rem', marginBottom: result.inviteLink ? '0.5rem' : 0 }}>
            {result.message}
          </p>
          {result.inviteLink && (
            <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.8125rem', wordBreak: 'break-all' }}>
              Invite link:{' '}
              <a href={result.inviteLink} style={{ color: 'var(--color-brand-primary)', textDecoration: 'none' }}>
                {result.inviteLink}
              </a>
            </p>
          )}
        </div>
      )}

      <button
        type="button"
        className="btn-primary"
        onClick={handleSubmit}
        disabled={isPending || !fields.name || !fields.subdomain || !fields.ownerEmail}
      >
        {isPending ? 'Creating Location…' : 'Onboard Location'}
      </button>
    </div>
  );
}
