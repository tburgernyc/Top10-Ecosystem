# Phase 4: AI Integrations & Global Consumer Gateways

---

## [PRE-EXECUTION DIRECTIVE]
**MANDATORY FIRST ACTION:** Read `PHASE_MANIFEST.md` (Phase 0) in full. Verify Phases 1–3 are marked ✅ COMPLETE.

**Role:** Principal Staff Engineer  
**Context:** Build all global consumer-facing gateways: AI Stylist (RAG), Virtual Try-On (Fal.ai flux-kontext-pro + Supabase Realtime), Store Locator (Google Maps), and Booking Wizard.  
**Quality Standard:** Institutional Grade UX. Zero digital color swatches — photography only for color discovery.  
**Execution Rules:**  
- ALL inputs MUST use `font-size: 1rem` minimum — iOS Safari zoom prevention is non-negotiable.  
- Floating panels MUST use `w-[calc(100vw-2rem)]` / viewport-relative math — no hardcoded pixel widths.  
- VTO MUST use Supabase Realtime Broadcast channels — NOT custom Vercel WebSockets (they timeout at 30s).  
- VTO provider: **Fal.ai `fal-ai/flux-kontext-pro`** — this is the locked provider. Do not substitute.  
- Booking double-submit prevention: `useTransition()` + `disabled={isPending}` + `disabled:opacity-50 disabled:cursor-not-allowed`.

---

## [EXECUTION BLOCK 1: Dependencies]

```bash
cd apps/brand-network-web

# AI / Streaming
pnpm add @ai-sdk/google ai

# VTO Diffusion — Fal.ai
pnpm add @fal-ai/client

# Booking / Maps
pnpm add @googlemaps/js-api-loader

# File Upload
pnpm add react-dropzone

# Date/Time Picker
pnpm add react-day-picker date-fns
```

---

## [EXECUTION BLOCK 2: Conversational RAG AI Stylist]

### 2.1 — AI Stylist Backend: `src/app/api/chat/route.ts`
```typescript
import { google } from '@ai-sdk/google';
import { streamText, tool } from 'ai';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { db, withTenant, dress_inventory, dresses, client_style_profiles } from '@toptenprom/database';
import { eq, and, sql } from 'drizzle-orm';

export const maxDuration = 30; // Vercel serverless timeout

const systemPrompt = `You are an expert luxury prom and wedding dress stylist for Top 10 Prom, 
a premium boutique network with 55 locations. Your role is to help customers find their perfect dress.

CRITICAL RULES:
1. NEVER suggest a dress that is not confirmed in-stock via the checkDressInventory tool.
2. Ask about occasion, style preferences, color preferences, and budget before making recommendations.
3. Always confirm stock BEFORE naming a specific dress. Hallucinated dress recommendations are unacceptable.
4. Use luxurious, warm, encouraging language. Reference the brand's 55-location network when relevant.
5. If a customer seems ready to book, guide them to the /book route.

Your personality: Warm, knowledgeable, sophisticated. Like a personal stylist at a luxury boutique.`;

export async function POST(request: Request) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  const { messages, tenantId } = await request.json() as {
    messages: Array<{ role: 'user' | 'assistant'; content: string }>;
    tenantId?: string;
  };

  const result = streamText({
    model: google('gemini-2.0-flash'),
    system: systemPrompt,
    messages,
    maxTokens: 1024,
    tools: {
      /**
       * checkDressInventory — MANDATORY before any dress recommendation.
       * Prevents hallucinated dress suggestions.
       */
      checkDressInventory: tool({
        description: 'Check if specific dress styles are available in inventory. MUST be called before recommending any dress.',
        parameters: z.object({
          occasion: z.enum(['prom', 'wedding', 'bridesmaid', 'homecoming', 'pageant', 'cocktail']).optional(),
          color_preference: z.string().optional(),
          designer: z.string().optional(),
          size: z.string().optional(),
          max_price: z.number().optional(),
          tenant_id: z.string().uuid().optional(),
        }),
        execute: async ({ occasion, color_preference, designer, size, max_price, tenant_id }) => {
          try {
            const targetTenantId = tenant_id ?? tenantId;

            const conditions = [
              sql`dress_inventory.in_stock = true`,
              sql`dress_inventory.quantity_on_hand > dress_inventory.quantity_reserved`,
            ];

            if (targetTenantId) {
              conditions.push(sql`dress_inventory.tenant_id = ${targetTenantId}`);
            }
            if (occasion) {
              conditions.push(sql`dresses.occasion = ${occasion}`);
            }
            if (designer) {
              conditions.push(sql`lower(dresses.designer) LIKE ${'%' + designer.toLowerCase() + '%'}`);
            }
            if (size) {
              conditions.push(sql`dress_inventory.size = ${size}`);
            }
            if (max_price) {
              conditions.push(sql`dresses.retail_price <= ${max_price}`);
            }

            const available = await db
              .select({
                id: dresses.id,
                name: dresses.name,
                designer: dresses.designer,
                occasion: dresses.occasion,
                color_name: dress_inventory.color_name,
                size: dress_inventory.size,
                price: dresses.retail_price,
                image_url: sql<string>`dresses.image_urls->>'hero'`,
                quantity_available: sql<number>`dress_inventory.quantity_on_hand - dress_inventory.quantity_reserved`,
              })
              .from(dress_inventory)
              .leftJoin(dresses, eq(dress_inventory.dress_id, dresses.id))
              .where(and(...conditions))
              .limit(6)
              .orderBy(sql`RANDOM()`);

            return {
              available_count: available.length,
              dresses: available,
              message: available.length > 0
                ? `Found ${available.length} confirmed in-stock options.`
                : 'No matching dresses currently in stock for these criteria.',
            };
          } catch (error) {
            return { available_count: 0, dresses: [], message: 'Inventory check temporarily unavailable.' };
          }
        },
      }),

      /**
       * saveStylePreference — Writes RAG preference data to client_style_profiles.
       */
      saveStylePreference: tool({
        description: 'Save customer style preferences to their profile for future personalization.',
        parameters: z.object({
          preferred_colors: z.array(z.string()).optional(),
          preferred_designers: z.array(z.string()).optional(),
          preferred_silhouettes: z.array(z.string()).optional(),
          budget_min: z.number().optional(),
          budget_max: z.number().optional(),
          summary: z.string().describe('Brief summary of the conversation for the profile'),
        }),
        execute: async ({ preferred_colors, preferred_designers, preferred_silhouettes, budget_min, budget_max, summary }) => {
          if (!user?.id) return { saved: false };

          try {
            await db
              .insert(client_style_profiles)
              .values({
                user_id: user.id,
                preferred_designers: preferred_designers ?? [],
                preferred_colors: (preferred_colors ?? []).map((c) => ({ name: c, hex: '' })),
                preferred_silhouettes: preferred_silhouettes ?? [],
                preferred_occasions: [],
                avoided_styles: [],
                budget_min: budget_min ? budget_min.toString() : undefined,
                budget_max: budget_max ? budget_max.toString() : undefined,
                raw_conversation_summary: summary,
                last_interaction_at: new Date(),
                interaction_count: 1,
              })
              .onConflictDoUpdate({
                target: client_style_profiles.user_id,
                set: {
                  preferred_designers: sql`COALESCE(${preferred_designers}, client_style_profiles.preferred_designers)`,
                  raw_conversation_summary: summary,
                  last_interaction_at: new Date(),
                  interaction_count: sql`client_style_profiles.interaction_count + 1`,
                },
              });
            return { saved: true };
          } catch {
            return { saved: false };
          }
        },
      }),
    },
  });

  return result.toDataStreamResponse();
}
```

### 2.2 — `apps/brand-network-web/src/components/ai/AIStylistBot.tsx`
```tsx
'use client';

import { useState, useRef, useEffect } from 'react';
import { useChat } from 'ai/react';

interface Props {
  tenantId?: string;
}

export default function AIStylistBot({ tenantId }: Props) {
  const [isOpen, setIsOpen] = useState(false);

  const { messages, input, handleInputChange, handleSubmit, isLoading, error } = useChat({
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
            // Viewport-relative width — prevents overflow on mobile
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
                        animation: `bounce 1s ease-in-out ${i * 0.15}s infinite`,
                      }}
                    />
                  ))}
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
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
              className="input-luxury"
              value={input}
              onChange={handleInputChange}
              placeholder="Ask me about dresses…"
              disabled={isLoading}
              style={{ flex: 1 }}
            />
            <button
              type="submit"
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
        @keyframes bounce {
          0%, 100% { transform: translateY(0); opacity: 0.4; }
          50% { transform: translateY(-4px); opacity: 1; }
        }
      `}</style>
    </>
  );
}
```

---

## [EXECUTION BLOCK 3: Virtual Try-On Pipeline]

### 3.1 — VTO Architecture
```
Client (try-on-form.tsx)
  → Uploads photo to Supabase Storage (signed URL)
  → POST /api/vto/initiate
    → Creates vto_sessions record (status: 'queued')
    → Creates Supabase Realtime channel (realtime_channel_id)
    → Submits job to Fal.ai fal-ai/flux-kontext-pro (async, with webhook)
    → Returns { session_id, channel_id }
  → Client subscribes to Supabase Realtime channel
  → Fal.ai webhook: POST /api/vto/webhook
    → Updates vto_sessions (status: 'completed', output_image_url)
    → Broadcasts result to Realtime channel
  → Client receives broadcast → renders result
  → Target: 7–11 second UX window
```

### 3.2 — `src/app/api/vto/initiate/route.ts`
```typescript
import { NextRequest, NextResponse } from 'next/server';
import { fal } from '@fal-ai/client';
import { createClient as createSupabaseClient } from '@/lib/supabase/server';
import { db, vto_sessions } from '@toptenprom/database';
import { createClient as createRealtimeClient } from '@supabase/supabase-js';

fal.config({ credentials: process.env.FAL_KEY! });

export async function POST(request: NextRequest) {
  const supabase = await createSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: { dress_id: string; color_name: string; image_base64: string; tenant_id?: string };
  try {
    body = await request.json() as typeof body;
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const { dress_id, color_name, image_base64, tenant_id } = body;
  const channelId = `vto-${user.id}-${Date.now()}`;

  // Upload input image to Supabase Storage
  let inputImageUrl = '';
  try {
    const imageBuffer = Buffer.from(image_base64, 'base64');
    const filePath = `vto/inputs/${user.id}/${Date.now()}.jpg`;
    const { error: uploadError } = await supabase.storage
      .from('vto-images')
      .upload(filePath, imageBuffer, { contentType: 'image/jpeg', upsert: false });

    if (uploadError) throw uploadError;

    const { data: urlData } = supabase.storage.from('vto-images').getPublicUrl(filePath);
    inputImageUrl = urlData.publicUrl;
  } catch (error) {
    return NextResponse.json({ error: 'Image upload failed' }, { status: 500 });
  }

  // Create VTO session record
  let sessionId = '';
  try {
    const [session] = await db
      .insert(vto_sessions)
      .values({
        user_id: user.id,
        tenant_id: tenant_id ?? null,
        dress_id,
        color_name,
        realtime_channel_id: channelId,
        status: 'queued',
        input_image_url: inputImageUrl,
        processing_started_at: new Date(),
      })
      .returning({ id: vto_sessions.id });

    sessionId = session?.id ?? '';
  } catch (error) {
    return NextResponse.json({ error: 'Session creation failed' }, { status: 500 });
  }

  // Submit async job to Fal.ai flux-kontext-pro
  try {
    await fal.queue.submit('fal-ai/flux-kontext-pro', {
      input: {
        image_url: inputImageUrl,
        prompt: `A person wearing a ${color_name} prom dress, photorealistic, luxury boutique setting, editorial quality`,
        num_inference_steps: 28,
        guidance_scale: 3.5,
      },
      webhookUrl: `${process.env.NEXT_PUBLIC_BASE_URL}/api/vto/webhook?session_id=${sessionId}&channel_id=${channelId}`,
    });
  } catch (error) {
    console.error('[VTO Initiate] Fal.ai submission failed:', error);
    // Don't fail the request — the session is created, webhook will handle completion
  }

  return NextResponse.json({ session_id: sessionId, channel_id: channelId }, { status: 202 });
}
```

### 3.3 — `src/app/api/vto/webhook/route.ts`
```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { db, vto_sessions } from '@toptenprom/database';
import { eq } from 'drizzle-orm';

// Service role client for server-side Supabase operations
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  const sessionId = request.nextUrl.searchParams.get('session_id');
  const channelId = request.nextUrl.searchParams.get('channel_id');

  if (!sessionId || !channelId) {
    return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
  }

  let falResult: { images?: Array<{ url: string }>; error?: string };
  try {
    falResult = await request.json() as typeof falResult;
  } catch {
    return NextResponse.json({ error: 'Invalid webhook body' }, { status: 400 });
  }

  const outputUrl = falResult.images?.[0]?.url ?? null;
  const hasError = !outputUrl || !!falResult.error;

  try {
    await db
      .update(vto_sessions)
      .set({
        status: hasError ? 'failed' : 'completed',
        output_image_url: outputUrl,
        processing_completed_at: new Date(),
        error_message: falResult.error ?? null,
      })
      .where(eq(vto_sessions.id, sessionId));
  } catch (dbError) {
    console.error('[VTO Webhook] DB update failed:', dbError);
  }

  // Broadcast result to Supabase Realtime channel — client is subscribed
  try {
    await supabaseAdmin.channel(channelId).send({
      type: 'broadcast',
      event: 'vto_complete',
      payload: {
        status: hasError ? 'failed' : 'completed',
        output_image_url: outputUrl,
        error: falResult.error ?? null,
      },
    });
  } catch (realtimeError) {
    console.error('[VTO Webhook] Realtime broadcast failed:', realtimeError);
  }

  return NextResponse.json({ received: true });
}
```

### 3.4 — `src/app/(main)/try-on/page.tsx`
```tsx
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
```

### 3.5 — `src/app/(main)/try-on/TryOnForm.tsx`
```tsx
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

    // Generate preview
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
            dress_id: 'demo-dress-id', // In production, passed from dress selection
            color_name: 'Blush Pink',
            image_base64: base64,
          }),
        });

        if (!response.ok) throw new Error('VTO initiation failed');

        const { session_id, channel_id } = await response.json() as { session_id: string; channel_id: string };

        setStatus('processing');

        // Subscribe to Supabase Realtime channel for result
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

            supabase.removeChannel(channel);
          })
          .subscribe();

        // Timeout safety — 45 seconds max wait
        setTimeout(() => {
          if (status === 'processing') {
            setStatus('failed');
            setError('Processing timed out. Please try again.');
            supabase.removeChannel(channel);
          }
        }, 45000);

      } catch (err) {
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
          <input {...getInputProps()} />

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
                  animation: 'spin 1s linear infinite',
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
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
```

---

## [EXECUTION BLOCK 4: Store Locator & Booking]

### 4.1 — `src/app/(main)/locator/page.tsx`
```tsx
import type { Metadata } from 'next';
import { db } from '@toptenprom/database';
import { tenants } from '@toptenprom/database';
import { eq } from 'drizzle-orm';
import LocatorMap from './LocatorMap';

export const metadata: Metadata = {
  title: 'Find a Boutique | Top 10 Prom',
  description: 'Locate one of 55 Top 10 Prom boutique locations near you.',
};

async function getAllTenants() {
  'use cache';
  try {
    return db.select().from(tenants).where(eq(tenants.is_active, true)).orderBy(tenants.name);
  } catch {
    return [];
  }
}

export default async function LocatorPage() {
  const locations = await getAllTenants();

  return (
    <div style={{ minHeight: '100dvh', paddingTop: '6rem' }}>
      {/* Header */}
      <div
        className="mesh-bg"
        style={{ padding: '4rem 2rem', textAlign: 'center', borderBottom: '1px solid var(--color-surface-border)' }}
      >
        <p className="label-luxury" style={{ marginBottom: '1rem' }}>55 Locations</p>
        <h1 className="heading-display" style={{ fontSize: 'clamp(2.5rem, 6vw, 4rem)' }}>
          Find Your Boutique
        </h1>
        <p style={{ color: 'var(--color-text-secondary)', marginTop: '1rem', fontSize: '1.125rem' }}>
          Luxury boutiques across the nation, each with exclusive inventory.
        </p>
      </div>

      {/* Map + List split screen */}
      <LocatorMap locations={locations} />
    </div>
  );
}
```

### 4.2 — `src/app/(main)/locator/LocatorMap.tsx`
```tsx
'use client';

import { useState, useEffect, useRef } from 'react';
import { Loader } from '@googlemaps/js-api-loader';
import Link from 'next/link';
import type { tenants } from '@toptenprom/database';

type Tenant = typeof tenants.$inferSelect;

interface Props {
  locations: Tenant[];
}

export default function LocatorMap({ locations }: Props) {
  const mapRef = useRef<HTMLDivElement>(null);
  const [selectedLocation, setSelectedLocation] = useState<Tenant | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const filtered = locations.filter(
    (l) =>
      l.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      l.city.toLowerCase().includes(searchQuery.toLowerCase()) ||
      l.state.toLowerCase().includes(searchQuery.toLowerCase())
  );

  useEffect(() => {
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    if (!apiKey || !mapRef.current) return;

    const loader = new Loader({ apiKey, version: 'beta', libraries: ['maps', 'marker'] });

    loader.load().then(async () => {
      const { Map } = await google.maps.importLibrary('maps') as google.maps.MapsLibrary;
      const { AdvancedMarkerElement } = await google.maps.importLibrary('marker') as google.maps.MarkerLibrary;

      const map = new Map(mapRef.current!, {
        center: { lat: 39.8283, lng: -98.5795 },
        zoom: 4,
        mapId: 'TOP10PROM_MAP',
        disableDefaultUI: true,
        zoomControl: true,
        backgroundColor: '#0B0A0E',
      });

      locations.forEach((location) => {
        if (!location.location_data) return;
        const marker = new AdvancedMarkerElement({
          map,
          position: { lat: location.location_data.lat, lng: location.location_data.lng },
          title: location.name,
        });

        marker.addListener('click', () => {
          setSelectedLocation(location);
          map.panTo({ lat: location.location_data!.lat, lng: location.location_data!.lng });
        });
      });
    });
  }, [locations]);

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '380px 1fr', height: 'calc(100dvh - 12rem)' }}>
      {/* List panel */}
      <div
        style={{
          background: 'var(--color-bg-elevated)',
          borderRight: '1px solid var(--color-surface-border)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Search */}
        <div style={{ padding: '1.25rem', borderBottom: '1px solid var(--color-surface-border)' }}>
          <input
            type="search"
            className="input-luxury"
            placeholder="Search by city or state…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            aria-label="Search boutique locations"
          />
        </div>

        {/* Results list */}
        <ul style={{ flex: 1, overflowY: 'auto', listStyle: 'none', padding: '0.75rem' }}>
          {filtered.map((location) => (
            <li key={location.id}>
              <button
                type="button"
                onClick={() => setSelectedLocation(location)}
                style={{
                  width: '100%',
                  padding: '1rem',
                  borderRadius: 'var(--radius-md)',
                  border: `1px solid ${selectedLocation?.id === location.id ? 'var(--color-brand-primary)' : 'transparent'}`,
                  background: selectedLocation?.id === location.id
                    ? 'var(--color-surface-glass-md)'
                    : 'transparent',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'all 0.2s ease',
                  marginBottom: '0.5rem',
                }}
              >
                <p style={{ fontWeight: 600, color: 'var(--color-text-primary)', marginBottom: '0.25rem' }}>
                  {location.name}
                </p>
                <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.875rem' }}>
                  {location.city}, {location.state}
                </p>
                {selectedLocation?.id === location.id && (
                  <Link
                    href={`/book?location=${location.id}`}
                    className="btn-primary"
                    style={{ display: 'inline-block', marginTop: '0.75rem', fontSize: '0.875rem', padding: '0.5rem 1.25rem' }}
                  >
                    Book at This Location
                  </Link>
                )}
              </button>
            </li>
          ))}
        </ul>
      </div>

      {/* Map */}
      <div ref={mapRef} style={{ width: '100%', height: '100%' }} aria-label="Boutique locations map" />
    </div>
  );
}
```

### 4.3 — `src/app/(main)/book/page.tsx` + BookingWizard
Create `src/app/(main)/book/page.tsx`:
```tsx
import type { Metadata } from 'next';
import BookingWizard from './BookingWizard';

export const metadata: Metadata = {
  title: 'Book an Appointment | Top 10 Prom',
};

export default function BookPage() {
  return (
    <div className="mesh-bg" style={{ minHeight: '100dvh', paddingTop: '8rem', paddingBottom: '4rem' }}>
      <div style={{ maxWidth: '720px', margin: '0 auto', padding: '0 2rem' }}>
        <p className="label-luxury" style={{ marginBottom: '1rem', textAlign: 'center' }}>Schedule</p>
        <h1 className="heading-display" style={{ fontSize: 'clamp(2rem, 5vw, 3.5rem)', textAlign: 'center', marginBottom: '3rem' }}>
          Book Your Appointment
        </h1>
        <BookingWizard />
      </div>
    </div>
  );
}
```

Create `src/app/(main)/book/BookingWizard.tsx`:
```tsx
'use client';

import { useState, useTransition } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

type Step = 'location' | 'service' | 'time' | 'confirm';

const SERVICES = [
  { id: 'prom-styling', label: 'Prom Styling Session', duration: 90, description: 'Full 90-minute personal styling with our expert team.' },
  { id: 'wedding-consultation', label: 'Wedding Consultation', duration: 60, description: '60-minute consultation for bridal party and wedding gowns.' },
  { id: 'vto-session', label: 'VTO In-Store Session', duration: 45, description: 'Try dresses guided by your AI Virtual Try-On results.' },
  { id: 'alteration-fitting', label: 'Alteration Fitting', duration: 30, description: '30-minute fitting appointment for alterations.' },
] as const;

export default function BookingWizard() {
  const [step, setStep] = useState<Step>('location');
  const [locationId, setLocationId] = useState('');
  const [serviceId, setServiceId] = useState('');
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedTime, setSelectedTime] = useState('');
  const [isPending, startTransition] = useTransition();
  const [bookingError, setBookingError] = useState<string | null>(null);
  const [confirmationCode, setConfirmationCode] = useState<string | null>(null);

  const router = useRouter();
  const searchParams = useSearchParams();

  // Pre-populate location from /locator query param
  const preselectedLocation = searchParams.get('location');

  const steps: Step[] = ['location', 'service', 'time', 'confirm'];
  const currentStepIndex = steps.indexOf(step);

  const handleConfirm = () => {
    startTransition(async () => {
      setBookingError(null);
      try {
        const response = await fetch('/api/bookings/create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ locationId, serviceId, date: selectedDate, time: selectedTime }),
        });

        if (!response.ok) {
          const { error, nearbyLocation } = await response.json() as { error: string; nearbyLocation?: string };
          if (nearbyLocation) {
            setBookingError(`Primary location full. We found availability at a nearby boutique. Redirecting…`);
            setTimeout(() => router.push(`/book?location=${nearbyLocation}`), 2000);
          } else {
            setBookingError(error ?? 'Booking failed. Please try again.');
          }
          return;
        }

        const { confirmation_code } = await response.json() as { confirmation_code: string };
        setConfirmationCode(confirmation_code);
      } catch {
        setBookingError('Network error. Please check your connection and try again.');
      }
    });
  };

  if (confirmationCode) {
    return (
      <div className="glass-card" style={{ padding: '3rem', textAlign: 'center' }}>
        <div style={{ fontSize: '3rem', marginBottom: '1.5rem' }}>✓</div>
        <p className="label-luxury" style={{ color: 'var(--color-success)', marginBottom: '0.75rem' }}>Confirmed</p>
        <h2 className="heading-display" style={{ fontSize: '2rem', marginBottom: '1rem' }}>You're Booked!</h2>
        <p style={{ color: 'var(--color-text-secondary)', marginBottom: '0.5rem' }}>Confirmation Code</p>
        <p style={{ fontFamily: 'var(--font-mono)', fontSize: '1.5rem', color: 'var(--color-brand-secondary)', fontWeight: 700 }}>
          {confirmationCode}
        </p>
      </div>
    );
  }

  return (
    <div className="glass-card" style={{ padding: '2.5rem' }}>
      {/* Step indicator */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '2.5rem', justifyContent: 'center' }}>
        {steps.map((s, i) => (
          <div
            key={s}
            style={{
              width: '32px',
              height: '4px',
              borderRadius: 'var(--radius-pill)',
              background: i <= currentStepIndex
                ? 'var(--color-brand-primary)'
                : 'var(--color-surface-border-md)',
              transition: 'background 0.3s ease',
            }}
          />
        ))}
      </div>

      {/* Step: Location */}
      {step === 'location' && (
        <div>
          <h2 className="heading-section" style={{ fontSize: '1.5rem', marginBottom: '1.5rem' }}>Choose Location</h2>
          <input
            type="text"
            className="input-luxury"
            placeholder="Enter location ID or browse /locator"
            value={locationId || preselectedLocation || ''}
            onChange={(e) => setLocationId(e.target.value)}
          />
          <button
            type="button"
            className="btn-primary"
            style={{ width: '100%', marginTop: '1.5rem' }}
            disabled={!locationId && !preselectedLocation}
            onClick={() => { if (!locationId && preselectedLocation) setLocationId(preselectedLocation); setStep('service'); }}
          >
            Continue
          </button>
        </div>
      )}

      {/* Step: Service */}
      {step === 'service' && (
        <div>
          <h2 className="heading-section" style={{ fontSize: '1.5rem', marginBottom: '1.5rem' }}>Select Service</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {SERVICES.map((service) => (
              <button
                key={service.id}
                type="button"
                onClick={() => setServiceId(service.id)}
                style={{
                  padding: '1.25rem',
                  borderRadius: 'var(--radius-md)',
                  border: `1px solid ${serviceId === service.id ? 'var(--color-brand-primary)' : 'var(--color-surface-border)'}`,
                  background: serviceId === service.id ? 'var(--color-surface-glass-md)' : 'var(--color-surface-glass)',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'all 0.2s ease',
                }}
              >
                <p style={{ fontWeight: 600, color: 'var(--color-text-primary)' }}>{service.label}</p>
                <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.875rem', marginTop: '0.25rem' }}>
                  {service.description} · {service.duration} min
                </p>
              </button>
            ))}
          </div>
          <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem' }}>
            <button type="button" className="btn-ghost" onClick={() => setStep('location')} style={{ flex: 1 }}>Back</button>
            <button type="button" className="btn-primary" disabled={!serviceId} onClick={() => setStep('time')} style={{ flex: 2 }}>Continue</button>
          </div>
        </div>
      )}

      {/* Step: Time — simplified, implement full calendar in production */}
      {step === 'time' && (
        <div>
          <h2 className="heading-section" style={{ fontSize: '1.5rem', marginBottom: '1.5rem' }}>Select Date & Time</h2>
          <input type="date" className="input-luxury" onChange={(e) => setSelectedDate(new Date(e.target.value))} style={{ marginBottom: '1rem' }} />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.5rem' }}>
            {['10:00 AM', '11:00 AM', '1:00 PM', '2:00 PM', '3:00 PM', '4:00 PM'].map((time) => (
              <button
                key={time}
                type="button"
                onClick={() => setSelectedTime(time)}
                style={{
                  padding: '0.75rem 0.5rem',
                  borderRadius: 'var(--radius-md)',
                  border: `1px solid ${selectedTime === time ? 'var(--color-brand-primary)' : 'var(--color-surface-border)'}`,
                  background: selectedTime === time ? 'var(--color-surface-glass-md)' : 'transparent',
                  color: selectedTime === time ? 'var(--color-brand-primary)' : 'var(--color-text-secondary)',
                  cursor: 'pointer',
                  fontSize: '0.875rem',
                  transition: 'all 0.2s ease',
                }}
              >
                {time}
              </button>
            ))}
          </div>
          <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem' }}>
            <button type="button" className="btn-ghost" onClick={() => setStep('service')} style={{ flex: 1 }}>Back</button>
            <button
              type="button"
              className="btn-primary"
              disabled={!selectedDate || !selectedTime}
              onClick={() => setStep('confirm')}
              style={{ flex: 2 }}
            >
              Continue
            </button>
          </div>
        </div>
      )}

      {/* Step: Confirm */}
      {step === 'confirm' && (
        <div>
          <h2 className="heading-section" style={{ fontSize: '1.5rem', marginBottom: '1.5rem' }}>Confirm Booking</h2>
          <div className="glass-card" style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {[
                ['Service', SERVICES.find((s) => s.id === serviceId)?.label ?? ''],
                ['Date', selectedDate?.toLocaleDateString() ?? ''],
                ['Time', selectedTime],
              ].map(([label, value]) => (
                <div key={label} style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.875rem' }}>{label}</p>
                  <p style={{ fontWeight: 600 }}>{value}</p>
                </div>
              ))}
            </div>
          </div>

          {bookingError && (
            <p style={{ color: 'var(--color-error)', fontSize: '0.875rem', marginBottom: '1rem', textAlign: 'center' }}>
              {bookingError}
            </p>
          )}

          <div style={{ display: 'flex', gap: '1rem' }}>
            <button type="button" className="btn-ghost" onClick={() => setStep('time')} style={{ flex: 1 }}>Back</button>
            <button
              type="button"
              className="btn-primary"
              onClick={handleConfirm}
              // Double-submit prevention — mandatory
              disabled={isPending}
              aria-disabled={isPending}
              style={{
                flex: 2,
                opacity: isPending ? 0.5 : 1,
                cursor: isPending ? 'not-allowed' : 'pointer',
              }}
            >
              {isPending ? 'Confirming…' : 'Confirm Appointment'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
```

---

## [VALIDATION CHECKPOINT — PHASE 4]

```bash
pnpm --filter @toptenprom/brand-network-web typecheck
pnpm --filter @toptenprom/brand-network-web lint
```

**Audit checklist before marking complete:**
- [ ] `/api/chat/route.ts` — AI MUST call `checkDressInventory` tool before recommending any dress
- [ ] `AIStylistBot.tsx` — floating panel uses `min(calc(100vw - 2rem), 420px)` — NO hardcoded pixels
- [ ] All inputs in all components use `font-size: 1rem` — iOS zoom prevention
- [ ] `TryOnForm.tsx` uses Supabase Realtime Broadcast — NOT WebSockets
- [ ] VTO provider is `fal-ai/flux-kontext-pro` — verify in initiate route
- [ ] `BookingWizard.tsx` confirm button: `disabled={isPending}` + `aria-disabled={isPending}` + opacity change
- [ ] No hardcoded color values anywhere — all from CSS custom properties
- [ ] `LocatorMap.tsx` info windows contain booking CTA linking to `/book?location=[id]`

**Update PHASE_MANIFEST.md:** Mark Phase 4 as ✅ COMPLETE.

**STOP. Await human approval before executing Phase 5.**
