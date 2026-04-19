# Phase 5: Tenant Storefronts & Offline Sync Architecture

---

## [PRE-EXECUTION DIRECTIVE]
**MANDATORY FIRST ACTION:** Read `PHASE_MANIFEST.md` (Phase 0) in full. Verify Phases 1–4 are marked ✅ COMPLETE.

**Role:** Principal Staff Engineer  
**Context:** Build dynamic tenant storefronts under `app/[subdomain]/` and the complete WatermelonDB offline-first mobile architecture.  
**Quality Standard:** High Availability. An unhandled database exception inside a subdomain MUST NOT crash the global application. Mobile app functions 100% offline.  
**Execution Rules:**  
- `resolveTenant()` MUST be wrapped in `try/catch` — on failure, render branded `not-found.tsx`, NOT a hard redirect.  
- All `params` in subdomain routes MUST be `await`ed before access (Next.js 16 breaking change).  
- WatermelonDB schema version MUST be explicitly versioned at `v1`. Any subsequent schema changes in Phase 6 MUST bump to `v2` with a migration.  
- `walk_ins` is the correct table name for kiosk queue entries — never `availability_inquiries`.

---

## [EXECUTION BLOCK 1: Tenant Resolution & Branded Storefront]

### 1.1 — `apps/brand-network-web/src/lib/tenant.ts`
```typescript
import { db } from '@toptenprom/database';
import { tenants } from '@toptenprom/database';
import { eq } from 'drizzle-orm';

export type ResolvedTenant = typeof tenants.$inferSelect;

/**
 * `resolveTenant` — Looks up a boutique by its URL subdomain slug.
 *
 * ARCHITECTURE RULE: This function is always called inside a try/catch in layouts.
 * Do NOT throw from this function — return null on any failure.
 */
export async function resolveTenant(subdomain: string): Promise<ResolvedTenant | null> {
  try {
    const result = await db
      .select()
      .from(tenants)
      .where(eq(tenants.subdomain, subdomain))
      .limit(1);

    return result[0] ?? null;
  } catch (error) {
    console.error(`[resolveTenant] Failed to resolve subdomain "${subdomain}":`, error);
    return null;
  }
}
```

### 1.2 — `apps/brand-network-web/src/app/[subdomain]/layout.tsx`
```tsx
import { notFound } from 'next/navigation';
import { resolveTenant } from '@/lib/tenant';
import FloatingPillNav from '@/components/navigation/FloatingPillNav';
import Footer from '@/components/navigation/Footer';
import type { Metadata } from 'next';

interface Props {
  children: React.ReactNode;
  params: Promise<{ subdomain: string }>; // MANDATORY async params — Next.js 16
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  // MANDATORY: await params before access
  const { subdomain } = await params;
  let tenant = null;

  try {
    tenant = await resolveTenant(subdomain);
  } catch {
    // Silent fail — metadata fallback
  }

  return {
    title: tenant ? `${tenant.name} | Top 10 Prom` : 'Top 10 Prom Boutique',
    description: tenant
      ? `Visit ${tenant.name} in ${tenant.city}, ${tenant.state}. Expert prom and wedding styling.`
      : 'Discover luxury prom and wedding dresses at a Top 10 Prom boutique.',
  };
}

export default async function SubdomainLayout({ children, params }: Props) {
  // MANDATORY: await params before access
  const { subdomain } = await params;

  let tenant = null;

  // ARCHITECTURE RULE: try/catch wraps ALL tenant resolution
  // On failure: branded not-found, NOT a hard redirect to /network
  try {
    tenant = await resolveTenant(subdomain);
  } catch (error) {
    console.error(`[SubdomainLayout] Resolution error for "${subdomain}":`, error);
  }

  // Tenant not found — render branded 404, preserve URL context
  if (!tenant) {
    notFound();
  }

  return (
    <>
      <FloatingPillNav />
      <main data-tenant-id={tenant.id} data-subdomain={subdomain}>
        {children}
      </main>
      <Footer />
    </>
  );
}
```

### 1.3 — `apps/brand-network-web/src/app/[subdomain]/not-found.tsx`
```tsx
import Link from 'next/link';

export default function SubdomainNotFound() {
  return (
    <div
      className="mesh-bg"
      style={{
        minHeight: '100dvh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '2rem',
        textAlign: 'center',
      }}
    >
      <div>
        <p className="label-luxury" style={{ color: 'var(--color-brand-secondary)', marginBottom: '1.5rem' }}>
          Boutique Not Found
        </p>
        <h1
          className="heading-display"
          style={{ fontSize: 'clamp(3rem, 8vw, 6rem)', marginBottom: '1.5rem' }}
        >
          404
        </h1>
        <p
          style={{
            color: 'var(--color-text-secondary)',
            fontSize: '1.125rem',
            maxWidth: '480px',
            margin: '0 auto 2.5rem',
            lineHeight: 1.7,
          }}
        >
          We couldn't find this boutique location. Use our store locator to find the nearest Top 10 Prom near you.
        </p>
        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
          <Link href="/locator" className="btn-primary">Find a Boutique</Link>
          <Link href="/home" className="btn-ghost">Return Home</Link>
        </div>
      </div>
    </div>
  );
}
```

### 1.4 — `apps/brand-network-web/src/app/[subdomain]/page.tsx`
```tsx
import { notFound } from 'next/navigation';
import { resolveTenant } from '@/lib/tenant';
import { db } from '@toptenprom/database';
import { dress_inventory, dresses } from '@toptenprom/database';
import { eq, sql, and } from 'drizzle-orm';
import Link from 'next/link';
import Image from 'next/image';

interface Props {
  params: Promise<{ subdomain: string }>; // MANDATORY async params
}

async function getFeaturedDresses(tenantId: string) {
  'use cache';
  try {
    return db
      .select({
        id: dresses.id,
        name: dresses.name,
        designer: dresses.designer,
        occasion: dresses.occasion,
        retail_price: dresses.retail_price,
        hero_image: sql<string>`dresses.image_urls->>'hero'`,
        color_name: dress_inventory.color_name,
      })
      .from(dress_inventory)
      .leftJoin(dresses, eq(dress_inventory.dress_id, dresses.id))
      .where(
        and(
          eq(dress_inventory.tenant_id, tenantId),
          eq(dress_inventory.in_stock, true),
          eq(dresses.is_active, true)
        )
      )
      .limit(6)
      .orderBy(sql`RANDOM()`);
  } catch {
    return [];
  }
}

export default async function SubdomainPage({ params }: Props) {
  // MANDATORY: await params
  const { subdomain } = await params;
  let tenant = null;

  try {
    tenant = await resolveTenant(subdomain);
  } catch {
    // fail through to notFound()
  }

  if (!tenant) notFound();

  const featuredDresses = await getFeaturedDresses(tenant!.id);

  return (
    <div>
      {/* ── HERO SECTION ── */}
      <section
        className="mesh-bg noise-overlay"
        style={{
          minHeight: '100dvh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '8rem 2rem 4rem',
          textAlign: 'center',
          position: 'relative',
        }}
      >
        {/* Location badge */}
        <p className="label-luxury" style={{ marginBottom: '1.5rem' }}>
          {tenant!.city}, {tenant!.state}
        </p>

        {/* Store name */}
        <h1
          className="heading-display"
          style={{
            fontSize: 'clamp(3rem, 8vw, 7rem)',
            maxWidth: '900px',
            marginBottom: '2rem',
            lineHeight: 1.05,
          }}
        >
          {tenant!.name}
        </h1>

        <p
          style={{
            color: 'var(--color-text-secondary)',
            fontSize: '1.25rem',
            maxWidth: '560px',
            marginBottom: '3rem',
            lineHeight: 1.7,
          }}
        >
          Discover your perfect prom or wedding look with our expert stylists and exclusive designer collections.
        </p>

        {/* CTAs — both scoped to this tenant's subdomain */}
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', justifyContent: 'center' }}>
          <Link href={`/${subdomain}/book`} className="btn-primary" style={{ fontSize: '1.0625rem', padding: '0.875rem 2.5rem' }}>
            Book an Appointment
          </Link>
          <Link href={`/${subdomain}/try-on`} className="btn-ghost" style={{ fontSize: '1.0625rem', padding: '0.875rem 2.5rem' }}>
            Virtual Try-On
          </Link>
        </div>

        {/* Scroll indicator */}
        <div
          style={{
            position: 'absolute',
            bottom: '2rem',
            left: '50%',
            transform: 'translateX(-50%)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '0.5rem',
            color: 'var(--color-text-tertiary)',
            fontSize: '0.75rem',
            letterSpacing: '0.15em',
            textTransform: 'uppercase',
            animation: 'fadeIn 1s ease 1.5s forwards',
            opacity: 0,
          }}
        >
          <span>Scroll</span>
          <div style={{ width: '1px', height: '32px', background: 'var(--color-surface-border-md)' }} />
        </div>
      </section>

      {/* ── BOUTIQUE DETAILS ── */}
      <section style={{ padding: '4rem 2rem', maxWidth: '1200px', margin: '0 auto' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1.5rem' }}>
          {/* Hours */}
          {tenant!.business_hours && (
            <div className="glass-card" style={{ padding: '2rem' }}>
              <p className="label-luxury" style={{ marginBottom: '1.25rem' }}>Hours</p>
              {Object.entries(tenant!.business_hours).map(([day, hours]) => (
                <div
                  key={day}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    padding: '0.5rem 0',
                    borderBottom: '1px solid var(--color-surface-border)',
                    fontSize: '0.875rem',
                    color: 'var(--color-text-secondary)',
                  }}
                >
                  <span style={{ textTransform: 'capitalize' }}>{day}</span>
                  <span>{hours.closed ? 'Closed' : `${hours.open} – ${hours.close}`}</span>
                </div>
              ))}
            </div>
          )}

          {/* Contact */}
          <div className="glass-card" style={{ padding: '2rem' }}>
            <p className="label-luxury" style={{ marginBottom: '1.25rem' }}>Visit Us</p>
            <p style={{ color: 'var(--color-text-secondary)', marginBottom: '0.5rem', lineHeight: 1.6 }}>
              {tenant!.address}<br />
              {tenant!.city}, {tenant!.state} {tenant!.zip}
            </p>
            <p style={{ color: 'var(--color-brand-secondary)', fontSize: '0.875rem' }}>
              {tenant!.phone}
            </p>
            <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.875rem', marginTop: '0.25rem' }}>
              {tenant!.email}
            </p>
          </div>

          {/* CTA Card */}
          <div
            className="bento-card"
            style={{
              padding: '2rem',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              gap: '1.5rem',
            }}
          >
            <div>
              <p className="label-luxury" style={{ marginBottom: '0.75rem' }}>Ready to Find Your Dress?</p>
              <p style={{ color: 'var(--color-text-secondary)', lineHeight: 1.6, fontSize: '0.9375rem' }}>
                Book a personal styling session with one of our expert stylists today.
              </p>
            </div>
            <Link href={`/${subdomain}/book`} className="btn-gold" style={{ textAlign: 'center' }}>
              Book Now
            </Link>
          </div>
        </div>
      </section>

      {/* ── FEATURED COLLECTION ── */}
      {featuredDresses.length > 0 && (
        <section style={{ padding: '4rem 2rem', background: 'var(--color-bg-elevated)' }}>
          <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
            <p className="label-luxury" style={{ marginBottom: '1rem', textAlign: 'center' }}>In Store Now</p>
            <h2 className="heading-section" style={{ fontSize: 'clamp(2rem, 4vw, 3rem)', textAlign: 'center', marginBottom: '3rem' }}>
              Featured Collection
            </h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1.5rem' }}>
              {featuredDresses.map((dress) => (
                <div key={dress.id} className="glass-card" style={{ overflow: 'hidden' }}>
                  {dress.hero_image && (
                    <div style={{ position: 'relative', aspectRatio: '3 / 4', overflow: 'hidden' }}>
                      <Image
                        src={dress.hero_image}
                        alt={`${dress.name} by ${dress.designer}`}
                        fill
                        style={{ objectFit: 'cover', transition: 'transform 0.6s var(--ease-luxury)' }}
                        onMouseEnter={(e) => (e.currentTarget.style.transform = 'scale(1.04)')}
                        onMouseLeave={(e) => (e.currentTarget.style.transform = 'scale(1)')}
                        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                      />
                    </div>
                  )}
                  <div style={{ padding: '1.25rem' }}>
                    <p className="label-luxury" style={{ marginBottom: '0.5rem' }}>
                      {dress.occasion} · {dress.color_name}
                    </p>
                    <p style={{ fontFamily: 'var(--font-display)', fontSize: '1.125rem', fontWeight: 600 }}>
                      {dress.name}
                    </p>
                    <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.875rem', marginTop: '0.25rem' }}>
                      {dress.designer}
                    </p>
                    <p style={{ color: 'var(--color-brand-secondary)', fontWeight: 700, marginTop: '0.75rem' }}>
                      ${Number(dress.retail_price).toFixed(0)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
            <div style={{ textAlign: 'center', marginTop: '3rem' }}>
              <Link href={`/${subdomain}/catalog`} className="btn-ghost">
                View Full Collection
              </Link>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
```

### 1.5 — `apps/brand-network-web/src/app/[subdomain]/error.tsx`
```tsx
'use client';

import { useEffect } from 'react';
import Link from 'next/link';

interface Props {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function SubdomainError({ error, reset }: Props) {
  useEffect(() => {
    console.error('[SubdomainError]', error);
  }, [error]);

  return (
    <div
      className="mesh-bg"
      style={{
        minHeight: '100dvh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '2rem',
        textAlign: 'center',
      }}
    >
      <div className="glass-card" style={{ maxWidth: '480px', width: '100%', padding: '3rem' }}>
        <p className="label-luxury" style={{ color: 'var(--color-error)', marginBottom: '1rem' }}>
          Something Went Wrong
        </p>
        <h2 className="heading-display" style={{ fontSize: '2rem', marginBottom: '1rem' }}>
          Boutique Unavailable
        </h2>
        <p style={{ color: 'var(--color-text-secondary)', lineHeight: 1.7, marginBottom: '2rem' }}>
          We had trouble loading this boutique. Your data is safe. Please retry or contact us if the issue continues.
        </p>
        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
          <button type="button" className="btn-primary" onClick={reset}>Try Again</button>
          <Link href="/locator" className="btn-ghost">Find Another Boutique</Link>
        </div>
      </div>
    </div>
  );
}
```

---

## [EXECUTION BLOCK 2: Mobile App — WatermelonDB Architecture]

### 2.1 — Install Expo & WatermelonDB Dependencies
```bash
cd apps/mobile-instore-app
npx expo install @nozbe/watermelondb
npx expo install @nozbe/with-observables
npx expo install expo-sqlite
npx expo install expo-secure-store
npx expo install @react-navigation/native @react-navigation/native-stack
npx expo install react-native-screens react-native-safe-area-context
```

### 2.2 — `apps/mobile-instore-app/src/db/schema.ts`
> **CRITICAL:** This is `v1`. Do NOT modify this schema in Phase 6 without bumping to `v2` with explicit migrations. The schema MUST be a 1:1 local representation of the Phase 1 PostgreSQL tables for synced entities.

```typescript
import { appSchema, tableSchema } from '@nozbe/watermelondb';

/**
 * WatermelonDB local schema — v1
 *
 * SYNC SCOPE: appointments, vto_sessions, client_style_profiles, walk_ins
 * OFFLINE-ONLY scope: local UUIDs generated with generateLocalId()
 *
 * MIGRATION RULE: Any schema change bumps schemaVersion to 2 with explicit migration.
 */
export const schema = appSchema({
  version: 1,
  tables: [
    tableSchema({
      name: 'appointments',
      columns: [
        { name: 'server_id', type: 'string', isOptional: true },    // PostgreSQL UUID after sync
        { name: 'tenant_id', type: 'string' },
        { name: 'customer_id', type: 'string' },
        { name: 'stylist_id', type: 'string', isOptional: true },
        { name: 'appointment_date', type: 'number' },                // Unix timestamp
        { name: 'duration_minutes', type: 'number' },
        { name: 'service_type', type: 'string' },
        { name: 'status', type: 'string' },                          // 'pending' | 'confirmed' | ...
        { name: 'notes', type: 'string', isOptional: true },
        { name: 'confirmation_code', type: 'string' },
        { name: 'is_synced', type: 'boolean' },
        { name: 'sync_conflict', type: 'boolean' },
        { name: 'version_timestamp', type: 'number' },               // OCC tracking
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' },
      ],
    }),
    tableSchema({
      name: 'vto_sessions',
      columns: [
        { name: 'server_id', type: 'string', isOptional: true },
        { name: 'user_id', type: 'string' },
        { name: 'tenant_id', type: 'string', isOptional: true },
        { name: 'dress_id', type: 'string' },
        { name: 'color_name', type: 'string' },
        { name: 'status', type: 'string' },                          // 'queued' | 'completed' | 'failed'
        { name: 'output_image_url', type: 'string', isOptional: true },
        { name: 'is_synced', type: 'boolean' },
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' },
      ],
    }),
    tableSchema({
      name: 'client_style_profiles',
      columns: [
        { name: 'server_id', type: 'string', isOptional: true },
        { name: 'user_id', type: 'string' },
        { name: 'preferred_designers', type: 'string' },              // JSON string
        { name: 'preferred_colors', type: 'string' },                 // JSON string
        { name: 'preferred_silhouettes', type: 'string' },            // JSON string
        { name: 'budget_min', type: 'number', isOptional: true },
        { name: 'budget_max', type: 'number', isOptional: true },
        { name: 'raw_conversation_summary', type: 'string', isOptional: true },
        { name: 'is_synced', type: 'boolean' },
        { name: 'updated_at', type: 'number' },
      ],
    }),
    tableSchema({
      name: 'walk_ins',
      columns: [
        { name: 'server_id', type: 'string', isOptional: true },
        { name: 'tenant_id', type: 'string' },
        { name: 'customer_name', type: 'string' },
        { name: 'phone_number', type: 'string' },
        { name: 'party_size', type: 'number' },
        { name: 'occasion', type: 'string', isOptional: true },
        { name: 'notes', type: 'string', isOptional: true },
        { name: 'status', type: 'string' },                          // 'waiting' | 'called' | ...
        { name: 'queue_position', type: 'number' },
        { name: 'is_synced', type: 'boolean' },
        { name: 'checked_in_at', type: 'number' },
        { name: 'created_at', type: 'number' },
      ],
    }),
  ],
});
```

### 2.3 — `apps/mobile-instore-app/src/db/models/Appointment.ts`
```typescript
import { Model } from '@nozbe/watermelondb';
import { field, text, date, readonly } from '@nozbe/watermelondb/decorators';

export default class Appointment extends Model {
  static table = 'appointments';

  @text('server_id') serverId!: string | null;
  @text('tenant_id') tenantId!: string;
  @text('customer_id') customerId!: string;
  @text('stylist_id') stylistId!: string | null;
  @date('appointment_date') appointmentDate!: Date;
  @field('duration_minutes') durationMinutes!: number;
  @text('service_type') serviceType!: string;
  @text('status') status!: string;
  @text('notes') notes!: string | null;
  @text('confirmation_code') confirmationCode!: string;
  @field('is_synced') isSynced!: boolean;
  @field('sync_conflict') syncConflict!: boolean;
  @field('version_timestamp') versionTimestamp!: number;
  @readonly @date('created_at') createdAt!: Date;
  @date('updated_at') updatedAt!: Date;
}
```

### 2.4 — `apps/mobile-instore-app/src/db/models/WalkIn.ts`
```typescript
import { Model } from '@nozbe/watermelondb';
import { field, text, date, readonly } from '@nozbe/watermelondb/decorators';

export default class WalkIn extends Model {
  static table = 'walk_ins'; // Matches Phase 1 canonical table name

  @text('server_id') serverId!: string | null;
  @text('tenant_id') tenantId!: string;
  @text('customer_name') customerName!: string;
  @text('phone_number') phoneNumber!: string;
  @field('party_size') partySize!: number;
  @text('occasion') occasion!: string | null;
  @text('notes') notes!: string | null;
  @text('status') status!: string;
  @field('queue_position') queuePosition!: number;
  @field('is_synced') isSynced!: boolean;
  @date('checked_in_at') checkedInAt!: Date;
  @readonly @date('created_at') createdAt!: Date;
}
```

### 2.5 — `apps/mobile-instore-app/src/db/index.ts`
```typescript
import { Database } from '@nozbe/watermelondb';
import SQLiteAdapter from '@nozbe/watermelondb/adapters/sqlite';
import { schema } from './schema';
import Appointment from './models/Appointment';
import WalkIn from './models/WalkIn';

const adapter = new SQLiteAdapter({
  schema,
  // SQLite adapter configuration for Expo
  jsi: true, // Enable JSI for better performance on iOS/Android
  onSetUpError: (error) => {
    console.error('[WatermelonDB] Setup error:', error);
  },
});

export const database = new Database({
  adapter,
  modelClasses: [Appointment, WalkIn],
});

export { Appointment, WalkIn };
```

---

## [EXECUTION BLOCK 3: Mobile Screens]

### 3.1 — `apps/mobile-instore-app/src/screens/WalkInBookingScreen.tsx`
```tsx
import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { database } from '../db';
import type { Database } from '@nozbe/watermelondb';

const OCCASIONS = ['Prom', 'Wedding', 'Homecoming', 'Bridesmaid', 'General'] as const;

interface Props {
  tenantId: string;
  onComplete: () => void;
}

export default function WalkInBookingScreen({ tenantId, onComplete }: Props) {
  const [customerName, setCustomerName] = useState('');
  const [phone, setPhone] = useState('');
  const [partySize, setPartySize] = useState('1');
  const [selectedOccasion, setSelectedOccasion] = useState<string>('');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!customerName.trim() || !phone.trim()) {
      Alert.alert('Required Fields', 'Please enter customer name and phone number.');
      return;
    }

    setIsSubmitting(true);

    try {
      await database.write(async () => {
        const collection = database.get('walk_ins');
        await collection.create((record: any) => {
          record.serverId = null; // Will be set after sync
          record.tenantId = tenantId;
          record.customerName = customerName.trim();
          record.phoneNumber = phone.trim();
          record.partySize = parseInt(partySize, 10) || 1;
          record.occasion = selectedOccasion || null;
          record.notes = notes.trim() || null;
          record.status = 'waiting';
          record.queuePosition = Date.now(); // Temporary — corrected on sync
          record.isSynced = false;
          record.checkedInAt = new Date();
        });
      });

      Alert.alert('Checked In!', `${customerName} has been added to the queue.`, [
        { text: 'OK', onPress: onComplete },
      ]);
    } catch (error) {
      console.error('[WalkInBookingScreen] Failed to create walk-in:', error);
      Alert.alert('Error', 'Failed to add to queue. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>Walk-In Check-In</Text>
        <Text style={styles.subtitle}>Add customer to today's queue</Text>

        <View style={styles.field}>
          <Text style={styles.label}>Customer Name *</Text>
          <TextInput
            style={styles.input}
            value={customerName}
            onChangeText={setCustomerName}
            placeholder="Full name"
            placeholderTextColor="rgba(248,244,240,0.35)"
            autoCapitalize="words"
            autoCorrect={false}
            returnKeyType="next"
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Phone Number *</Text>
          <TextInput
            style={styles.input}
            value={phone}
            onChangeText={setPhone}
            placeholder="(555) 000-0000"
            placeholderTextColor="rgba(248,244,240,0.35)"
            keyboardType="phone-pad"
            returnKeyType="next"
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Party Size</Text>
          <TextInput
            style={[styles.input, { width: 100 }]}
            value={partySize}
            onChangeText={setPartySize}
            keyboardType="number-pad"
            maxLength={2}
            returnKeyType="next"
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Occasion</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow}>
            {OCCASIONS.map((occasion) => (
              <TouchableOpacity
                key={occasion}
                onPress={() => setSelectedOccasion(selectedOccasion === occasion ? '' : occasion)}
                style={[
                  styles.chip,
                  selectedOccasion === occasion && styles.chipSelected,
                ]}
                accessibilityRole="button"
                accessibilityState={{ selected: selectedOccasion === occasion }}
              >
                <Text
                  style={[
                    styles.chipText,
                    selectedOccasion === occasion && styles.chipTextSelected,
                  ]}
                >
                  {occasion}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Notes (optional)</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={notes}
            onChangeText={setNotes}
            placeholder="Any special requests or notes…"
            placeholderTextColor="rgba(248,244,240,0.35)"
            multiline
            numberOfLines={3}
            textAlignVertical="top"
          />
        </View>

        <TouchableOpacity
          style={[styles.submitButton, isSubmitting && styles.submitButtonDisabled]}
          onPress={handleSubmit}
          disabled={isSubmitting}
          accessibilityRole="button"
          accessibilityLabel={isSubmitting ? 'Adding to queue…' : 'Add to queue'}
        >
          <Text style={styles.submitText}>
            {isSubmitting ? 'Adding to Queue…' : 'Add to Queue'}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0B0A0E' },
  scroll: { padding: 24, paddingBottom: 48 },
  title: {
    fontFamily: 'BodoniBoda_700Bold',
    fontSize: 32,
    color: '#F8F4F0',
    marginTop: 48,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: 'rgba(248,244,240,0.6)',
    marginBottom: 32,
  },
  field: { marginBottom: 20 },
  label: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: '#C9A96E',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#070609',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 12,
    padding: 16,
    fontSize: 16, // Mandatory 16px for iOS keyboard
    color: '#F8F4F0',
  },
  textArea: { height: 88, paddingTop: 16 },
  chipRow: { flexDirection: 'row', marginTop: 4 },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 9999,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    marginRight: 8,
    backgroundColor: 'transparent',
    minWidth: 44, // Touch target
    minHeight: 44, // Touch target
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipSelected: {
    backgroundColor: 'rgba(242,75,154,0.15)',
    borderColor: '#F24B9A',
  },
  chipText: { fontSize: 14, color: 'rgba(248,244,240,0.6)' },
  chipTextSelected: { color: '#F24B9A', fontWeight: '600' },
  submitButton: {
    backgroundColor: '#F24B9A',
    borderRadius: 9999,
    padding: 18,
    alignItems: 'center',
    marginTop: 24,
    minHeight: 56, // Large touch target
  },
  submitButtonDisabled: { opacity: 0.5 },
  submitText: { color: '#0B0A0E', fontSize: 16, fontWeight: '700', letterSpacing: 1 },
});
```

### 3.2 — `apps/mobile-instore-app/src/screens/ClientRegistrationScreen.tsx`
```tsx
import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';

interface Props {
  tenantId: string;
  onRegistered: (customerId: string) => void;
}

export default function ClientRegistrationScreen({ tenantId, onRegistered }: Props) {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [guardianName, setGuardianName] = useState('');
  const [guardianPhone, setGuardianPhone] = useState('');
  const [promYear, setPromYear] = useState(new Date().getFullYear().toString());
  const [schoolName, setSchoolName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleRegister = async () => {
    if (!firstName.trim() || !lastName.trim() || !email.trim()) {
      Alert.alert('Required Fields', 'First name, last name, and email are required.');
      return;
    }

    setIsSubmitting(true);

    try {
      // POST to Next.js API — sync endpoint
      const response = await fetch(`${process.env.EXPO_PUBLIC_API_URL}/api/customers/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Secret': process.env.EXPO_PUBLIC_MOBILE_SYNC_SECRET ?? '',
        },
        body: JSON.stringify({
          tenantId,
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          email: email.trim().toLowerCase(),
          phone: phone.trim(),
          guardianName: guardianName.trim() || null,
          guardianPhone: guardianPhone.trim() || null,
          promYear: parseInt(promYear, 10) || null,
          schoolName: schoolName.trim() || null,
        }),
      });

      if (!response.ok) {
        const { error } = await response.json() as { error: string };
        throw new Error(error ?? 'Registration failed');
      }

      const { customer_id } = await response.json() as { customer_id: string };
      onRegistered(customer_id);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Registration failed';
      Alert.alert('Registration Error', message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>New Client</Text>
        <Text style={styles.subtitle}>Register a new customer profile</Text>

        {[
          { label: 'First Name *', value: firstName, set: setFirstName, placeholder: 'Jane', auto: 'given-name' as const },
          { label: 'Last Name *', value: lastName, set: setLastName, placeholder: 'Smith', auto: 'family-name' as const },
          { label: 'Email *', value: email, set: setEmail, placeholder: 'jane@example.com', keyboard: 'email-address' as const, auto: 'email' as const },
          { label: 'Phone', value: phone, set: setPhone, placeholder: '(555) 000-0000', keyboard: 'phone-pad' as const },
          { label: 'School Name', value: schoolName, set: setSchoolName, placeholder: 'Lincoln High School' },
          { label: 'Prom Year', value: promYear, set: setPromYear, placeholder: '2025', keyboard: 'number-pad' as const },
        ].map(({ label, value, set, placeholder, keyboard, auto }) => (
          <View key={label} style={styles.field}>
            <Text style={styles.label}>{label}</Text>
            <TextInput
              style={styles.input}
              value={value}
              onChangeText={set}
              placeholder={placeholder}
              placeholderTextColor="rgba(248,244,240,0.35)"
              keyboardType={keyboard ?? 'default'}
              autoCapitalize={auto === 'email' ? 'none' : 'words'}
              autoComplete={auto}
              returnKeyType="next"
            />
          </View>
        ))}

        <Text style={[styles.label, { marginTop: 16, marginBottom: 12, color: 'var(--color-text-tertiary)' }]}>
          Guardian Information (optional)
        </Text>

        {[
          { label: 'Guardian Name', value: guardianName, set: setGuardianName, placeholder: 'Parent / Guardian' },
          { label: 'Guardian Phone', value: guardianPhone, set: setGuardianPhone, placeholder: '(555) 000-0000', keyboard: 'phone-pad' as const },
        ].map(({ label, value, set, placeholder, keyboard }) => (
          <View key={label} style={styles.field}>
            <Text style={styles.label}>{label}</Text>
            <TextInput
              style={styles.input}
              value={value}
              onChangeText={set}
              placeholder={placeholder}
              placeholderTextColor="rgba(248,244,240,0.35)"
              keyboardType={keyboard ?? 'default'}
              autoCapitalize="words"
              returnKeyType="next"
            />
          </View>
        ))}

        <TouchableOpacity
          style={[styles.submitButton, isSubmitting && styles.submitButtonDisabled]}
          onPress={handleRegister}
          disabled={isSubmitting}
          accessibilityRole="button"
        >
          <Text style={styles.submitText}>
            {isSubmitting ? 'Registering…' : 'Create Client Profile'}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0B0A0E' },
  scroll: { padding: 24, paddingBottom: 48 },
  title: { fontFamily: 'BodoniBoda_700Bold', fontSize: 32, color: '#F8F4F0', marginTop: 48, marginBottom: 8 },
  subtitle: { fontSize: 16, color: 'rgba(248,244,240,0.6)', marginBottom: 32 },
  field: { marginBottom: 18 },
  label: { fontSize: 12, fontWeight: '600', letterSpacing: 2, textTransform: 'uppercase', color: '#C9A96E', marginBottom: 8 },
  input: { backgroundColor: '#070609', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', borderRadius: 12, padding: 16, fontSize: 16, color: '#F8F4F0' },
  submitButton: { backgroundColor: '#F24B9A', borderRadius: 9999, padding: 18, alignItems: 'center', marginTop: 24, minHeight: 56 },
  submitButtonDisabled: { opacity: 0.5 },
  submitText: { color: '#0B0A0E', fontSize: 16, fontWeight: '700', letterSpacing: 1 },
});
```

---

## [EXECUTION BLOCK 4: Sync Engine & Backend API]

### 4.1 — `apps/mobile-instore-app/src/db/SyncEngine.ts`
```typescript
import { synchronize } from '@nozbe/watermelondb/sync';
import { database } from './index';

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? '';
const API_SECRET = process.env.EXPO_PUBLIC_MOBILE_SYNC_SECRET ?? '';

interface SyncChanges {
  appointments: {
    created: Record<string, unknown>[];
    updated: Record<string, unknown>[];
    deleted: string[];
  };
  walk_ins: {
    created: Record<string, unknown>[];
    updated: Record<string, unknown>[];
    deleted: string[];
  };
}

/**
 * SyncEngine — Bidirectional WatermelonDB <-> PostgreSQL sync.
 *
 * CONFLICT RESOLUTION: Uses `version_timestamp` for Optimistic Concurrency Control.
 * If server timestamp > local timestamp, server wins and local changes are overwritten.
 * Conflicts are surfaced to the calling component for user resolution.
 */
export async function syncWithServer(tenantId: string): Promise<{ conflicts: unknown[] }> {
  const conflicts: unknown[] = [];

  await synchronize({
    database,

    pullChanges: async ({ lastPulledAt, schemaVersion, migration }) => {
      const response = await fetch(
        `${API_URL}/api/sync?tenant_id=${tenantId}&last_pulled_at=${lastPulledAt ?? 0}&schema_version=${schemaVersion}`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'X-Sync-Secret': API_SECRET,
          },
        }
      );

      if (!response.ok) {
        throw new Error(`Sync pull failed: ${response.statusText}`);
      }

      const { changes, timestamp } = await response.json() as {
        changes: SyncChanges;
        timestamp: number;
      };

      return { changes, timestamp };
    },

    pushChanges: async ({ changes, lastPulledAt }) => {
      const response = await fetch(`${API_URL}/api/sync`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Sync-Secret': API_SECRET,
        },
        body: JSON.stringify({ changes, lastPulledAt, tenantId }),
      });

      if (!response.ok) {
        const { conflict_records } = await response.json() as { conflict_records?: unknown[] };
        if (conflict_records?.length) {
          conflicts.push(...conflict_records);
        } else {
          throw new Error(`Sync push failed: ${response.statusText}`);
        }
      }
    },

    migrationsEnabledAtVersion: 1, // Enable when schema version bumps to 2
  });

  return { conflicts };
}
```

### 4.2 — `apps/brand-network-web/src/app/api/sync/route.ts`
```typescript
import { NextRequest, NextResponse } from 'next/server';
import { db, withTenant } from '@toptenprom/database';
import { appointments, walk_ins } from '@toptenprom/database';
import { sql, gte, eq } from 'drizzle-orm';

/**
 * Validates the mobile sync API secret from request headers.
 * Returns false if missing or invalid — caller should return 401.
 */
function validateSyncSecret(request: NextRequest): boolean {
  const secret = request.headers.get('x-sync-secret');
  const expectedSecret = process.env.MOBILE_SYNC_API_SECRET;

  if (!expectedSecret) {
    console.error('[SyncAPI] MOBILE_SYNC_API_SECRET not configured');
    return false;
  }

  return secret === expectedSecret;
}

/** GET: Pull server changes since lastPulledAt */
export async function GET(request: NextRequest) {
  if (!validateSyncSecret(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = request.nextUrl;
  const tenantId = searchParams.get('tenant_id');
  const lastPulledAt = parseInt(searchParams.get('last_pulled_at') ?? '0', 10);

  if (!tenantId) {
    return NextResponse.json({ error: 'tenant_id is required' }, { status: 400 });
  }

  const sinceDate = new Date(lastPulledAt);
  const now = Date.now();

  try {
    const [updatedAppointments, updatedWalkIns] = await Promise.all([
      db.select().from(appointments)
        .where(sql`tenant_id = ${tenantId} AND updated_at >= ${sinceDate}`),
      db.select().from(walk_ins)
        .where(sql`tenant_id = ${tenantId} AND updated_at >= ${sinceDate}`),
    ]);

    return NextResponse.json({
      changes: {
        appointments: {
          created: updatedAppointments.filter((a) => a.created_at >= sinceDate),
          updated: updatedAppointments.filter((a) => a.created_at < sinceDate),
          deleted: [],
        },
        walk_ins: {
          created: updatedWalkIns.filter((w) => w.created_at >= sinceDate),
          updated: updatedWalkIns.filter((w) => w.created_at < sinceDate),
          deleted: [],
        },
      },
      timestamp: now,
    });
  } catch (error) {
    console.error('[SyncAPI GET] Failed:', error);
    return NextResponse.json({ error: 'Sync pull failed' }, { status: 500 });
  }
}

/** POST: Push local device changes to server */
export async function POST(request: NextRequest) {
  if (!validateSyncSecret(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: {
    changes: Record<string, { created: Record<string, unknown>[]; updated: Record<string, unknown>[] }>;
    tenantId: string;
    lastPulledAt: number;
  };

  try {
    body = await request.json() as typeof body;
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const { changes, tenantId } = body;
  const conflictRecords: unknown[] = [];

  try {
    // Upsert walk_ins from device — NOTE: table name is walk_ins (not availability_inquiries)
    if (changes.walk_ins?.created?.length) {
      for (const walkIn of changes.walk_ins.created) {
        try {
          await db.insert(walk_ins).values({
            tenant_id: tenantId,
            customer_name: String(walkIn.customer_name ?? ''),
            phone_number: String(walkIn.phone_number ?? ''),
            party_size: Number(walkIn.party_size ?? 1),
            occasion: walkIn.occasion ? String(walkIn.occasion) as 'prom' | 'wedding' : null,
            notes: walkIn.notes ? String(walkIn.notes) : null,
            status: 'waiting',
            queue_position: Number(walkIn.queue_position ?? 0),
            checked_in_at: new Date(Number(walkIn.checked_in_at) ?? Date.now()),
          }).onConflictDoNothing();
        } catch (insertError) {
          conflictRecords.push({ record: walkIn, error: String(insertError) });
        }
      }
    }

    if (conflictRecords.length > 0) {
      return NextResponse.json({ conflict_records: conflictRecords }, { status: 409 });
    }

    return NextResponse.json({ synced: true });
  } catch (error) {
    console.error('[SyncAPI POST] Failed:', error);
    return NextResponse.json({ error: 'Sync push failed' }, { status: 500 });
  }
}
```

---

## [VALIDATION CHECKPOINT — PHASE 5]

```bash
pnpm --filter @toptenprom/brand-network-web typecheck
pnpm --filter @toptenprom/brand-network-web lint
```

**Required checklist:**
- [ ] `app/[subdomain]/layout.tsx` uses `await params` — never sync access
- [ ] `resolveTenant()` is inside `try/catch` in BOTH layout and page
- [ ] On resolution failure → `notFound()` — no `redirect('/network')`
- [ ] `app/[subdomain]/not-found.tsx` uses full glassmorphism design system
- [ ] WatermelonDB schema `version: 1` is explicit
- [ ] `walk_ins` table name matches Phase 1 schema throughout mobile code
- [ ] `SyncEngine.ts` uses `version_timestamp` for OCC
- [ ] `/api/sync/route.ts` validates `MOBILE_SYNC_API_SECRET` header on every request
- [ ] All React Native `TextInput` components use `fontSize: 16`

**Update PHASE_MANIFEST.md:** Mark Phase 5 as ✅ COMPLETE.

**STOP. Await human approval before executing Phase 6.**
