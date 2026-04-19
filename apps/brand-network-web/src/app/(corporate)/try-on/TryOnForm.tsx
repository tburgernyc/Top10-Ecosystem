'use client';

import { useState, useCallback, useTransition } from 'react';
import { useDropzone } from 'react-dropzone';
import { createClient } from '@/lib/supabase/client';
import Image from 'next/image';
import Link from 'next/link';

type VTOStatus = 'idle' | 'uploading' | 'processing' | 'completed' | 'failed';

export default function TryOnForm() {
  const [status, setStatus] = useState<VTOStatus>('idle');
  const [preview, setPreview] = useState<string | null>(null);
  const [outputUrl, setOutputUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const supabase = createClient();

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      setPreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'image/*': ['.jpg', '.jpeg', '.png', '.webp'] },
    maxFiles: 1,
    maxSize: 10 * 1024 * 1024, // 10MB
  });

  const handleSubmit = () => {
    if (!preview) return;

    startTransition(async () => {
      setStatus('uploading');
      setError(null);

      try {
        const base64 = preview.split(',')[1];

        // Initiate VTO — returns session_id and channel_id
        const response = await fetch('/api/vto/initiate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            dress_id: 'demo-dress-id',
            color_name: 'Blush Pink',
            image_base64: base64,
          }),
        });

        if (!response.ok) throw new Error('VTO initiation failed');

        const { channel_id } = await response.json() as { session_id: string; channel_id: string };

        setStatus('processing');

        // Subscribe to Supabase Realtime Broadcast channel — NOT WebSockets
        const channel = supabase.channel(channel_id);
        channel
          .on('broadcast', { event: 'vto_complete' }, (payload) => {
            const { status: vtoStatus, output_image_url, error: vtoError } = payload.payload as {
              status: string;
              output_image_url: string | null;
              error: string | null;
            };

            if (vtoStatus === 'completed' && output_image_url) {
              setOutputUrl(output_image_url);
              setStatus('completed');
            } else {
              setError(vtoError ?? 'Try-On processing failed. Please try again.');
              setStatus('failed');
            }

            void supabase.removeChannel(channel);
          })
          .subscribe();

        // Timeout safety — 45 seconds max wait
        setTimeout(() => {
          setStatus((current) => {
            if (current === 'processing') {
              setError('Processing timed out. Please try again.');
              void supabase.removeChannel(channel);
              return 'failed';
            }
            return current;
          });
        }, 45000);

      } catch {
        setError('Something went wrong. Please try again.');
        setStatus('failed');
      }
    });
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
      {/* Upload zone */}
      <div>
        <p className="label-luxury" style={{ marginBottom: '1rem' }}>Your Photo</p>
        <div
          {...getRootProps()}
          style={{
            border: `2px dashed ${isDragActive ? 'var(--color-brand-primary)' : 'var(--color-surface-border-md)'}`,
            borderRadius: 'var(--radius-lg)',
            padding: '3rem 2rem',
            textAlign: 'center',
            cursor: 'pointer',
            background: isDragActive ? 'var(--color-surface-glass-md)' : 'var(--color-surface-glass)',
            transition: 'all 0.2s ease',
            minHeight: '300px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexDirection: 'column',
            gap: '1rem',
            position: 'relative',
            overflow: 'hidden',
          }}
          role="button"
          aria-label="Upload photo for virtual try-on"
        >
          <input {...getInputProps()} style={{ fontSize: '1rem' }} />

          {preview ? (
            <Image
              src={preview}
              alt="Your uploaded photo"
              fill
              style={{ objectFit: 'cover', borderRadius: 'var(--radius-lg)' }}
            />
          ) : (
            <>
              <span style={{ fontSize: '3rem' }}>↑</span>
              <p style={{ color: 'var(--color-text-primary)', fontWeight: 600 }}>
                {isDragActive ? 'Drop your photo here' : 'Drag & drop or click to upload'}
              </p>
              <p style={{ color: 'var(--color-text-tertiary)', fontSize: '0.875rem' }}>
                JPG, PNG, WebP up to 10MB
              </p>
            </>
          )}
        </div>

        <button
          type="button"
          id="vto-submit"
          className="btn-primary"
          onClick={handleSubmit}
          disabled={!preview || isPending || status === 'processing'}
          aria-disabled={!preview || isPending || status === 'processing'}
          style={{ width: '100%', marginTop: '1rem' }}
        >
          {status === 'uploading' ? 'Uploading…'
            : status === 'processing' ? 'Generating your look…'
            : 'Try This Dress On'}
        </button>
      </div>

      {/* Result panel */}
      <div>
        <p className="label-luxury" style={{ marginBottom: '1rem' }}>Your Result</p>
        <div
          className="glass-card"
          style={{
            minHeight: '300px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          {status === 'idle' && (
            <p style={{ color: 'var(--color-text-tertiary)', fontSize: '0.875rem' }}>
              Your virtual try-on will appear here
            </p>
          )}

          {(status === 'uploading' || status === 'processing') && (
            <div style={{ textAlign: 'center' }}>
              <div
                style={{
                  width: '48px',
                  height: '48px',
                  borderRadius: '50%',
                  border: '3px solid var(--color-surface-border)',
                  borderTopColor: 'var(--color-brand-accent)',
                  animation: 'tryon-spin 1s linear infinite',
                  margin: '0 auto 1rem',
                }}
              />
              <p style={{ color: 'var(--color-text-secondary)' }}>
                {status === 'uploading' ? 'Uploading your photo…' : 'Generating your look…'}
              </p>
              <p style={{ color: 'var(--color-text-tertiary)', fontSize: '0.875rem', marginTop: '0.5rem' }}>
                This takes 7–11 seconds
              </p>
            </div>
          )}

          {status === 'completed' && outputUrl && (
            <div style={{ width: '100%' }}>
              <Image
                src={outputUrl}
                alt="Virtual try-on result"
                width={400}
                height={600}
                style={{ width: '100%', height: 'auto', borderRadius: 'var(--radius-lg)' }}
              />
              <Link
                href="/book"
                className="btn-primary"
                style={{ display: 'block', width: '100%', textAlign: 'center', marginTop: '1rem' }}
              >
                Book to Try This Dress In Store
              </Link>
            </div>
          )}

          {status === 'failed' && (
            <div style={{ textAlign: 'center', padding: '2rem' }}>
              <p style={{ color: 'var(--color-error)', fontWeight: 600, marginBottom: '0.5rem' }}>Generation Failed</p>
              <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.875rem', marginBottom: '1.5rem' }}>
                {error ?? 'Please try again with a clear front-facing photo.'}
              </p>
              <button
                type="button"
                className="btn-ghost"
                onClick={() => { setStatus('idle'); setError(null); setPreview(null); }}
              >
                Try Again
              </button>
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes tryon-spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
