import Link from 'next/link';

const FOOTER_LINKS = {
  Explore: [
    { label: 'Find a Boutique', href: '/locator' },
    { label: 'Prom Dresses', href: '/catalog?occasion=prom' },
    { label: 'Wedding Dresses', href: '/catalog?occasion=wedding' },
    { label: 'Virtual Try-On', href: '/try-on' },
    { label: 'Book Appointment', href: '/book' },
  ],
  Company: [
    { label: 'About Us', href: '/about' },
    { label: 'Journal', href: '/journal' },
    { label: 'Contact', href: '/contact' },
    { label: 'Careers', href: '/careers' },
  ],
  Legal: [
    { label: 'Privacy Policy', href: '/privacy' },
    { label: 'Terms of Service', href: '/terms' },
    { label: 'Accessibility', href: '/accessibility' },
  ],
} as const;

export default function Footer() {
  return (
    <footer
      style={{
        background: 'var(--color-bg-elevated)',
        borderTop: '1px solid var(--color-surface-border)',
        padding: '4rem 0 2rem',
        marginTop: 'auto',
      }}
    >
      <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 2rem' }}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '2fr 1fr 1fr 1fr',
            gap: '3rem',
            marginBottom: '3rem',
          }}
        >
          <div>
            <p className="heading-display" style={{ fontSize: '2rem', marginBottom: '1rem' }}>
              TOP 10 <span style={{ color: 'var(--color-brand-secondary)' }}>PROM</span>
            </p>
            <p className="text-muted" style={{ lineHeight: 1.7, maxWidth: '280px' }}>
              Discover your perfect look at one of our 55 luxury boutique locations across the network.
            </p>
            <p className="label-luxury" style={{ marginTop: '1.5rem' }}>
              AI-Powered Styling · Virtual Try-On
            </p>
          </div>

          {Object.entries(FOOTER_LINKS).map(([category, links]) => (
            <div key={category}>
              <p className="label-luxury" style={{ marginBottom: '1rem' }}>{category}</p>
              <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
                {links.map(({ label, href }) => (
                  <li key={href}>
                    <Link
                      href={href}
                      className="nav-link"
                      style={{
                        fontSize: '0.875rem',
                      }}
                    >
                      {label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div
          style={{
            borderTop: '1px solid var(--color-surface-border)',
            paddingTop: '2rem',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <p style={{ color: 'var(--color-text-tertiary)', fontSize: '0.75rem' }}>
            © {new Date().getFullYear()} Top 10 Prom Network. All rights reserved.
          </p>
          <p style={{ color: 'var(--color-text-tertiary)', fontSize: '0.75rem' }}>
            55 Boutique Locations · AI-Powered Experience
          </p>
        </div>
      </div>
    </footer>
  );
}
