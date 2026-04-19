'use client';

import { useState, useRef, useEffect } from 'react';
import { useChat } from 'ai/react';

interface Props {
  tenantId?: string;
}

export default function AIStylistBot({ tenantId }: Props) {
  const [isOpen, setIsOpen] = useState(false);

  const { messages, input, handleInputChange, handleSubmit, isLoading } = useChat({
    api: '/api/chat',
    body: { tenantId },
    initialMessages: [
      {
        id: 'welcome',
        role: 'assistant',
        content: "Hello! I'm your personal AI stylist. I'm here to help you find the perfect prom or wedding dress. What's the occasion you're shopping for?",
      },
    ],
  });

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  return (
    <>
      {/* Floating trigger button */}
      {!isOpen && (
        <button
          type="button"
          id="ai-stylist-trigger"
          onClick={() => setIsOpen(true)}
          style={{
            position: 'fixed',
            bottom: '2rem',
            right: '2rem',
            width: '56px',
            height: '56px',
            borderRadius: '50%',
            background: 'var(--color-brand-accent)',
            border: 'none',
            cursor: 'pointer',
            boxShadow: '0 8px 32px var(--color-brand-accent-glow)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '1.5rem',
            transition: 'transform 0.2s var(--ease-spring)',
            zIndex: 90,
          }}
          aria-label="Open AI Stylist"
          onMouseEnter={(e) => (e.currentTarget.style.transform = 'scale(1.1)')}
          onMouseLeave={(e) => (e.currentTarget.style.transform = 'scale(1)')}
        >
          ✦
        </button>
      )}

      {/* Chat panel */}
      {isOpen && (
        <div
          className="glass-card"
          style={{
            position: 'fixed',
            bottom: '2rem',
            right: '2rem',
            // Viewport-relative width — no hardcoded pixel cap
            width: 'min(calc(100vw - 2rem), 420px)',
            height: 'min(calc(100dvh - 4rem), 600px)',
            display: 'flex',
            flexDirection: 'column',
            zIndex: 90,
            overflow: 'hidden',
          }}
          role="dialog"
          aria-label="AI Stylist Chat"
          aria-modal="false"
        >
          {/* Header */}
          <div
            style={{
              padding: '1.25rem 1.5rem',
              borderBottom: '1px solid var(--color-surface-border)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexShrink: 0,
            }}
          >
            <div>
              <p className="label-luxury" style={{ color: 'var(--color-brand-accent)' }}>AI Stylist</p>
              <p style={{ fontFamily: 'var(--font-display)', fontSize: '1.125rem', fontWeight: 600 }}>
                Style Concierge
              </p>
            </div>
            <button
              type="button"
              id="ai-stylist-close"
              onClick={() => setIsOpen(false)}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--color-text-secondary)',
                cursor: 'pointer',
                fontSize: '1.25rem',
                padding: '0.25rem',
              }}
              aria-label="Close AI Stylist"
            >
              ✕
            </button>
          </div>

          {/* Messages */}
          <div
            style={{
              flex: 1,
              overflowY: 'auto',
              padding: '1rem 1.5rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.875rem',
            }}
          >
            {messages.map((message) => (
              <div
                key={message.id}
                style={{
                  alignSelf: message.role === 'user' ? 'flex-end' : 'flex-start',
                  maxWidth: '85%',
                }}
              >
                <div
                  style={{
                    padding: '0.75rem 1rem',
                    borderRadius: message.role === 'user'
                      ? '16px 16px 4px 16px'
                      : '16px 16px 16px 4px',
                    background: message.role === 'user'
                      ? 'var(--color-brand-primary)'
                      : 'var(--color-surface-glass-md)',
                    border: message.role === 'user'
                      ? 'none'
                      : '1px solid var(--color-surface-border)',
                    color: message.role === 'user'
                      ? 'var(--color-text-inverse)'
                      : 'var(--color-text-primary)',
                    fontSize: '0.9375rem',
                    lineHeight: 1.5,
                  }}
                >
                  {typeof message.content === 'string' ? message.content : null}
                </div>
              </div>
            ))}

            {isLoading && (
              <div style={{ alignSelf: 'flex-start' }}>
                <div
                  style={{
                    padding: '0.75rem 1rem',
                    borderRadius: '16px 16px 16px 4px',
                    background: 'var(--color-surface-glass-md)',
                    border: '1px solid var(--color-surface-border)',
                    display: 'flex',
                    gap: '4px',
                    alignItems: 'center',
                  }}
                >
                  {[0, 1, 2].map((i) => (
                    <span
                      key={i}
                      style={{
                        width: '6px',
                        height: '6px',
                        borderRadius: '50%',
                        background: 'var(--color-brand-accent)',
                        animation: `aistylist-bounce 1s ease-in-out ${i * 0.15}s infinite`,
                      }}
                    />
                  ))}
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input — font-size 1rem mandatory for iOS Safari auto-zoom prevention */}
          <form
            onSubmit={handleSubmit}
            style={{
              padding: '1rem 1.5rem',
              borderTop: '1px solid var(--color-surface-border)',
              display: 'flex',
              gap: '0.75rem',
              flexShrink: 0,
            }}
          >
            <input
              id="ai-stylist-input"
              className="input-luxury"
              value={input}
              onChange={handleInputChange}
              placeholder="Ask me about dresses…"
              disabled={isLoading}
              style={{ flex: 1, fontSize: '1rem' /* iOS zoom prevention */ }}
            />
            <button
              type="submit"
              id="ai-stylist-send"
              className="btn-primary"
              disabled={isLoading || !input.trim()}
              style={{ padding: '0.75rem 1.25rem', flexShrink: 0 }}
              aria-disabled={isLoading}
            >
              Send
            </button>
          </form>
        </div>
      )}

      <style>{`
        @keyframes aistylist-bounce {
          0%, 100% { transform: translateY(0); opacity: 0.4; }
          50% { transform: translateY(-4px); opacity: 1; }
        }
      `}</style>
    </>
  );
}
