import type React from 'react';

export default function AnalyticsSkeleton({ type }: { type: 'cards' | 'chart' | 'table' }) {
  const shimmer = {
    background: 'linear-gradient(90deg, var(--color-bg-elevated) 25%, rgba(255,255,255,0.04) 50%, var(--color-bg-elevated) 75%)',
    backgroundSize: '200% 100%',
    animation: 'shimmer 1.5s infinite',
    borderRadius: 'var(--radius-lg)',
  } as React.CSSProperties;

  if (type === 'cards') {
    return (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1rem' }}>
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} style={{ ...shimmer, height: '100px' }} />
        ))}
      </div>
    );
  }

  if (type === 'chart') {
    return <div style={{ ...shimmer, height: '293px' }} />;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} style={{ ...shimmer, height: '56px' }} />
      ))}
      <style>{`@keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }`}</style>
    </div>
  );
}
