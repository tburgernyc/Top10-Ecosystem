import type { NextConfig } from 'next';
import path from 'path';

const nextConfig: NextConfig = {
  // ── Turbopack — root set to monorepo root ──────────────────────────────
  turbopack: {
    root: path.resolve(__dirname, '../..'),
  },

  // ── Image Configuration ─────────────────────────────────────────────────
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.supabase.co',
        pathname: '/storage/v1/object/**',
      },
      {
        protocol: 'https',
        hostname: 'maps.googleapis.com',
        pathname: '/maps/api/staticmap**',
      },
      {
        protocol: 'https',
        hostname: 'maps.googleapis.com',
        pathname: '/maps/api/streetview**',
      },
      {
        protocol: 'https',
        hostname: '*.fal.run',
      },
      {
        protocol: 'https',
        hostname: 'storage.googleapis.com',
      },
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
      },
    ],
  },

  // ── Logging (Next.js 16.2 — browser errors forwarded to terminal) ───────
  logging: {
    browserToTerminal: 'error',
  },
};

export default nextConfig;
