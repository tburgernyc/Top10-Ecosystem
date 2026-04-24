import twilio, { Twilio } from 'twilio';

let cached: Twilio | null = null;

export function getTwilio(): Twilio | null {
  if (cached) return cached;
  if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN) return null;
  cached = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
  return cached;
}

export const TWILIO_FROM = process.env.TWILIO_FROM_NUMBER ?? null;
