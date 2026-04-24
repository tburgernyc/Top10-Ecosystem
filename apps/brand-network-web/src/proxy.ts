import { type NextRequest, NextResponse } from 'next/server';
import { updateSession } from './lib/supabase/middleware-helpers';

/**
 * RESERVED PATHS — These bypass subdomain rewriting entirely.
 * Prevents collision between tenant subdomains and corporate routes.
 */
const RESERVED_PATHS = new Set([
  '/dashboard',
  '/login',
  '/gate',
  '/api',
  '/home',
  '/catalog',
  '/book',
  '/locator',
  '/try-on',
  '/about',
  '/contact',
  '/journal',
  '/auth',
]);

const STATIC_PATHS_PATTERN = /^\/_next|^\/favicon\.ico|^\/robots\.txt|^\/sitemap\.xml|^.*\.\w+$/;

/**
 * Top-level proxy function (replaces middleware in Next.js 16).
 * Handles: subdomain extraction, tenant routing, auth session refresh.
 *
 * CRITICAL: This file is proxy.ts — NOT middleware.ts.
 * middleware.ts is DEPRECATED in Next.js 16. This file MUST be named proxy.ts.
 */
export default async function proxy(request: NextRequest): Promise<NextResponse> {
  const { pathname, hostname } = request.nextUrl;

  // ── Skip static assets ──────────────────────────────────────────────────
  if (STATIC_PATHS_PATTERN.test(pathname)) {
    return NextResponse.next();
  }

  // ── Auth session refresh (non-blocking) ─────────────────────────────────
  const authResponse = await updateSession(request);

  // ── Subdomain extraction ────────────────────────────────────────────────
  const baseDomain = process.env['NEXT_PUBLIC_DOMAIN'] ?? 'toptenprom.store';
  const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1';

  let subdomain: string | null = null;

  if (!isLocalhost) {
    const hostWithoutPort = hostname.split(':')[0] ?? hostname;
    if (hostWithoutPort.endsWith(`.${baseDomain}`)) {
      subdomain = hostWithoutPort.replace(`.${baseDomain}`, '');
    }
  } else {
    subdomain = request.nextUrl.searchParams.get('subdomain');
  }

  // ── Corporate domain or no subdomain — pass through ─────────────────────
  if (!subdomain) {
    return authResponse;
  }

  // ── Collision protection — reserved paths bypass rewrite ─────────────────
  const firstSegment = `/${pathname.split('/')[1] ?? ''}`;
  if (RESERVED_PATHS.has(firstSegment) || RESERVED_PATHS.has(pathname)) {
    return authResponse;
  }

  // ── Tenant subdomain rewrite ──────────────────────────────────────────
  const rewriteUrl = request.nextUrl.clone();
  rewriteUrl.pathname = `/${subdomain}${pathname}`;

  const rewriteResponse = NextResponse.rewrite(rewriteUrl);

  // Propagate auth cookies from session refresh using name/value/options API
  for (const cookie of authResponse.cookies.getAll()) {
    rewriteResponse.cookies.set(cookie.name, cookie.value, cookie);
  }

  return rewriteResponse;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)',
  ],
};
