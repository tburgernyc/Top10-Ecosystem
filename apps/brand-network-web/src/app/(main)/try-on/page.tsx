import type { Metadata } from 'next';
import TryOnForm from './TryOnForm';

export const metadata: Metadata = {
  title: 'Virtual Try-On | Top 10 Prom',
  description: 'See how any dress looks on you with our AI-powered Virtual Try-On experience.',
};

export default function TryOnPage() {
  return (
    <div
      className="mesh-bg"
      style={{ minHeight: '100dvh', paddingTop: '8rem', paddingBottom: '4rem' }}
    >
      <div style={{ maxWidth: '900px', margin: '0 auto', padding: '0 2rem' }}>
        {/* Hero header */}
        <div style={{ textAlign: 'center', marginBottom: '4rem' }}>
          <p className="label-luxury" style={{ color: 'var(--color-brand-accent)', marginBottom: '1rem' }}>
            AI-Powered Experience
          </p>
          <h1 className="heading-display" style={{ fontSize: 'clamp(2.5rem, 6vw, 5rem)', marginBottom: '1.5rem' }}>
            Virtual Try-On
          </h1>
          <p style={{ color: 'var(--color-text-secondary)', fontSize: '1.125rem', maxWidth: '560px', margin: '0 auto', lineHeight: 1.7 }}>
            Upload a photo and see any dress from our catalog on you in seconds, powered by generative AI.
          </p>
        </div>

        <TryOnForm />
      </div>
    </div>
  );
}
