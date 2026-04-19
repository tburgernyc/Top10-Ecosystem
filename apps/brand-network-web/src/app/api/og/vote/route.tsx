import { ImageResponse } from 'next/og';
import { NextRequest } from 'next/server';


export async function GET(request: NextRequest): Promise<ImageResponse | Response> {
  const { searchParams } = new URL(request.url);
  const title = searchParams.get('title') ?? 'Help me pick my prom dress!';
  const voteCount = searchParams.get('votes') ?? '0';
  const dressCount = searchParams.get('dresses') ?? '3';

  return new ImageResponse(
    (
      <div
        style={{
          width: '1200px',
          height: '630px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#0B0A0E',
          fontFamily: 'Georgia, serif',
          position: 'relative',
        }}
      >
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background:
              'radial-gradient(ellipse 80% 60% at 20% 20%, rgba(242,75,154,0.18) 0%, transparent 60%), radial-gradient(ellipse 60% 80% at 80% 80%, rgba(123,97,255,0.14) 0%, transparent 60%)',
          }}
        />

        <div
          style={{
            display: 'flex',
            position: 'absolute',
            top: '2.5rem',
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'rgba(255,255,255,0.06)',
            border: '1px solid rgba(255,255,255,0.12)',
            borderRadius: '9999px',
            padding: '0.5rem 1.5rem',
            color: '#C9A96E',
            fontSize: '0.875rem',
            letterSpacing: '0.15em',
            textTransform: 'uppercase',
          }}
        >
          TOP 10 PROM · FRIEND VOTE
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '0 4rem', zIndex: 1 }}>
          <p
            style={{
              fontSize: '3rem',
              fontWeight: 700,
              color: '#F8F4F0',
              textAlign: 'center',
              lineHeight: 1.2,
              marginBottom: '1.5rem',
              maxWidth: '900px',
            }}
          >
            {title}
          </p>

          <div style={{ display: 'flex', gap: '3rem', marginTop: '1rem' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <span style={{ fontSize: '2.5rem', fontWeight: 700, color: '#F24B9A' }}>{dressCount}</span>
              <span style={{ color: 'rgba(248,244,240,0.6)', fontSize: '0.875rem', letterSpacing: '0.1em', textTransform: 'uppercase' }}>Dresses</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <span style={{ fontSize: '2.5rem', fontWeight: 700, color: '#7B61FF' }}>{voteCount}</span>
              <span style={{ color: 'rgba(248,244,240,0.6)', fontSize: '0.875rem', letterSpacing: '0.1em', textTransform: 'uppercase' }}>Votes Cast</span>
            </div>
          </div>

          <div
            style={{
              marginTop: '2.5rem',
              background: '#F24B9A',
              borderRadius: '9999px',
              padding: '0.875rem 3rem',
              color: '#0B0A0E',
              fontWeight: 700,
              fontSize: '1.125rem',
              letterSpacing: '0.05em',
            }}
          >
            Tap to Vote 💖
          </div>
        </div>
      </div>
    ),
    { width: 1200, height: 630 }
  );
}
