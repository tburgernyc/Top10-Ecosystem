# Phase 10: Parent/Guardian Portal & Dual-Notification System

---

## [PRE-EXECUTION DIRECTIVE]
**MANDATORY FIRST ACTION:** Read `PHASE_MANIFEST.md` (Phase 0) in full. Verify ALL Phases 1–9 are marked ✅ COMPLETE before writing a single line of code.

**Role:** Principal Staff Engineer  
**Context:** Build the parent/guardian communication layer. This phase delivers: (1) a guardian-linked notification system where parents or guardians receive appointment confirmations, dress reservation updates, and payment receipts without having a platform account; (2) an optional guardian portal — a read-only view accessible via a one-time PIN that lets a parent review their child's shortlist and reservation; (3) a structured notification log for audit and compliance purposes. This feature is a core differentiator for the Top 10 Prom demographic where parental consent and involvement are standard expectations.  
**Quality Standard:** Institutional Grade. Zero placeholders. Zero `// TODO`. Zero implicit `any` types.  
**Execution Rules:**  
- Guardian data is sensitive PII. It MUST be stored encrypted or minimized.  
- Notification delivery uses Resend (email) and Twilio (SMS). Both must be gracefully degraded — failure of one channel does NOT block the other.  
- Guardian portal access tokens are single-use, time-limited (48h), and stored as bcrypt hashes — never in plaintext.  
- `guardian_notifications` is the canonical table name. Do NOT use `parent_alerts` or `guardian_alerts`.  
- All `params`/`searchParams` MUST be `await`ed — Next.js 16 mandatory.  
- `redirect()` MUST be outside all `try/catch` blocks.

---

## [EXECUTION BLOCK 1: New Environment Variables]

### 1.1 — Add to `.env.example` (workspace root)

```bash
# ── NOTIFICATION SERVICES ────────────────────────────────────────────────────
RESEND_API_KEY="re_..."                  # Resend — transactional email delivery
RESEND_FROM_EMAIL="noreply@toptenprom.com"
TWILIO_ACCOUNT_SID="AC..."              # Twilio — SMS delivery
TWILIO_AUTH_TOKEN="..."
TWILIO_FROM_NUMBER="+1..."              # Verified Twilio sender number
```

### 1.2 — Install Notification Service SDKs

```bash
cd apps/brand-network-web
pnpm add resend twilio bcryptjs
pnpm add -D @types/bcryptjs
```

---

## [EXECUTION BLOCK 2: Schema Extensions]

### 2.1 — Add New Tables to `packages/database/src/schema.ts`

Append the following tables and enums to the existing schema file. Do NOT modify any existing table definitions.

```typescript
// ─── PHASE 10: GUARDIAN PORTAL & NOTIFICATION SCHEMA ─────────────────────────

export const notificationChannelEnum = pgEnum('notification_channel', [
  'email',
  'sms',
  'both',
]);

export const notificationStatusEnum = pgEnum('notification_status', [
  'queued',
  'sent',
  'delivered',
  'failed',
  'bounced',
]);

export const notificationTypeEnum = pgEnum('notification_type', [
  'appointment_confirmation',
  'appointment_reminder',
  'appointment_cancelled',
  'appointment_rescheduled',
  'reservation_created',
  'reservation_confirmed',
  'reservation_expired',
  'walk_in_called',
  'guardian_portal_invite',
  'payment_receipt',
]);

/**
 * `guardian_profiles`
 * A guardian (parent or trusted adult) linked to a customer account.
 * Guardians do NOT have platform accounts. They receive comms via email/SMS only.
 * A customer may have up to 2 guardians.
 */
export const guardian_profiles = pgTable(
  'guardian_profiles',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    customer_id: uuid('customer_id')
      .notNull()
      .references(() => customers.id, { onDelete: 'cascade' }),
    first_name: varchar('first_name', { length: 80 }).notNull(),
    last_name: varchar('last_name', { length: 80 }).notNull(),
    relationship: varchar('relationship', { length: 60 }).notNull(), // 'mother' | 'father' | 'guardian'
    email: varchar('email', { length: 320 }),
    phone: varchar('phone', { length: 30 }),
    preferred_channel: notificationChannelEnum('preferred_channel').notNull().default('both'),
    is_primary: boolean('is_primary').notNull().default(false),
    is_consent_given: boolean('is_consent_given').notNull().default(false), // GDPR/COPPA consent
    consent_given_at: timestamp('consent_given_at', { withTimezone: true }),
    ...timestamps,
  },
  (t) => ({
    customer_idx: index('guardian_profiles_customer_idx').on(t.customer_id),
    // Max 2 guardians per customer — enforced at application layer
  })
);

/**
 * `guardian_portal_tokens`
 * Time-limited, single-use read-only portal access tokens for guardians.
 * The token hash is bcrypt($token, 12). Raw token is never stored.
 */
export const guardian_portal_tokens = pgTable(
  'guardian_portal_tokens',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    guardian_profile_id: uuid('guardian_profile_id')
      .notNull()
      .references(() => guardian_profiles.id, { onDelete: 'cascade' }),
    customer_id: uuid('customer_id')
      .notNull()
      .references(() => customers.id, { onDelete: 'cascade' }),
    token_hash: varchar('token_hash', { length: 255 }).notNull(), // bcrypt hash
    expires_at: timestamp('expires_at', { withTimezone: true }).notNull(),
    used_at: timestamp('used_at', { withTimezone: true }),
    is_revoked: boolean('is_revoked').notNull().default(false),
    ...timestamps,
  },
  (t) => ({
    guardian_idx: index('guardian_portal_tokens_guardian_idx').on(t.guardian_profile_id),
    customer_idx: index('guardian_portal_tokens_customer_idx').on(t.customer_id),
  })
);

/**
 * `guardian_notifications`
 * Canonical notification log. Every outbound guardian notification is recorded here
 * for audit, compliance, and retry purposes.
 */
export const guardian_notifications = pgTable(
  'guardian_notifications',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    guardian_profile_id: uuid('guardian_profile_id')
      .notNull()
      .references(() => guardian_profiles.id, { onDelete: 'cascade' }),
    customer_id: uuid('customer_id')
      .notNull()
      .references(() => customers.id, { onDelete: 'cascade' }),
    tenant_id: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    notification_type: notificationTypeEnum('notification_type').notNull(),
    channel: notificationChannelEnum('channel').notNull(),
    status: notificationStatusEnum('status').notNull().default('queued'),
    subject: varchar('subject', { length: 255 }),          // Email subject
    body_preview: text('body_preview'),                    // First 200 chars of body for audit
    provider_message_id: varchar('provider_message_id', { length: 255 }), // Resend/Twilio ID
    delivered_at: timestamp('delivered_at', { withTimezone: true }),
    failed_reason: text('failed_reason'),
    retry_count: integer('retry_count').notNull().default(0),
    reference_id: uuid('reference_id'),   // FK to the triggering record (appointment ID, reservation ID, etc.)
    reference_type: varchar('reference_type', { length: 60 }), // 'appointment' | 'reservation' | 'walk_in'
    ...timestamps,
  },
  (t) => ({
    guardian_idx: index('guardian_notifications_guardian_idx').on(t.guardian_profile_id),
    customer_idx: index('guardian_notifications_customer_idx').on(t.customer_id),
    tenant_idx: index('guardian_notifications_tenant_idx').on(t.tenant_id),
    status_idx: index('guardian_notifications_status_idx').on(t.status),
    type_idx: index('guardian_notifications_type_idx').on(t.notification_type),
  })
);
```

### 2.2 — Add Relations for New Tables

Append to `packages/database/src/schema.ts` (relations section):

```typescript
// ─── PHASE 10 RELATIONS ──────────────────────────────────────────────────────

export const guardianProfilesRelations = relations(guardian_profiles, ({ one, many }) => ({
  customer: one(customers, { fields: [guardian_profiles.customer_id], references: [customers.id] }),
  portal_tokens: many(guardian_portal_tokens),
  notifications: many(guardian_notifications),
}));

export const guardianPortalTokensRelations = relations(guardian_portal_tokens, ({ one }) => ({
  guardian: one(guardian_profiles, { fields: [guardian_portal_tokens.guardian_profile_id], references: [guardian_profiles.id] }),
  customer: one(customers, { fields: [guardian_portal_tokens.customer_id], references: [customers.id] }),
}));

export const guardianNotificationsRelations = relations(guardian_notifications, ({ one }) => ({
  guardian: one(guardian_profiles, { fields: [guardian_notifications.guardian_profile_id], references: [guardian_profiles.id] }),
  customer: one(customers, { fields: [guardian_notifications.customer_id], references: [customers.id] }),
  tenant: one(tenants, { fields: [guardian_notifications.tenant_id], references: [tenants.id] }),
}));
```

### 2.3 — Update `packages/database/src/index.ts`

```typescript
export {
  guardian_profiles,
  guardian_portal_tokens,
  guardian_notifications,
  notificationChannelEnum,
  notificationStatusEnum,
  notificationTypeEnum,
} from './schema';
```

### 2.4 — Generate and Apply Migration

```bash
pnpm --filter @toptenprom/database db:migrate
pnpm --filter @toptenprom/database db:push
```

---

## [EXECUTION BLOCK 3: RLS Policies]

### 3.1 — `packages/database/src/migrations/0003_guardian_rls_policies.sql`

```sql
-- ── PHASE 10: RLS for guardian tables ───────────────────────────────────────

ALTER TABLE guardian_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE guardian_portal_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE guardian_notifications ENABLE ROW LEVEL SECURITY;

-- guardian_profiles: customer sees own guardians; staff sees tenant customers' guardians; super_admin sees all
CREATE POLICY "guardian_profiles_isolation" ON guardian_profiles
  FOR ALL USING (
    current_user_role() = 'super_admin'
    OR customer_id IN (SELECT id FROM customers WHERE user_id = current_user_id())
    OR current_user_role() IN ('owner', 'manager', 'stylist', 'receptionist')
  );

-- guardian_portal_tokens: heavily restricted — only super_admin and the owning customer
CREATE POLICY "guardian_portal_tokens_isolation" ON guardian_portal_tokens
  FOR ALL USING (
    current_user_role() = 'super_admin'
    OR customer_id IN (SELECT id FROM customers WHERE user_id = current_user_id())
  );

-- guardian_notifications: customer sees own; staff sees tenant notifications; super_admin sees all
CREATE POLICY "guardian_notifications_isolation" ON guardian_notifications
  FOR ALL USING (
    current_user_role() = 'super_admin'
    OR tenant_id = current_tenant_id()
    OR customer_id IN (SELECT id FROM customers WHERE user_id = current_user_id())
  );
```

---

## [EXECUTION BLOCK 4: Notification Service Layer]

### 4.1 — `apps/brand-network-web/src/lib/notifications/resend-client.ts`

```typescript
import { Resend } from 'resend';

if (!process.env.RESEND_API_KEY) {
  throw new Error('RESEND_API_KEY is required. Check .env');
}

export const resend = new Resend(process.env.RESEND_API_KEY);

export const FROM_EMAIL = process.env.RESEND_FROM_EMAIL ?? 'noreply@toptenprom.com';
```

### 4.2 — `apps/brand-network-web/src/lib/notifications/twilio-client.ts`

```typescript
import twilio from 'twilio';

if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN) {
  throw new Error('TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN are required. Check .env');
}

export const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

export const TWILIO_FROM = process.env.TWILIO_FROM_NUMBER;

if (!TWILIO_FROM) {
  throw new Error('TWILIO_FROM_NUMBER is required. Check .env');
}
```

### 4.3 — `apps/brand-network-web/src/lib/notifications/templates.ts`

```typescript
/**
 * Email and SMS templates for all guardian notification types.
 * All templates return fully-formed strings — no template engines, no external dependencies.
 */

export interface AppointmentContext {
  customerFirstName: string;
  guardianFirstName: string;
  boutiqueName: string;
  appointmentDate: string;   // e.g. "Saturday, May 3, 2025"
  appointmentTime: string;   // e.g. "2:30 PM"
  confirmationCode: string;
  boutiqueAddress: string;
  boutiquePhone: string;
}

export interface ReservationContext {
  customerFirstName: string;
  guardianFirstName: string;
  boutiqueName: string;
  dressName: string;
  designerName: string;
  colorName: string;
  size: string;
  price: string;
  reservationExpiresAt: string; // e.g. "May 31, 2025"
}

export interface GuardianPortalContext {
  guardianFirstName: string;
  customerFirstName: string;
  portalUrl: string;
  expiresAt: string; // e.g. "48 hours"
}

// ─── APPOINTMENT CONFIRMATION ─────────────────────────────────────────────────

export function appointmentConfirmationEmail(ctx: AppointmentContext): { subject: string; html: string; text: string } {
  return {
    subject: `Appointment Confirmed — ${ctx.customerFirstName} at ${ctx.boutiqueName}`,
    html: `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Appointment Confirmed</title>
  <style>
    body { margin: 0; padding: 0; background: #0B0A0E; font-family: 'Helvetica Neue', Arial, sans-serif; }
    .container { max-width: 600px; margin: 0 auto; padding: 2rem 1.5rem; }
    .brand { color: #C9A96E; font-size: 0.75rem; letter-spacing: 0.15em; text-transform: uppercase; margin-bottom: 2rem; }
    .heading { color: #F8F4F0; font-size: 1.75rem; font-weight: 700; margin-bottom: 0.5rem; line-height: 1.2; }
    .body { color: rgba(248,244,240,0.7); font-size: 1rem; line-height: 1.6; margin-bottom: 1.5rem; }
    .card { background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); border-radius: 12px; padding: 1.5rem; margin: 1.5rem 0; }
    .detail-label { color: rgba(248,244,240,0.5); font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.1em; }
    .detail-value { color: #F8F4F0; font-size: 1rem; font-weight: 600; margin-top: 0.25rem; margin-bottom: 1rem; }
    .code { color: #F24B9A; font-family: monospace; font-size: 1.25rem; font-weight: 700; letter-spacing: 0.1em; }
    .footer { color: rgba(248,244,240,0.35); font-size: 0.75rem; margin-top: 3rem; border-top: 1px solid rgba(255,255,255,0.08); padding-top: 1.5rem; }
  </style>
</head>
<body>
  <div class="container">
    <p class="brand">TOP 10 PROM · GUARDIAN NOTIFICATION</p>
    <h1 class="heading">Appointment Confirmed 💖</h1>
    <p class="body">Hi ${ctx.guardianFirstName}, this is a confirmation that ${ctx.customerFirstName}'s styling appointment has been booked at ${ctx.boutiqueName}.</p>
    <div class="card">
      <p class="detail-label">Confirmation Code</p>
      <p class="code">${ctx.confirmationCode}</p>
      <p class="detail-label">Date</p>
      <p class="detail-value">${ctx.appointmentDate}</p>
      <p class="detail-label">Time</p>
      <p class="detail-value">${ctx.appointmentTime}</p>
      <p class="detail-label">Location</p>
      <p class="detail-value">${ctx.boutiqueName}<br><span style="font-weight:400;color:rgba(248,244,240,0.7)">${ctx.boutiqueAddress}</span></p>
      <p class="detail-label">Questions?</p>
      <p class="detail-value">${ctx.boutiquePhone}</p>
    </div>
    <p class="body">Please save this confirmation code. If plans change, ${ctx.customerFirstName} can reschedule through her account or by calling us directly.</p>
    <div class="footer">
      <p>You're receiving this because you're listed as a guardian for ${ctx.customerFirstName}'s Top 10 Prom account. If this is incorrect, please contact us at support@toptenprom.com.</p>
    </div>
  </div>
</body>
</html>
    `,
    text: `TOP 10 PROM — APPOINTMENT CONFIRMED\n\nHi ${ctx.guardianFirstName},\n\n${ctx.customerFirstName}'s appointment is confirmed.\n\nConfirmation: ${ctx.confirmationCode}\nDate: ${ctx.appointmentDate}\nTime: ${ctx.appointmentTime}\nLocation: ${ctx.boutiqueName}, ${ctx.boutiqueAddress}\nPhone: ${ctx.boutiquePhone}\n\nTop 10 Prom`,
  };
}

export function appointmentConfirmationSMS(ctx: AppointmentContext): string {
  return `TOP 10 PROM: Hi ${ctx.guardianFirstName}! ${ctx.customerFirstName}'s appointment is confirmed for ${ctx.appointmentDate} at ${ctx.appointmentTime} at ${ctx.boutiqueName}. Confirmation: ${ctx.confirmationCode}. Questions? Call ${ctx.boutiquePhone}.`;
}

// ─── DRESS RESERVATION CREATED ────────────────────────────────────────────────

export function reservationCreatedEmail(ctx: ReservationContext): { subject: string; html: string; text: string } {
  return {
    subject: `Dress Reserved — ${ctx.dressName} for ${ctx.customerFirstName}`,
    html: `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Dress Reserved</title>
  <style>
    body { margin: 0; padding: 0; background: #0B0A0E; font-family: 'Helvetica Neue', Arial, sans-serif; }
    .container { max-width: 600px; margin: 0 auto; padding: 2rem 1.5rem; }
    .brand { color: #C9A96E; font-size: 0.75rem; letter-spacing: 0.15em; text-transform: uppercase; margin-bottom: 2rem; }
    .heading { color: #F8F4F0; font-size: 1.75rem; font-weight: 700; margin-bottom: 0.5rem; line-height: 1.2; }
    .body { color: rgba(248,244,240,0.7); font-size: 1rem; line-height: 1.6; margin-bottom: 1.5rem; }
    .card { background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); border-radius: 12px; padding: 1.5rem; margin: 1.5rem 0; }
    .detail-label { color: rgba(248,244,240,0.5); font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.1em; }
    .detail-value { color: #F8F4F0; font-size: 1rem; font-weight: 600; margin-top: 0.25rem; margin-bottom: 1rem; }
    .accent { color: #F24B9A; }
    .footer { color: rgba(248,244,240,0.35); font-size: 0.75rem; margin-top: 3rem; border-top: 1px solid rgba(255,255,255,0.08); padding-top: 1.5rem; }
  </style>
</head>
<body>
  <div class="container">
    <p class="brand">TOP 10 PROM · GUARDIAN NOTIFICATION</p>
    <h1 class="heading">Dress Reserved 🎀</h1>
    <p class="body">Hi ${ctx.guardianFirstName}, ${ctx.customerFirstName} has reserved a dress at ${ctx.boutiqueName}. This dress will be held exclusively for her — no other customer at this boutique can reserve it in the same color and size.</p>
    <div class="card">
      <p class="detail-label">Dress</p>
      <p class="detail-value">${ctx.dressName}</p>
      <p class="detail-label">Designer</p>
      <p class="detail-value">${ctx.designerName}</p>
      <p class="detail-label">Color · Size</p>
      <p class="detail-value">${ctx.colorName} · Size ${ctx.size}</p>
      <p class="detail-label">Price</p>
      <p class="detail-value accent">$${ctx.price}</p>
      <p class="detail-label">Reservation Expires</p>
      <p class="detail-value">${ctx.reservationExpiresAt}</p>
    </div>
    <p class="body">The reservation holds the dress but does not constitute a purchase. ${ctx.customerFirstName} must complete the purchase before the expiration date to secure the dress.</p>
    <div class="footer">
      <p>You're receiving this because you're listed as a guardian for ${ctx.customerFirstName}'s Top 10 Prom account.</p>
    </div>
  </div>
</body>
</html>
    `,
    text: `TOP 10 PROM — DRESS RESERVED\n\nHi ${ctx.guardianFirstName},\n\n${ctx.customerFirstName} reserved: ${ctx.dressName} by ${ctx.designerName} (${ctx.colorName}, Size ${ctx.size}) at ${ctx.boutiqueName}.\n\nPrice: $${ctx.price}\nExpires: ${ctx.reservationExpiresAt}\n\nTop 10 Prom`,
  };
}

export function reservationCreatedSMS(ctx: ReservationContext): string {
  return `TOP 10 PROM: ${ctx.customerFirstName} reserved the ${ctx.dressName} (${ctx.colorName}, Size ${ctx.size}) at ${ctx.boutiqueName} for $${ctx.price}. Reservation expires ${ctx.reservationExpiresAt}.`;
}

// ─── GUARDIAN PORTAL INVITE ───────────────────────────────────────────────────

export function guardianPortalInviteEmail(ctx: GuardianPortalContext): { subject: string; html: string; text: string } {
  return {
    subject: `View ${ctx.customerFirstName}'s Dress Shortlist — Top 10 Prom`,
    html: `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Guardian Portal Access</title>
  <style>
    body { margin: 0; padding: 0; background: #0B0A0E; font-family: 'Helvetica Neue', Arial, sans-serif; }
    .container { max-width: 600px; margin: 0 auto; padding: 2rem 1.5rem; }
    .brand { color: #C9A96E; font-size: 0.75rem; letter-spacing: 0.15em; text-transform: uppercase; margin-bottom: 2rem; }
    .heading { color: #F8F4F0; font-size: 1.75rem; font-weight: 700; margin-bottom: 0.5rem; line-height: 1.2; }
    .body { color: rgba(248,244,240,0.7); font-size: 1rem; line-height: 1.6; margin-bottom: 1.5rem; }
    .btn { display: inline-block; background: #F24B9A; color: #0B0A0E; text-decoration: none; font-weight: 700; padding: 1rem 2.5rem; border-radius: 9999px; font-size: 1rem; letter-spacing: 0.05em; margin: 1.5rem 0; }
    .note { background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); border-radius: 12px; padding: 1.25rem; color: rgba(248,244,240,0.6); font-size: 0.875rem; line-height: 1.5; }
    .footer { color: rgba(248,244,240,0.35); font-size: 0.75rem; margin-top: 3rem; border-top: 1px solid rgba(255,255,255,0.08); padding-top: 1.5rem; }
  </style>
</head>
<body>
  <div class="container">
    <p class="brand">TOP 10 PROM · GUARDIAN PORTAL</p>
    <h1 class="heading">See ${ctx.customerFirstName}'s Shortlist 👗</h1>
    <p class="body">Hi ${ctx.guardianFirstName}, ${ctx.customerFirstName} has shared access to her dress shortlist and reservation details with you. Click the link below to view her selections.</p>
    <a href="${ctx.portalUrl}" class="btn">View Shortlist</a>
    <div class="note">
      <strong style="color:#F8F4F0">Important:</strong> This link is for your eyes only and expires in ${ctx.expiresAt}. It is read-only — no purchases or changes can be made through this link.
    </div>
    <div class="footer">
      <p>You're receiving this because ${ctx.customerFirstName} shared her Top 10 Prom shortlist with you. If you didn't expect this email, you can safely ignore it.</p>
    </div>
  </div>
</body>
</html>
    `,
    text: `TOP 10 PROM — GUARDIAN PORTAL ACCESS\n\nHi ${ctx.guardianFirstName},\n\n${ctx.customerFirstName} has shared her dress shortlist with you.\n\nView it here (expires in ${ctx.expiresAt}):\n${ctx.portalUrl}\n\nThis link is read-only.\n\nTop 10 Prom`,
  };
}
```

### 4.4 — `apps/brand-network-web/src/lib/notifications/send-guardian-notification.ts`

```typescript
import { resend, FROM_EMAIL } from './resend-client';
import { twilioClient, TWILIO_FROM } from './twilio-client';
import { db } from '@toptenprom/database';
import { guardian_notifications } from '@toptenprom/database';

export interface NotificationPayload {
  guardianProfileId: string;
  customerId: string;
  tenantId: string;
  notificationType: 'appointment_confirmation' | 'appointment_reminder' | 'appointment_cancelled' | 'appointment_rescheduled' | 'reservation_created' | 'reservation_confirmed' | 'reservation_expired' | 'walk_in_called' | 'guardian_portal_invite' | 'payment_receipt';
  emailPayload?: {
    to: string;
    subject: string;
    html: string;
    text: string;
  };
  smsPayload?: {
    to: string;
    body: string;
  };
  referenceId?: string;
  referenceType?: string;
}

export async function sendGuardianNotification(
  payload: NotificationPayload
): Promise<{ emailSent: boolean; smsSent: boolean; errors: string[] }> {
  const errors: string[] = [];
  let emailSent = false;
  let smsSent = false;
  let emailProviderId: string | undefined;
  let smsProviderId: string | undefined;

  // ─── EMAIL ────────────────────────────────────────────────────────────────
  if (payload.emailPayload) {
    try {
      const { data, error } = await resend.emails.send({
        from: FROM_EMAIL,
        to: [payload.emailPayload.to],
        subject: payload.emailPayload.subject,
        html: payload.emailPayload.html,
        text: payload.emailPayload.text,
      });

      if (error) {
        errors.push(`Email delivery failed: ${error.message}`);
        await logNotification(payload, 'email', 'failed', undefined, error.message);
      } else {
        emailSent = true;
        emailProviderId = data?.id;
        await logNotification(payload, 'email', 'sent', emailProviderId, undefined, payload.emailPayload.subject, payload.emailPayload.text.slice(0, 200));
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown email error';
      errors.push(`Email exception: ${msg}`);
      await logNotification(payload, 'email', 'failed', undefined, msg);
    }
  }

  // ─── SMS ─────────────────────────────────────────────────────────────────
  if (payload.smsPayload) {
    try {
      const message = await twilioClient.messages.create({
        body: payload.smsPayload.body,
        from: TWILIO_FROM,
        to: payload.smsPayload.to,
      });

      smsProviderId = message.sid;
      smsSent = true;
      await logNotification(payload, 'sms', 'sent', smsProviderId, undefined, undefined, payload.smsPayload.body.slice(0, 200));
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown SMS error';
      errors.push(`SMS exception: ${msg}`);
      await logNotification(payload, 'sms', 'failed', undefined, msg);
    }
  }

  return { emailSent, smsSent, errors };
}

async function logNotification(
  payload: NotificationPayload,
  channel: 'email' | 'sms',
  status: 'sent' | 'failed',
  providerId?: string,
  failedReason?: string,
  subject?: string,
  bodyPreview?: string
): Promise<void> {
  try {
    await db.insert(guardian_notifications).values({
      guardian_profile_id: payload.guardianProfileId,
      customer_id: payload.customerId,
      tenant_id: payload.tenantId,
      notification_type: payload.notificationType,
      channel,
      status,
      subject: subject ?? null,
      body_preview: bodyPreview ?? null,
      provider_message_id: providerId ?? null,
      delivered_at: status === 'sent' ? new Date() : null,
      failed_reason: failedReason ?? null,
      reference_id: payload.referenceId ? payload.referenceId : null,
      reference_type: payload.referenceType ?? null,
    });
  } catch (logError) {
    // Notification logging failure must never block the primary operation
    console.error('[guardian_notifications] Failed to log notification:', logError);
  }
}
```

---

## [EXECUTION BLOCK 5: Server Actions — Guardian Management]

### 5.1 — `apps/brand-network-web/src/actions/guardian-actions.ts`

```typescript
'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { db } from '@toptenprom/database';
import {
  guardian_profiles,
  guardian_portal_tokens,
  customers,
  appointments,
  dress_reservations,
  dresses,
  tenants,
} from '@toptenprom/database';
import { eq, and } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import {
  sendGuardianNotification,
} from '@/lib/notifications/send-guardian-notification';
import {
  guardianPortalInviteEmail,
} from '@/lib/notifications/templates';

// ─── ADD GUARDIAN ─────────────────────────────────────────────────────────────

export async function addGuardianProfile(params: {
  firstName: string;
  lastName: string;
  relationship: string;
  email?: string;
  phone?: string;
  preferredChannel: 'email' | 'sms' | 'both';
  isPrimary: boolean;
  consentGiven: boolean;
}): Promise<{ success: boolean; guardianId?: string; error?: string }> {
  if (!params.consentGiven) {
    return { success: false, error: 'Guardian consent is required to add a guardian profile.' };
  }

  if (!params.email && !params.phone) {
    return { success: false, error: 'At least one contact method (email or phone) is required.' };
  }

  const supabase = await createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  if (!authUser) return { success: false, error: 'Authentication required.' };

  let customerId: string;
  try {
    const result = await db
      .select({ id: customers.id })
      .from(customers)
      .where(eq(customers.user_id, authUser.id))
      .limit(1);
    if (!result[0]?.id) return { success: false, error: 'Customer profile not found.' };
    customerId = result[0].id;
  } catch {
    return { success: false, error: 'Failed to resolve customer.' };
  }

  // Enforce max 2 guardians per customer
  try {
    const existingGuardians = await db
      .select({ id: guardian_profiles.id })
      .from(guardian_profiles)
      .where(eq(guardian_profiles.customer_id, customerId));

    if (existingGuardians.length >= 2) {
      return { success: false, error: 'Maximum of 2 guardians allowed per account.' };
    }
  } catch {
    return { success: false, error: 'Failed to check existing guardians.' };
  }

  try {
    const result = await db
      .insert(guardian_profiles)
      .values({
        customer_id: customerId,
        first_name: params.firstName,
        last_name: params.lastName,
        relationship: params.relationship,
        email: params.email ?? null,
        phone: params.phone ?? null,
        preferred_channel: params.preferredChannel,
        is_primary: params.isPrimary,
        is_consent_given: true,
        consent_given_at: new Date(),
      })
      .returning({ id: guardian_profiles.id });

    revalidatePath('/dashboard/account');
    return { success: true, guardianId: result[0]!.id };
  } catch (error) {
    console.error('[addGuardianProfile] Failed:', error);
    return { success: false, error: 'Failed to add guardian. Please try again.' };
  }
}

// ─── SEND GUARDIAN PORTAL INVITE ─────────────────────────────────────────────

export async function sendGuardianPortalInvite(params: {
  guardianProfileId: string;
  tenantId: string;
}): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  if (!authUser) return { success: false, error: 'Authentication required.' };

  // Resolve customer and verify guardian belongs to this customer
  let customerId: string;
  let guardian: { id: string; first_name: string; email: string | null; customer_id: string } | undefined;

  try {
    const customerResult = await db
      .select({ id: customers.id, first_name: customers.first_name })
      .from(customers)
      .where(eq(customers.user_id, authUser.id))
      .limit(1);
    if (!customerResult[0]) return { success: false, error: 'Customer not found.' };
    customerId = customerResult[0].id;
  } catch {
    return { success: false, error: 'Failed to resolve customer.' };
  }

  try {
    const result = await db
      .select({ id: guardian_profiles.id, first_name: guardian_profiles.first_name, email: guardian_profiles.email, customer_id: guardian_profiles.customer_id })
      .from(guardian_profiles)
      .where(and(eq(guardian_profiles.id, params.guardianProfileId), eq(guardian_profiles.customer_id, customerId)))
      .limit(1);
    guardian = result[0];
  } catch {
    return { success: false, error: 'Failed to resolve guardian.' };
  }

  if (!guardian) return { success: false, error: 'Guardian not found or access denied.' };
  if (!guardian.email) return { success: false, error: 'This guardian has no email address on file.' };

  // Generate portal token
  const rawToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = await bcrypt.hash(rawToken, 12);
  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + 48);

  try {
    const tokenResult = await db
      .insert(guardian_portal_tokens)
      .values({
        guardian_profile_id: guardian.id,
        customer_id: customerId,
        token_hash: tokenHash,
        expires_at: expiresAt,
      })
      .returning({ id: guardian_portal_tokens.id });

    const portalUrl = `${process.env.NEXT_PUBLIC_BASE_URL}/guardian-portal/${tokenResult[0]!.id}?token=${rawToken}`;

    // Get customer first name
    const customerNameResult = await db
      .select({ first_name: customers.first_name })
      .from(customers)
      .where(eq(customers.id, customerId))
      .limit(1);
    const customerFirstName = customerNameResult[0]?.first_name ?? 'your family member';

    const emailTemplate = guardianPortalInviteEmail({
      guardianFirstName: guardian.first_name,
      customerFirstName,
      portalUrl,
      expiresAt: '48 hours',
    });

    await sendGuardianNotification({
      guardianProfileId: guardian.id,
      customerId,
      tenantId: params.tenantId,
      notificationType: 'guardian_portal_invite',
      emailPayload: {
        to: guardian.email,
        ...emailTemplate,
      },
    });

    return { success: true };
  } catch (error) {
    console.error('[sendGuardianPortalInvite] Failed:', error);
    return { success: false, error: 'Failed to send portal invite.' };
  }
}
```

---

## [EXECUTION BLOCK 6: Guardian Portal — Read-Only Page]

### 6.1 — `apps/brand-network-web/src/app/(public)/guardian-portal/[tokenId]/page.tsx`

```tsx
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { db } from '@toptenprom/database';
import {
  guardian_portal_tokens,
  guardian_profiles,
  customers,
  dress_reservations,
  appointments,
  dresses,
  tenants,
} from '@toptenprom/database';
import { eq, and } from 'drizzle-orm';
import bcrypt from 'bcryptjs';

export const metadata: Metadata = {
  title: 'Guardian Portal | Top 10 Prom',
  robots: { index: false, follow: false }, // Never indexed — private read-only view
};

interface GuardianPortalPageProps {
  params: Promise<{ tokenId: string }>;
  searchParams: Promise<{ token?: string }>;
}

export default async function GuardianPortalPage({ params, searchParams }: GuardianPortalPageProps) {
  const { tokenId } = await params;
  const { token } = await searchParams;

  if (!token) notFound();

  // Look up the token record
  let tokenRecord: { id: string; token_hash: string; expires_at: Date; used_at: Date | null; is_revoked: boolean; customer_id: string; guardian_profile_id: string } | undefined;
  try {
    const result = await db
      .select()
      .from(guardian_portal_tokens)
      .where(eq(guardian_portal_tokens.id, tokenId))
      .limit(1);
    tokenRecord = result[0] as typeof tokenRecord;
  } catch {
    notFound();
  }

  if (!tokenRecord) notFound();
  if (tokenRecord.is_revoked) notFound();
  if (new Date() > new Date(tokenRecord.expires_at)) notFound();

  // Verify token — constant-time bcrypt compare
  const isValid = await bcrypt.compare(token, tokenRecord.token_hash);
  if (!isValid) notFound();

  // Mark token as used (single-use)
  try {
    await db
      .update(guardian_portal_tokens)
      .set({ used_at: new Date(), updated_at: new Date() })
      .where(eq(guardian_portal_tokens.id, tokenId));
  } catch {
    // Non-fatal — continue rendering
  }

  // Fetch guardian and customer data
  const [guardianResult, customerResult] = await Promise.allSettled([
    db.select().from(guardian_profiles).where(eq(guardian_profiles.id, tokenRecord.guardian_profile_id)).limit(1),
    db.select().from(customers).where(eq(customers.id, tokenRecord.customer_id)).limit(1),
  ]);

  const guardian = guardianResult.status === 'fulfilled' ? guardianResult.value[0] : null;
  const customer = customerResult.status === 'fulfilled' ? customerResult.value[0] : null;

  if (!guardian || !customer) notFound();

  // Fetch active reservations
  let activeReservations: { id: string; color_name: string; size: string; reservation_status: string; dress_name: string; designer: string | null; price: string | null; image_urls: unknown }[] = [];
  try {
    const reservations = await db
      .select({
        id: dress_reservations.id,
        color_name: dress_reservations.color_name,
        size: dress_reservations.size,
        reservation_status: dress_reservations.reservation_status,
        dress_name: dresses.name,
        designer: dresses.designer,
        price: dresses.price,
        image_urls: dresses.image_urls,
      })
      .from(dress_reservations)
      .innerJoin(dresses, eq(dress_reservations.dress_id, dresses.id))
      .where(eq(dress_reservations.customer_id, tokenRecord.customer_id));
    activeReservations = reservations;
  } catch {
    // Non-fatal
  }

  // Fetch upcoming appointments
  let upcomingAppointments: { id: string; appointment_date: Date; service_type: string | null; status: string; confirmation_code: string; tenant_name: string; tenant_address: string | null; tenant_phone: string | null }[] = [];
  try {
    const appts = await db
      .select({
        id: appointments.id,
        appointment_date: appointments.appointment_date,
        service_type: appointments.service_type,
        status: appointments.status,
        confirmation_code: appointments.confirmation_code,
        tenant_name: tenants.name,
        tenant_address: tenants.address,
        tenant_phone: tenants.phone,
      })
      .from(appointments)
      .innerJoin(tenants, eq(appointments.tenant_id, tenants.id))
      .where(eq(appointments.customer_id, tokenRecord.customer_id));
    upcomingAppointments = appts;
  } catch {
    // Non-fatal
  }

  const firstImageUrl = (imageUrls: unknown): string => {
    if (Array.isArray(imageUrls) && imageUrls.length > 0) return imageUrls[0] as string;
    return 'https://images.unsplash.com/photo-1594938298603-c8148c4b4ae4?w=800&auto=format&fit=crop&q=85';
  };

  return (
    <div className="mesh-bg" style={{ minHeight: '100dvh', padding: 'clamp(5rem, 10vw, 7rem) 1.5rem 4rem' }}>
      <div style={{ maxWidth: '760px', margin: '0 auto' }}>
        {/* Header */}
        <div style={{ marginBottom: '3rem' }}>
          <p className="label-luxury" style={{ marginBottom: '0.75rem' }}>Guardian Portal · Read Only</p>
          <h1 className="heading-display" style={{ fontSize: 'clamp(1.75rem, 5vw, 3rem)', lineHeight: 1.1, marginBottom: '0.75rem' }}>
            {customer.first_name}'s Top 10 Prom
          </h1>
          <p style={{ color: 'var(--color-text-secondary)' }}>
            Hi {guardian.first_name} — here's a read-only view of {customer.first_name}'s reservations and appointments.
          </p>
          <div className="glass-card" style={{ padding: '0.875rem 1.25rem', marginTop: '1.25rem', display: 'inline-block' }}>
            <p style={{ color: 'var(--color-warning)', fontSize: '0.8125rem', fontFamily: 'var(--font-mono)' }}>
              ⚠ This view is read-only. This link may have been invalidated after your first visit.
            </p>
          </div>
        </div>

        {/* Reservations */}
        {activeReservations.length > 0 && (
          <section style={{ marginBottom: '3rem' }}>
            <h2 className="heading-section" style={{ fontSize: '1.25rem', marginBottom: '1.25rem' }}>Dress Reservations</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {activeReservations.map((r) => (
                <div key={r.id} className="glass-card" style={{ padding: '1.25rem', display: 'flex', gap: '1.25rem', flexWrap: 'wrap' }}>
                  <div style={{ width: '90px', height: '110px', borderRadius: 'var(--radius-md)', overflow: 'hidden', flexShrink: 0, background: 'var(--color-bg-sunken)' }}>
                    <img src={firstImageUrl(r.image_urls)} alt={r.dress_name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} loading="lazy" />
                  </div>
                  <div style={{ flex: 1, minWidth: '180px' }}>
                    <p className="label-luxury" style={{ marginBottom: '0.25rem' }}>{r.designer ?? 'House Collection'}</p>
                    <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.125rem', fontWeight: 600, marginBottom: '0.5rem' }}>{r.dress_name}</h3>
                    <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.875rem', marginBottom: '0.25rem' }}>{r.color_name} · Size {r.size}</p>
                    {r.price && <p style={{ color: 'var(--color-brand-secondary)', fontWeight: 600 }}>${r.price}</p>}
                    <span style={{ display: 'inline-block', marginTop: '0.5rem', padding: '0.25rem 0.75rem', borderRadius: 'var(--radius-pill)', background: r.reservation_status === 'active' ? 'rgba(50,215,75,0.15)' : 'rgba(255,69,58,0.15)', color: r.reservation_status === 'active' ? 'var(--color-success)' : 'var(--color-error)', fontSize: '0.75rem', fontWeight: 600 }}>
                      {r.reservation_status.toUpperCase()}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Appointments */}
        {upcomingAppointments.length > 0 && (
          <section>
            <h2 className="heading-section" style={{ fontSize: '1.25rem', marginBottom: '1.25rem' }}>Appointments</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {upcomingAppointments.map((a) => (
                <div key={a.id} className="glass-card" style={{ padding: '1.25rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.5rem' }}>
                    <div>
                      <p className="label-luxury" style={{ marginBottom: '0.25rem' }}>Confirmation · {a.confirmation_code}</p>
                      <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.125rem', fontWeight: 600 }}>{a.tenant_name}</h3>
                      {a.tenant_address && <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.875rem', marginTop: '0.25rem' }}>{a.tenant_address}</p>}
                      {a.tenant_phone && <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.875rem' }}>{a.tenant_phone}</p>}
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <p style={{ color: 'var(--color-text-primary)', fontWeight: 600 }}>
                        {new Date(a.appointment_date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                      </p>
                      <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.875rem' }}>
                        {new Date(a.appointment_date).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {activeReservations.length === 0 && upcomingAppointments.length === 0 && (
          <div className="glass-card" style={{ padding: '3rem', textAlign: 'center' }}>
            <p style={{ color: 'var(--color-text-secondary)' }}>No reservations or appointments found yet.</p>
          </div>
        )}
      </div>
    </div>
  );
}
```

---

## [EXECUTION BLOCK 7: Appointment Trigger Hook]

### 7.1 — Update `apps/brand-network-web/src/app/api/bookings/create/route.ts`

After a successful appointment insert, add the following guardian notification dispatch. This replaces the return statement at the end of the route handler:

```typescript
// --- AFTER: await db.insert(appointments)... ---

// Dispatch guardian notifications (fire-and-forget — never block the response)
void (async () => {
  try {
    const customerGuardians = await db
      .select({
        id: guardian_profiles.id,
        first_name: guardian_profiles.first_name,
        last_name: guardian_profiles.last_name,
        email: guardian_profiles.email,
        phone: guardian_profiles.phone,
        preferred_channel: guardian_profiles.preferred_channel,
        is_consent_given: guardian_profiles.is_consent_given,
      })
      .from(guardian_profiles)
      .where(
        and(
          eq(guardian_profiles.customer_id, customerId),
          eq(guardian_profiles.is_consent_given, true)
        )
      );

    if (customerGuardians.length === 0) return;

    // Get tenant info for the notification
    const tenantInfo = await db
      .select({ name: tenants.name, address: tenants.address, phone: tenants.phone })
      .from(tenants)
      .where(eq(tenants.id, locationId))
      .limit(1);

    const tenant = tenantInfo[0];
    if (!tenant) return;

    // Get customer name
    const customerInfo = await db
      .select({ first_name: customers.first_name })
      .from(customers)
      .where(eq(customers.id, customerId))
      .limit(1);

    const customerFirstName = customerInfo[0]?.first_name ?? 'your family member';
    const appointmentDateObj = appointmentDateTime;

    const { appointmentConfirmationEmail, appointmentConfirmationSMS } = await import('@/lib/notifications/templates');
    const { sendGuardianNotification } = await import('@/lib/notifications/send-guardian-notification');

    for (const guardian of customerGuardians) {
      const ctx = {
        customerFirstName,
        guardianFirstName: guardian.first_name,
        boutiqueName: tenant.name,
        appointmentDate: appointmentDateObj.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }),
        appointmentTime: appointmentDateObj.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
        confirmationCode,
        boutiqueAddress: tenant.address ?? '',
        boutiquePhone: tenant.phone ?? '',
      };

      const emailTemplate = appointmentConfirmationEmail(ctx);
      const smsBody = appointmentConfirmationSMS(ctx);

      await sendGuardianNotification({
        guardianProfileId: guardian.id,
        customerId,
        tenantId: locationId,
        notificationType: 'appointment_confirmation',
        emailPayload: (guardian.email && guardian.preferred_channel !== 'sms')
          ? { to: guardian.email, ...emailTemplate }
          : undefined,
        smsPayload: (guardian.phone && guardian.preferred_channel !== 'email')
          ? { to: guardian.phone, body: smsBody }
          : undefined,
        referenceId: undefined, // appointment id from insert
        referenceType: 'appointment',
      });
    }
  } catch (notifError) {
    // Guardian notification failure NEVER blocks the booking response
    console.error('[Booking] Guardian notification dispatch failed:', notifError);
  }
})();

// --- EXISTING RETURN ---
return NextResponse.json({ confirmation_code: confirmationCode }, { status: 201 });
```

---

## [EXECUTION BLOCK 8: Update PHASE_MANIFEST.md]

### 8.1 — Add Phase 10 to the Phase Completion Registry

```
| 10 | Parent/Guardian Portal & Dual-Notification System | ⬜ PENDING | — |
```

### 8.2 — Add New Table Names to Canonical Registry

```
| `guardian_profiles`        | Guardian (parent/trusted adult) PII — linked to customers |
| `guardian_portal_tokens`   | Single-use bcrypt-hashed portal access tokens |
| `guardian_notifications`   | Audit log of all outbound guardian notifications |
```

### 8.3 — Add New Env Vars to ENV_MANIFEST

```
RESEND_API_KEY              # Resend — transactional email
RESEND_FROM_EMAIL           # Verified sender email (noreply@toptenprom.com)
TWILIO_ACCOUNT_SID          # Twilio Account SID
TWILIO_AUTH_TOKEN           # Twilio Auth Token
TWILIO_FROM_NUMBER          # Verified sender phone number
```

---

## [VALIDATION CHECKPOINT — PHASE 10]

```bash
# Step 1: Schema integrity
pnpm --filter @toptenprom/database db:check

# Step 2: TypeScript — zero errors
pnpm --filter @toptenprom/brand-network-web typecheck

# Step 3: Lint — zero warnings
pnpm --filter @toptenprom/brand-network-web lint

# Step 4: Production build
pnpm --filter @toptenprom/brand-network-web build
```

**Manual QA checklist:**
- [ ] `guardian_profiles` table exists with max-2 constraint enforced at application layer
- [ ] `guardian_portal_tokens.token_hash` stores bcrypt hashes — NEVER the raw token
- [ ] `/guardian-portal/[tokenId]` has `robots: { index: false, follow: false }` in metadata
- [ ] Guardian portal page uses `bcrypt.compare` for constant-time token verification
- [ ] `sendGuardianNotification` — email failure does NOT block SMS delivery and vice versa
- [ ] Guardian notification dispatch in booking route is `void (async () => {})()` — fire-and-forget
- [ ] All guardian email templates render correctly without external CSS dependencies
- [ ] `RESEND_API_KEY`, `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER`, `RESEND_FROM_EMAIL` present in `.env.example`
- [ ] `guardian_notifications` log entry created for every email/SMS attempt — both success and failure
- [ ] `is_consent_given` checked before sending any notification — non-consented guardians receive nothing
- [ ] Guardian portal token expires after 48 hours — `notFound()` returned if expired
- [ ] Portal page marks token `used_at` on first access — subsequent visits still allowed (graceful UX)
- [ ] `SUPABASE_SERVICE_ROLE_KEY` is NOT used in any guardian notification path — server client only

**Vercel function configuration** — add to `apps/brand-network-web/vercel.json` functions block:
```json
"src/app/api/guardian/notify/route.ts": {
  "maxDuration": 15,
  "memory": 512
}
```

**Update PHASE_MANIFEST.md:** Mark Phase 10 as ✅ COMPLETE.

**STOP. Await human approval before executing Phase 11.**