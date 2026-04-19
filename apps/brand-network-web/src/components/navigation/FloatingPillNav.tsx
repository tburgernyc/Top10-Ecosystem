'use client';

import Link from 'next/link';
import { useParams, usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';

const CORPORATE_LINKS = [
  { label: 'Find a Boutique', href: '/locator' },
  { label: 'Catalog', href: '/catalog' },
  { label: 'Virtual Try-On', href: '/try-on' },
  { label: 'Book', href: '/book' },
  { label: 'Journal', href: '/journal' },
] as const;

export default function FloatingPillNav() {
  const params = useParams();
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);

  const subdomain = typeof params?.subdomain === 'string' ? params.subdomain : null;

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handler, { passive: true });
    return () => window.removeEventListener('scroll', handler);
  }, []);

  const buildHref = (href: string): string =>
    subdomain ? `/${subdomain}${href}` : href;

  return (
    <nav
      className="floating-pill-nav"
      style={{
        boxShadow: scrolled ? '0 8px 40px rgba(0,0,0,0.60)' : 'none',
        transition: 'box-shadow 0.3s ease',
      }}
      aria-label="Primary navigation"
    >
      <Link
        href={subdomain ? `/${subdomain}` : '/home'}
        style={{
          fontFamily: 'var(--font-display)',
          fontSize: '1.125rem',
          fontWeight: 700,
          color: 'var(--color-brand-secondary)',
          textDecoration: 'none',
          letterSpacing: '-0.01em',
          marginRight: '0.5rem',
        }}
        aria-label="Top 10 Prom — Home"
      >
        TOP 10
      </Link>

      <span
        style={{
          width: '1px',
          height: '1.25rem',
          background: 'var(--color-surface-border-md)',
          display: 'block',
        }}
        aria-hidden="true"
      />

      {CORPORATE_LINKS.map(({ label, href }) => {
        const builtHref = buildHref(href);
        const isActive = pathname === builtHref || pathname.startsWith(`${builtHref}/`);
        return (
          <Link
            key={href}
            href={builtHref}
            className={`nav-link ${isActive ? 'active' : ''}`}
          >
            {label}
          </Link>
        );
      })}

      <Link href="/login" className="btn-primary" style={{ padding: '0.5rem 1.25rem', fontSize: '0.875rem' }}>
        Sign In
      </Link>
    </nav>
  );
}
