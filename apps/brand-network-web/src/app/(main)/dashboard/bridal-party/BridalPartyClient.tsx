'use client';

import Link from 'next/link';
import { useState, useTransition } from 'react';
import { createBridalParty, joinBridalParty } from '@/actions/bridal-party-actions';
import { useRouter } from 'next/navigation';

interface Party {
  id: string;
  name: string;
  occasion: string;
  invite_code: string;
  is_active: boolean;
}

interface BridalPartyClientProps {
  customerId: string | null;
  parties: Party[];
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export default function BridalPartyClient({ customerId: _customerId, parties }: BridalPartyClientProps) {
  const [mode, setMode] = useState<'idle' | 'create' | 'join'>('idle');
  const [partyName, setPartyName] = useState('');
  const [occasion, setOccasion] = useState<'prom' | 'wedding' | 'homecoming'>('prom');
  const [schoolName, setSchoolName] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const handleCreate = () => {
    if (!partyName.trim()) return;
    startTransition(async () => {
      setFeedback(null);
      const result = await createBridalParty({
        tenantId: '00000000-0000-0000-0000-000000000001',
        name: partyName.trim(),
        occasion,
        ...(schoolName.trim() ? { schoolName: schoolName.trim() } : {}),
      });
      if (result.success) {
        setFeedback({ type: 'success', message: `Party created! Invite code: ${result.inviteCode}` });
        setMode('idle');
        router.refresh();
      } else {
        setFeedback({ type: 'error', message: result.error ?? 'Failed to create party.' });
      }
    });
  };

  const handleJoin = () => {
    if (!inviteCode.trim()) return;
    startTransition(async () => {
      setFeedback(null);
      const result = await joinBridalParty({ inviteCode: inviteCode.trim() });
      if (result.success) {
        setFeedback({ type: 'success', message: `Joined "${result.partyName}"!` });
        setMode('idle');
        router.refresh();
      } else {
        setFeedback({ type: 'error', message: result.error ?? 'Failed to join.' });
      }
    });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      {parties.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1.25rem' }}>
          {parties.map((party) => (
            <Link
              key={party.id}
              href={`/dashboard/bridal-party/${party.id}`}
              style={{ textDecoration: 'none' }}
            >
              <div className="glass-card" style={{ padding: '1.5rem', cursor: 'pointer' }}>
                <p className="label-luxury" style={{ marginBottom: '0.5rem', textTransform: 'capitalize' }}>
                  {party.occasion}
                </p>
                <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.125rem', fontWeight: 600, marginBottom: '0.75rem' }}>
                  {party.name}
                </h3>
                <p style={{ color: 'var(--color-text-tertiary)', fontSize: '0.75rem', fontFamily: 'var(--font-mono)', letterSpacing: '0.05em' }}>
                  Invite: {party.invite_code}
                </p>
              </div>
            </Link>
          ))}
        </div>
      )}

      {mode === 'idle' && (
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
          <button type="button" className="btn-primary" onClick={() => setMode('create')}>
            + Create Party
          </button>
          <button type="button" className="btn-ghost" onClick={() => setMode('join')}>
            Join via Invite Code
          </button>
        </div>
      )}

      {mode === 'create' && (
        <div className="glass-card" style={{ padding: '2rem', maxWidth: '480px', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <h2 className="heading-section" style={{ fontSize: '1.25rem', marginBottom: '0.5rem' }}>Create a Party</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <label style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>Party Name</label>
            <input type="text" className="input-luxury" value={partyName} onChange={(e) => setPartyName(e.target.value)} placeholder="e.g. Madison's Prom Squad 2025" disabled={isPending} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <label style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>Occasion</label>
            <select className="input-luxury" value={occasion} onChange={(e) => setOccasion(e.target.value as typeof occasion)} disabled={isPending}>
              <option value="prom">Prom</option>
              <option value="wedding">Wedding</option>
              <option value="homecoming">Homecoming</option>
            </select>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <label style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>School (optional)</label>
            <input type="text" className="input-luxury" value={schoolName} onChange={(e) => setSchoolName(e.target.value)} placeholder="e.g. Lincoln High School" disabled={isPending} />
          </div>
          {feedback && (
            <p style={{ color: feedback.type === 'error' ? 'var(--color-error)' : 'var(--color-success)', fontSize: '0.875rem' }}>{feedback.message}</p>
          )}
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button type="button" className="btn-primary" onClick={handleCreate} disabled={isPending || !partyName.trim()}>{isPending ? 'Creating…' : 'Create'}</button>
            <button type="button" className="btn-ghost" onClick={() => setMode('idle')} disabled={isPending}>Cancel</button>
          </div>
        </div>
      )}

      {mode === 'join' && (
        <div className="glass-card" style={{ padding: '2rem', maxWidth: '400px', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <h2 className="heading-section" style={{ fontSize: '1.25rem', marginBottom: '0.5rem' }}>Join a Party</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <label style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>Invite Code</label>
            <input type="text" className="input-luxury" value={inviteCode} onChange={(e) => setInviteCode(e.target.value.toLowerCase())} placeholder="e.g. a3f9c2b1..." disabled={isPending} />
          </div>
          {feedback && (
            <p style={{ color: feedback.type === 'error' ? 'var(--color-error)' : 'var(--color-success)', fontSize: '0.875rem' }}>{feedback.message}</p>
          )}
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button type="button" className="btn-primary" onClick={handleJoin} disabled={isPending || !inviteCode.trim()}>{isPending ? 'Joining…' : 'Join'}</button>
            <button type="button" className="btn-ghost" onClick={() => setMode('idle')} disabled={isPending}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}
