'use client';

import { useState, useTransition } from 'react';
import { castVote } from '@/actions/vote-actions';

interface Dress {
  id: string;
  name: string;
  designer: string | null;
  image_urls: unknown;
  price: string | null;
  occasion: string | null;
}

interface VoteTallyRow {
  dress_id: string;
  vote_type: string;
  count: number;
}

interface VoteClientProps {
  sessionId: string;
  shareToken: string;
  dresses: Dress[];
  voteTally: VoteTallyRow[];
}

type VoteType = 'love' | 'like' | 'maybe' | 'pass';

const VOTE_OPTIONS: { type: VoteType; emoji: string; label: string; color: string }[] = [
  { type: 'love', emoji: '💖', label: 'Love it', color: 'var(--color-primary)' },
  { type: 'like', emoji: '👍', label: 'Like it', color: 'var(--color-success)' },
  { type: 'maybe', emoji: '🤔', label: 'Maybe', color: 'var(--color-warning)' },
  { type: 'pass', emoji: '👎', label: 'Pass', color: 'var(--color-text-tertiary)' },
];

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export default function VoteClient({ sessionId: _sessionId, shareToken, dresses, voteTally }: VoteClientProps) {
  const [votes, setVotes] = useState<Record<string, VoteType>>({});
  const [displayName, setDisplayName] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const getTally = (dressId: string, type: VoteType): number =>
    voteTally.find((r) => r.dress_id === dressId && r.vote_type === type)?.count ?? 0;

  const handleVote = (dressId: string, voteType: VoteType) => {
    if (submitted) return;
    setVotes((prev) => ({ ...prev, [dressId]: voteType }));
  };

  const handleSubmit = () => {
    const entries = Object.entries(votes);
    if (entries.length === 0) {
      setError('Please vote on at least one dress before submitting.');
      return;
    }

    startTransition(async () => {
      setError(null);
      for (const [dressId, voteType] of entries) {
        const result = await castVote({
          shareToken,
          dressId,
          voteType,
          ...(displayName.trim() ? { voterDisplayName: displayName.trim() } : {}),
        });
        if (!result.success) {
          setError(result.error ?? 'Failed to submit votes.');
          return;
        }
      }
      setSubmitted(true);
    });
  };

  if (submitted) {
    return (
      <div className="glass-card" style={{ padding: '4rem 2rem', textAlign: 'center' }}>
        <p style={{ fontSize: '3rem', marginBottom: '1rem' }}>💖</p>
        <h2 className="heading-section" style={{ marginBottom: '0.75rem' }}>
          Thanks{displayName ? `, ${displayName}` : ''}!
        </h2>
        <p style={{ color: 'var(--color-text-muted)' }}>
          Your votes have been counted. The results will help pick the perfect dress.
        </p>
      </div>
    );
  }

  const imageUrls = (dress: Dress): string[] => {
    const raw = dress.image_urls;
    if (Array.isArray(raw) && raw.length > 0) return raw as string[];
    return ['https://images.unsplash.com/photo-1594938298603-c8148c4b4ae4?w=800&auto=format&fit=crop&q=85'];
  };

  return (
    <div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', marginBottom: '2.5rem' }}>
        {dresses.map((dress) => (
          <div key={dress.id} className="glass-card" style={{ padding: '1.5rem', display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
            <div style={{ flexShrink: 0, width: '140px', height: '180px', borderRadius: 'var(--radius-md)', overflow: 'hidden', background: 'var(--color-bg-sunken)' }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={imageUrls(dress)[0]}
                alt={dress.name}
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                loading="lazy"
              />
            </div>

            <div style={{ flex: 1, minWidth: '200px', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div>
                <p className="label-luxury">{dress.designer ?? 'House Collection'}</p>
                <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.25rem', fontWeight: 600 }}>{dress.name}</h3>
                {dress.price && (
                  <p style={{ color: 'var(--color-brand-secondary)', fontSize: '0.9375rem', marginTop: '0.25rem' }}>
                    ${dress.price}
                  </p>
                )}
              </div>

              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                {VOTE_OPTIONS.map((opt) => {
                  const isSelected = votes[dress.id] === opt.type;
                  const tally = getTally(dress.id, opt.type);
                  return (
                    <button
                      key={opt.type}
                      type="button"
                      onClick={() => handleVote(dress.id, opt.type)}
                      disabled={submitted}
                      style={{
                        background: isSelected ? opt.color : 'var(--color-bg-glass)',
                        border: `1px solid ${isSelected ? opt.color : 'var(--color-border)'}`,
                        borderRadius: 'var(--radius-pill)',
                        padding: '0.5rem 1rem',
                        color: isSelected ? (opt.type === 'love' || opt.type === 'like' ? 'var(--color-text-inverse)' : 'var(--color-text)') : 'var(--color-text-muted)',
                        fontSize: '0.875rem',
                        cursor: submitted ? 'not-allowed' : 'pointer',
                        transition: 'all var(--duration-fast) var(--ease-in-out-silk)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.375rem',
                      }}
                    >
                      <span>{opt.emoji}</span>
                      <span>{opt.label}</span>
                      {tally > 0 && (
                        <span style={{ opacity: 0.6, fontSize: '0.75rem' }}>·{tally}</span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="glass-card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <div>
          <label style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem', display: 'block', marginBottom: '0.5rem' }}>
            Your name (optional)
          </label>
          <input
            type="text"
            className="input-luxury"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="e.g. Emma"
            maxLength={60}
            disabled={isPending}
            style={{ maxWidth: '320px' }}
          />
        </div>

        {error && (
          <p style={{ color: 'var(--color-error)', fontSize: '0.875rem' }}>{error}</p>
        )}

        <button
          type="button"
          className="btn-primary"
          onClick={handleSubmit}
          disabled={isPending || Object.keys(votes).length === 0}
          style={{ alignSelf: 'flex-start' }}
        >
          {isPending ? 'Submitting…' : `Submit ${Object.keys(votes).length > 0 ? `${Object.keys(votes).length} Vote${Object.keys(votes).length > 1 ? 's' : ''}` : 'Votes'}`}
        </button>
      </div>
    </div>
  );
}
