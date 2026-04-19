import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Journal | Top 10 Prom',
  description: 'Style guides, prom trends, and bridal inspiration from the Top 10 Prom editorial team.',
};

const FEATURED_POSTS = [
  {
    slug: 'prom-2025-trends',
    category: 'Trend Report',
    title: 'The Dresses Defining Prom 2025',
    excerpt: 'From sculptural bodices to liquid metallics — the silhouettes and fabrics every styling team is talking about this season.',
    date: 'March 15, 2025',
    image: 'https://images.unsplash.com/photo-1594938298603-c8148c4b4ae4?w=800&auto=format&fit=crop&q=85',
    readTime: '5 min',
  },
  {
    slug: 'ai-vto-guide',
    category: 'Style Tech',
    title: 'How to Use AI Virtual Try-On',
    excerpt: 'A step-by-step guide to getting the most realistic results from our AI Try-On — and what to look for in your results.',
    date: 'February 28, 2025',
    image: 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=800&auto=format&fit=crop&q=85',
    readTime: '3 min',
  },
  {
    slug: 'wedding-color-guide',
    category: 'Bridal',
    title: 'Beyond White: A Modern Bridal Color Guide',
    excerpt: 'Champagne, blush, noir. The contemporary bride is rewriting the rules — and our designers are here for it.',
    date: 'February 10, 2025',
    image: 'https://images.unsplash.com/photo-1519741347686-c1e0aadf4611?w=800&auto=format&fit=crop&q=85',
    readTime: '7 min',
  },
] as const;

export default function JournalPage() {
  return (
    <div style={{ paddingTop: '7rem' }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 2rem' }}>
        <div style={{ padding: 'clamp(2rem, 5vw, 4rem) 0', borderBottom: '1px solid var(--color-surface-border)', marginBottom: '3rem' }}>
          <p className="label-luxury" style={{ marginBottom: '1rem' }}>Editorial</p>
          <h1 className="heading-display" style={{ fontSize: 'clamp(2.5rem, 6vw, 5rem)' }}>The Journal</h1>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '2rem', paddingBottom: '4rem' }}>
          {FEATURED_POSTS.map((post) => (
            <article key={post.slug} className="glass-card" style={{ overflow: 'hidden' }}>
              <div style={{ position: 'relative', aspectRatio: '16 / 9', overflow: 'hidden' }}>
                <Image
                  src={post.image}
                  alt={post.title}
                  fill
                  style={{
                    objectFit: 'cover',
                    transition: `transform 0.6s var(--ease-luxury)`,
                  }}
                  sizes="(max-width: 640px) 100vw, (max-width: 1200px) 50vw, 33vw"
                />
              </div>
              <div style={{ padding: '1.5rem' }}>
                <p className="label-luxury" style={{ marginBottom: '0.75rem' }}>
                  {post.category} · {post.readTime} read
                </p>
                <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.375rem', fontWeight: 600, marginBottom: '0.75rem', lineHeight: 1.3 }}>
                  {post.title}
                </h2>
                <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.9375rem', lineHeight: 1.6, marginBottom: '1.25rem' }}>
                  {post.excerpt}
                </p>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <p style={{ color: 'var(--color-text-tertiary)', fontSize: '0.75rem' }}>{post.date}</p>
                  <Link
                    href={`/journal/${post.slug}`}
                    style={{
                      color: 'var(--color-brand-primary)',
                      fontSize: '0.875rem',
                      textDecoration: 'none',
                      fontWeight: 600,
                      transition: `opacity 0.2s var(--ease-luxury)`,
                    }}
                  >
                    Read →
                  </Link>
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>
    </div>
  );
}
