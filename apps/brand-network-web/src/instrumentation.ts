import * as Sentry from '@sentry/nextjs';

const PII_KEYS = ['password', 'phone_number', 'phone', 'email', 'image_base64'];

function scrubPII(data: Record<string, unknown> | undefined): Record<string, unknown> | undefined {
  if (!data) return data;
  for (const key of PII_KEYS) {
    if (key in data) delete data[key];
  }
  return data;
}

export function register() {
  const dsn = process.env['NEXT_PUBLIC_SENTRY_DSN'];
  if (!dsn) {
    console.warn('[Telemetry] NEXT_PUBLIC_SENTRY_DSN missing. Sentry server/edge disabled.');
    return;
  }

  Sentry.init({
    dsn,
    tracesSampleRate: 0.1,
    debug: false,
    beforeSend(event) {
      if (event.request) {
        const data = event.request.data;
        if (data && typeof data === 'object' && !Array.isArray(data)) {
          event.request.data = scrubPII(data as Record<string, unknown>);
        }
        if (event.request.headers) {
          delete event.request.headers['authorization'];
          delete event.request.headers['cookie'];
        }
      }
      if (event.user) {
        delete event.user.email;
        delete event.user.ip_address;
      }
      return event;
    },
  });
}

export const onRequestError = Sentry.captureRequestError;
