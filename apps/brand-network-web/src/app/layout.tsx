import type { Metadata, Viewport } from 'next';
import { Analytics } from '@vercel/analytics/react';
import '@/app/globals.css';

export const metadata: Metadata = {
  title: {
    default: 'Top 10 Prom — Luxury Boutique Network',
    template: '%s | Top 10 Prom',
  },
  description:
    'Discover your perfect prom or wedding dress at one of our 55 luxury boutique locations. AI-powered styling, virtual try-on, and exclusive designer collections.',
  keywords: ['prom dresses', 'wedding dresses', 'luxury boutique', 'designer dresses', 'prom 2025'],
  openGraph: {
    type: 'website',
    siteName: 'Top 10 Prom',
    locale: 'en_US',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true },
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  themeColor: '#0B0A0E',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head />
      <body>
        {children}
        <Analytics />
      </body>
    </html>
  );
}
