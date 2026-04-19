import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Contact | Top 10 Prom',
  description: 'Get in touch with the Top 10 Prom network team.',
};


export default function ContactPage() {
  return (
    <div
      className="mesh-bg"
      style={{ minHeight: '100dvh', paddingTop: '8rem', paddingBottom: '4rem' }}
    >
      <div style={{ maxWidth: '720px', margin: '0 auto', padding: '0 2rem' }}>
        <p className="label-luxury" style={{ marginBottom: '1rem', textAlign: 'center' }}>Get in Touch</p>
        <h1 className="heading-display" style={{ fontSize: 'clamp(2.5rem, 6vw, 4rem)', textAlign: 'center', marginBottom: '3rem' }}>
          Contact Us
        </h1>

        <div className="glass-card" style={{ padding: '2.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {[
            { label: 'Your Name', type: 'text', id: 'contact-name', placeholder: 'Jane Smith', autoComplete: 'name' },
            { label: 'Email', type: 'email', id: 'contact-email', placeholder: 'jane@example.com', autoComplete: 'email' },
            { label: 'Phone (optional)', type: 'tel', id: 'contact-phone', placeholder: '(555) 000-0000', autoComplete: 'tel' },
          ].map(({ label, type, id, placeholder, autoComplete }) => (
            <div key={id} style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <label htmlFor={id} style={{ color: 'var(--color-text-secondary)', fontSize: '0.875rem' }}>{label}</label>
              <input
                id={id}
                type={type}
                className="input-luxury"
                placeholder={placeholder}
                autoComplete={autoComplete}
                style={{ fontSize: '1rem' /* iOS zoom prevention */ }}
              />
            </div>
          ))}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <label htmlFor="contact-message" style={{ color: 'var(--color-text-secondary)', fontSize: '0.875rem' }}>Message</label>
            <textarea
              id="contact-message"
              className="input-luxury"
              placeholder="How can we help you?"
              rows={5}
              style={{ resize: 'vertical', lineHeight: 1.6, fontSize: '1rem' /* iOS zoom prevention */ }}
            />
          </div>

          <button
            type="button"
            id="contact-submit"
            className="btn-primary"
            style={{ width: '100%', marginTop: '0.5rem' }}
          >
            Send Message
          </button>
        </div>

        <div style={{ textAlign: 'center', marginTop: '2rem', color: 'var(--color-text-secondary)' }}>
          <p>Corporate Inquiries: <span style={{ color: 'var(--color-brand-secondary)' }}>info@toptenprom.com</span></p>
          <p style={{ marginTop: '0.5rem' }}>Press: <span style={{ color: 'var(--color-brand-secondary)' }}>press@toptenprom.com</span></p>
        </div>
      </div>
    </div>
  );
}
