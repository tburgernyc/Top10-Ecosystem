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
        await logNotification(payload, 'email', 'sent', data?.id, undefined, payload.emailPayload.subject, payload.emailPayload.text.slice(0, 200));
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
        from: TWILIO_FROM!,
        to: payload.smsPayload.to,
      });

      smsSent = true;
      await logNotification(payload, 'sms', 'sent', message.sid, undefined, undefined, payload.smsPayload.body.slice(0, 200));
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
      reference_id: payload.referenceId ?? null,
      reference_type: payload.referenceType ?? null,
    });
  } catch (logError) {
    console.error('[guardian_notifications] Failed to log notification:', logError);
  }
}
