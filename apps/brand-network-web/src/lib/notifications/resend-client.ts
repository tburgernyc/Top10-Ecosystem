import { Resend } from 'resend';

let cached: Resend | null = null;

export function getResend(): Resend | null {
  if (cached) return cached;
  if (!process.env.RESEND_API_KEY) return null;
  cached = new Resend(process.env.RESEND_API_KEY);
  return cached;
}

export const FROM_EMAIL = process.env.RESEND_FROM_EMAIL ?? 'noreply@toptenprom.store';
