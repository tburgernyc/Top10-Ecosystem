import type { Config } from 'drizzle-kit';

if (!process.env['DATABASE_URL_DIRECT']) {
  throw new Error('DATABASE_URL_DIRECT is required for Drizzle Kit. Check .env');
}

export default {
  schema: './src/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env['DATABASE_URL_DIRECT'],
  },
  verbose: true,
  strict: true,
} satisfies Config;
