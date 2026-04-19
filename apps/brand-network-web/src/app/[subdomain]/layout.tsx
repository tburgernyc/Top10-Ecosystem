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
  // MANDATORY: await params before access — Next.js 16 breaking change
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
  // MANDATORY: await params before access — Next.js 16 breaking change
  const { subdomain } = await params;

  let tenant = null;

  // ARCHITECTURE RULE: try/catch wraps ALL tenant resolution
  // On failure: branded not-found via notFound(), NOT a hard redirect()
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
