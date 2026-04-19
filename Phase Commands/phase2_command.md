# Phase 2: Next.js 16.2.4 Architecture, Design System & Global Shell

---

## [PRE-EXECUTION DIRECTIVE]
**MANDATORY FIRST ACTION:** Read `PHASE_MANIFEST.md` (Phase 0) in full. Verify Phase 1 is marked ✅ COMPLETE.

**Role:** Principal Staff Engineer & Lead UX Architect  
**Context:** Phase 1 is complete. Scaffold the Next.js 16.2.4 application architecture, inject the full design system, build the proxy routing layer, and create the global navigation shell.  
**Quality Standard:** Institutional Grade. All configurations must be production-ready to prevent runtime crashes.  
**Execution Rule:** Do NOT build the Dashboard or AI features yet. Do NOT add placeholder routes. Every file must be complete or not created at all.

---

## [NEXT.JS 16.2.4 CRITICAL CHANGE CHECKLIST]
> Verify before touching any Next.js file. These are breaking changes.

- [ ] `proxy.ts` replaces `middleware.ts` — use `export default function proxy(request: NextRequest)`
- [ ] All `params`/`searchParams` must be `await`ed — never access synchronously
- [ ] Turbopack config at top-level `turbopack: {}` — NOT `experimental.turbopack`
- [ ] `'use cache'` directive at function/component level — NOT a `next.config.ts` flag
- [ ] `reactCompiler: true` is stable — enable for automatic memoization
- [ ] All inputs use `text-base` minimum font size — iOS Safari zoom prevention

---

## [EXECUTION BLOCK 1: Next.js 16.2.4 Core Configuration]

### 1.1 — `apps/brand-network-web/package.json` — Dependency Installation
```bash
cd apps/brand-network-web

# Core framework
pnpm add next@16.2.4 react@19.2.0 react-dom@19.2.0

# Supabase
pnpm add @supabase/ssr @supabase/supabase-js

# Design system / UI
pnpm add tailwindcss@4 @tailwindcss/typography

# Fonts (Google Fonts via next/font)
# Bodoni Moda + Satoshi loaded via next/font in layout.tsx

# Analytics
pnpm add @vercel/analytics

# Workspace packages
pnpm add @toptenprom/database@workspace:* @toptenprom/ui-design-system@workspace:*

pnpm add -D @toptenprom/typescript-config@workspace:* @toptenprom/eslint-config@workspace:* @types/react @types/react-dom typescript
```

### 1.2 — `apps/brand-network-web/next.config.ts`
```typescript
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // ── React Compiler (stable in Next.js 16) ──────────────────────────────
  reactCompiler: true,

  // ── Turbopack (top-level in Next.js 16, default bundler) ───────────────
  turbopack: {
    rules: {
      '*.svg': {
        loaders: ['@svgr/webpack'],
        as: '*.js',
      },
    },
  },

  // ── Image Configuration ─────────────────────────────────────────────────
  images: {
    remotePatterns: [
      // Supabase Storage
      {
        protocol: 'https',
        hostname: '*.supabase.co',
        pathname: '/storage/v1/object/**',
      },
      // Google Maps Static Images
      {
        protocol: 'https',
        hostname: 'maps.googleapis.com',
        pathname: '/maps/api/staticmap**',
      },
      // Google Maps Street View
      {
        protocol: 'https',
        hostname: 'maps.googleapis.com',
        pathname: '/maps/api/streetview**',
      },
      // Fal.ai diffusion output images
      {
        protocol: 'https',
        hostname: '*.fal.run',
      },
      {
        protocol: 'https',
        hostname: 'storage.googleapis.com',
      },
      // Placeholder images for development
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

  // ── Experimental ─────────────────────────────────────────────────────────
  experimental: {
    // Typed routes for compile-time route safety
    typedRoutes: true,
    // Instrumentation hook (for Vercel observability)
    instrumentationHook: true,
  },
};

export default nextConfig;
```

### 1.3 — `apps/brand-network-web/tsconfig.json`
```json
{
  "extends": "@toptenprom/typescript-config/nextjs.json",
  "compilerOptions": {
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

---

## [EXECUTION BLOCK 2: Proxy Routing Layer — Subdomain Architecture]

### 2.1 — `apps/brand-network-web/src/proxy.ts`
> **CRITICAL:** This is `proxy.ts`, NOT `middleware.ts`. Middleware is deprecated in Next.js 16. Node.js runtime — no edge runtime.

```typescript
import { type NextRequest, NextResponse } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware-helpers';

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

const STATIC_PATHS_PATTERN = /^\/(_next|favicon\.ico|robots\.txt|sitemap\.xml|.*\.\w+$)/;

/**
 * Top-level proxy function (replaces middleware in Next.js 16).
 * Handles: subdomain extraction, tenant routing, auth session refresh.
 */
export default async function proxy(request: NextRequest): Promise<NextResponse> {
  const { pathname, hostname, protocol } = request.nextUrl;

  // ── Skip static assets ──────────────────────────────────────────────────
  if (STATIC_PATHS_PATTERN.test(pathname)) {
    return NextResponse.next();
  }

  // ── Auth session refresh (non-blocking) ─────────────────────────────────
  const authResponse = await updateSession(request);

  // ── Subdomain extraction ────────────────────────────────────────────────
  const baseDomain = process.env.NEXT_PUBLIC_DOMAIN ?? 'toptenprom.com';
  const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1';

  let subdomain: string | null = null;

  if (!isLocalhost) {
    // Production: extract subdomain from hostname
    const hostWithoutPort = hostname.split(':')[0] ?? hostname;
    if (hostWithoutPort.endsWith(`.${baseDomain}`)) {
      subdomain = hostWithoutPort.replace(`.${baseDomain}`, '');
    }
  } else {
    // Development: extract subdomain from query param `?subdomain=xxx`
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

  // Propagate auth cookies from session refresh
  authResponse.cookies.getAll().forEach((cookie) => {
    rewriteResponse.cookies.set(cookie);
  });

  return rewriteResponse;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico, sitemap.xml, robots.txt
     */
    '/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)',
  ],
};
```

### 2.2 — `apps/brand-network-web/src/lib/supabase/middleware-helpers.ts`
```typescript
import { createServerClient } from '@supabase/ssr';
import { type NextRequest, NextResponse } from 'next/server';

export async function updateSession(request: NextRequest): Promise<NextResponse> {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Refresh the session — IMPORTANT: do not remove this
  await supabase.auth.getUser();

  return supabaseResponse;
}
```

### 2.3 — `apps/brand-network-web/src/lib/supabase/server.ts`
```typescript
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // The `setAll` method is called from a Server Component.
            // This can be ignored if you have middleware refreshing user sessions.
          }
        },
      },
    }
  );
}
```

### 2.4 — `apps/brand-network-web/src/lib/supabase/client.ts`
```typescript
import { createBrowserClient } from '@supabase/ssr';

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
```

### 2.5 — `apps/brand-network-web/src/lib/auth.ts`
```typescript
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { db } from '@toptenprom/database';
import { boutique_staff, users } from '@toptenprom/database';
import { eq } from 'drizzle-orm';

export type AuthUser = {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  role: 'super_admin' | 'owner' | 'manager' | 'stylist' | 'receptionist';
  tenant_id: string | null;
};

/**
 * `requireDashboardSession` — Server-side auth guard for all dashboard routes.
 *
 * ARCHITECTURE RULE: `redirect()` is called OUTSIDE the try/catch block.
 * Next.js `redirect()` throws `NEXT_REDIRECT` internally — if caught, it breaks.
 */
export async function requireDashboardSession(): Promise<AuthUser> {
  const supabase = await createClient();

  let userId: string | null = null;

  try {
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error || !user) {
      // Intentionally fall through to redirect below
    } else {
      userId = user.id;
    }
  } catch {
    // DB/auth error — fall through to redirect
  }

  // redirect() MUST be outside try/catch — it throws NEXT_REDIRECT internally
  if (!userId) {
    redirect('/login');
  }

  // Fetch staff record with role
  let authUser: AuthUser | null = null;

  try {
    const result = await db
      .select({
        id: users.id,
        email: users.email,
        first_name: users.first_name,
        last_name: users.last_name,
        role: boutique_staff.role,
        tenant_id: boutique_staff.tenant_id,
      })
      .from(users)
      .innerJoin(boutique_staff, eq(users.id, boutique_staff.user_id))
      .where(eq(users.id, userId))
      .limit(1);

    if (result.length > 0 && result[0]) {
      authUser = result[0] as AuthUser;
    }
  } catch {
    // DB error — fall through to redirect
  }

  // redirect() MUST be outside try/catch
  if (!authUser) {
    redirect('/login');
  }

  return authUser;
}
```

---

## [EXECUTION BLOCK 3: Full Design System Injection]

### 3.1 — `packages/ui-design-system/src/theme.ts`
```typescript
/**
 * Design token registry for the "Pearled Velvet Glass × Editorial Noir" system.
 * Import this in any package that needs programmatic access to design tokens.
 * The CSS variables are injected via globals.css — this file provides JS access.
 */
export const tokens = {
  colors: {
    bgNoir: '#0B0A0E',
    bgElevated: '#161420',
    bgSunken: '#070609',
    surfaceGlass: 'rgba(255, 255, 255, 0.03)',
    surfaceGlassMd: 'rgba(255, 255, 255, 0.06)',
    surfaceBorder: 'rgba(255, 255, 255, 0.08)',
    surfaceBorderMd: 'rgba(255, 255, 255, 0.14)',
    brandPrimary: '#F24B9A',
    brandSecondary: '#C9A96E',
    brandAccent: '#7B61FF',
    brandPrimaryGlow: 'rgba(242, 75, 154, 0.25)',
    textPrimary: '#F8F4F0',
    textSecondary: 'rgba(248, 244, 240, 0.60)',
    textTertiary: 'rgba(248, 244, 240, 0.35)',
    success: '#32D74B',
    warning: '#FFD60A',
    error: '#FF453A',
    info: '#0A84FF',
  },
  fonts: {
    display: "'Bodoni Moda', Georgia, serif",
    ui: "'Satoshi', 'DM Sans', sans-serif",
    mono: "'JetBrains Mono', 'Fira Code', monospace",
  },
  easing: {
    luxury: 'cubic-bezier(0.16, 1, 0.3, 1)',
    outExpo: 'cubic-bezier(0.19, 1, 0.22, 1)',
    inOutSilk: 'cubic-bezier(0.4, 0, 0.2, 1)',
    spring: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
  },
  radii: {
    sm: '8px',
    md: '12px',
    lg: '16px',
    xl: '24px',
    pill: '9999px',
  },
} as const;

export type DesignTokens = typeof tokens;
```

### 3.2 — `apps/brand-network-web/src/app/globals.css`
> **OVERWRITE COMPLETELY.** No Tailwind default classes (`bg-gray-900`, `text-white`, etc.) permitted in this file or any component.

```css
/* ══════════════════════════════════════════════════════════════════════════════
   PEARLED VELVET GLASS × EDITORIAL NOIR — Global Design System
   All components derive from these CSS variables. Zero hardcoded colors.
══════════════════════════════════════════════════════════════════════════════ */

@import url('https://fonts.googleapis.com/css2?family=Bodoni+Moda:ital,opsz,wght@0,6..96,400;0,6..96,500;0,6..96,600;0,6..96,700;1,6..96,400;1,6..96,600&display=swap');
@import url('https://api.fontshare.com/v2/css?f[]=satoshi@400,500,600,700&display=swap');

@tailwind base;
@tailwind components;
@tailwind utilities;

/* ── CSS CUSTOM PROPERTIES ───────────────────────────────────────────────── */
:root {
  /* Backgrounds */
  --color-bg-noir:          #0B0A0E;
  --color-bg-elevated:      #161420;
  --color-bg-sunken:        #070609;

  /* Glass Surfaces */
  --color-surface-glass:    rgba(255, 255, 255, 0.03);
  --color-surface-glass-md: rgba(255, 255, 255, 0.06);
  --color-surface-border:   rgba(255, 255, 255, 0.08);
  --color-surface-border-md:rgba(255, 255, 255, 0.14);

  /* Brand */
  --color-brand-primary:    #F24B9A;
  --color-brand-secondary:  #C9A96E;
  --color-brand-accent:     #7B61FF;
  --color-brand-primary-glow: rgba(242, 75, 154, 0.25);
  --color-brand-accent-glow: rgba(123, 97, 255, 0.20);

  /* Typography */
  --color-text-primary:     #F8F4F0;
  --color-text-secondary:   rgba(248, 244, 240, 0.60);
  --color-text-tertiary:    rgba(248, 244, 240, 0.35);
  --color-text-inverse:     #0B0A0E;

  /* Semantic */
  --color-success:          #32D74B;
  --color-warning:          #FFD60A;
  --color-error:            #FF453A;
  --color-info:             #0A84FF;

  /* Fonts */
  --font-display: 'Bodoni Moda', Georgia, serif;
  --font-ui:      'Satoshi', 'DM Sans', sans-serif;
  --font-mono:    'JetBrains Mono', 'Fira Code', monospace;

  /* Spacing / Layout */
  --radius-sm:   8px;
  --radius-md:   12px;
  --radius-lg:   16px;
  --radius-xl:   24px;
  --radius-pill: 9999px;

  --blur-sm:     4px;
  --blur-md:     12px;
  --blur-lg:     24px;
  --blur-xl:     48px;

  /* Motion */
  --ease-luxury:      cubic-bezier(0.16, 1, 0.3, 1);
  --ease-out-expo:    cubic-bezier(0.19, 1, 0.22, 1);
  --ease-in-out-silk: cubic-bezier(0.4, 0, 0.2, 1);
  --ease-spring:      cubic-bezier(0.34, 1.56, 0.64, 1);

  --duration-instant:    100ms;
  --duration-fast:       200ms;
  --duration-normal:     350ms;
  --duration-slow:       600ms;
  --duration-cinematic: 1200ms;
}

/* ── GLOBAL RESET & BASE ─────────────────────────────────────────────────── */
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

html {
  scroll-behavior: smooth;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  text-rendering: optimizeLegibility;
}

body {
  background-color: var(--color-bg-noir);
  color: var(--color-text-primary);
  font-family: var(--font-ui);
  font-size: 1rem;
  line-height: 1.5;
  min-height: 100dvh;
  overflow-x: hidden;
}

/* Prevent iOS Safari input zoom — ALL inputs must be >= 16px */
input, textarea, select {
  font-size: 1rem !important; /* 16px floor — mandatory for iOS Safari */
}

/* ── COMPONENT CLASSES ───────────────────────────────────────────────────── */

.glass-card {
  background: var(--color-surface-glass);
  border: 1px solid var(--color-surface-border);
  backdrop-filter: blur(var(--blur-md)) saturate(180%);
  -webkit-backdrop-filter: blur(var(--blur-md)) saturate(180%);
  border-radius: var(--radius-lg);
  transition:
    border-color var(--duration-fast) var(--ease-in-out-silk),
    background var(--duration-fast) var(--ease-in-out-silk),
    box-shadow var(--duration-fast) var(--ease-in-out-silk);
}

.glass-card:hover {
  background: var(--color-surface-glass-md);
  border-color: var(--color-surface-border-md);
  box-shadow: 0 8px 40px rgba(0, 0, 0, 0.40);
}

.bento-card {
  background: var(--color-surface-glass);
  border: 1px solid var(--color-surface-border);
  backdrop-filter: blur(var(--blur-md)) saturate(180%);
  -webkit-backdrop-filter: blur(var(--blur-md)) saturate(180%);
  border-radius: var(--radius-xl);
  padding: 1.5rem;
  position: relative;
  overflow: hidden;
  transition:
    border-color var(--duration-fast) var(--ease-in-out-silk),
    transform var(--duration-normal) var(--ease-luxury);
}

.bento-card::before {
  content: '';
  position: absolute;
  inset: 0;
  background: radial-gradient(
    ellipse at top left,
    rgba(242, 75, 154, 0.06) 0%,
    transparent 60%
  );
  pointer-events: none;
}

.bento-card:hover {
  border-color: var(--color-surface-border-md);
  transform: translateY(-2px);
}

.mesh-bg {
  background-color: var(--color-bg-noir);
  background-image:
    radial-gradient(ellipse 80% 60% at 20% 20%, rgba(242, 75, 154, 0.12) 0%, transparent 60%),
    radial-gradient(ellipse 60% 80% at 80% 80%, rgba(123, 97, 255, 0.10) 0%, transparent 60%),
    radial-gradient(ellipse 40% 40% at 50% 50%, rgba(201, 169, 110, 0.06) 0%, transparent 70%);
}

.noise-overlay::after {
  content: '';
  position: absolute;
  inset: 0;
  background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.04'/%3E%3C/svg%3E");
  pointer-events: none;
  border-radius: inherit;
}

/* ── BUTTON SYSTEM ───────────────────────────────────────────────────────── */

.btn-primary {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  background: var(--color-brand-primary);
  color: var(--color-text-inverse);
  font-family: var(--font-ui);
  font-size: 1rem;
  font-weight: 600;
  letter-spacing: 0.05em;
  padding: 0.75rem 2rem;
  border-radius: var(--radius-pill);
  border: none;
  cursor: pointer;
  text-decoration: none;
  transition:
    transform var(--duration-fast) var(--ease-spring),
    box-shadow var(--duration-fast) var(--ease-in-out-silk);
}

.btn-primary:hover {
  transform: scale(1.04);
  box-shadow: 0 0 32px var(--color-brand-primary-glow);
}

.btn-primary:active { transform: scale(0.97); }

.btn-primary:disabled,
.btn-primary[aria-disabled="true"] {
  opacity: 0.5;
  cursor: not-allowed;
  transform: none !important;
  box-shadow: none !important;
}

.btn-ghost {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  background: transparent;
  color: var(--color-text-primary);
  font-family: var(--font-ui);
  font-size: 1rem;
  font-weight: 500;
  letter-spacing: 0.05em;
  padding: 0.75rem 2rem;
  border-radius: var(--radius-pill);
  border: 1px solid var(--color-surface-border-md);
  cursor: pointer;
  text-decoration: none;
  transition:
    background var(--duration-fast) var(--ease-in-out-silk),
    border-color var(--duration-fast) var(--ease-in-out-silk),
    color var(--duration-fast) var(--ease-in-out-silk);
}

.btn-ghost:hover {
  background: var(--color-surface-glass-md);
  border-color: var(--color-brand-primary);
  color: var(--color-brand-primary);
}

.btn-gold {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  background: linear-gradient(135deg, var(--color-brand-secondary), #E8C97A);
  color: var(--color-text-inverse);
  font-family: var(--font-ui);
  font-size: 1rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  padding: 0.875rem 2.5rem;
  border-radius: var(--radius-pill);
  border: none;
  cursor: pointer;
  transition: transform var(--duration-fast) var(--ease-spring),
              box-shadow var(--duration-fast) var(--ease-in-out-silk);
}

.btn-gold:hover {
  transform: scale(1.04);
  box-shadow: 0 0 24px rgba(201, 169, 110, 0.35);
}

/* ── INPUT SYSTEM ────────────────────────────────────────────────────────── */

.input-luxury {
  background: var(--color-bg-sunken);
  border: 1px solid var(--color-surface-border);
  border-radius: var(--radius-md);
  color: var(--color-text-primary);
  font-family: var(--font-ui);
  font-size: 1rem; /* Mandatory 16px floor — iOS Safari zoom prevention */
  padding: 0.875rem 1rem;
  width: 100%;
  outline: none;
  transition:
    border-color var(--duration-fast) var(--ease-in-out-silk),
    box-shadow var(--duration-fast) var(--ease-in-out-silk);
}

.input-luxury:focus {
  border-color: var(--color-brand-primary);
  box-shadow: 0 0 0 3px var(--color-brand-primary-glow);
}

.input-luxury::placeholder {
  color: var(--color-text-tertiary);
}

/* ── FLOATING PILL NAVIGATION ────────────────────────────────────────────── */

.floating-pill-nav {
  position: fixed;
  top: 1.5rem;
  left: 50%;
  transform: translateX(-50%);
  z-index: 100;
  background: rgba(11, 10, 14, 0.85);
  border: 1px solid var(--color-surface-border);
  backdrop-filter: blur(var(--blur-md)) saturate(200%);
  -webkit-backdrop-filter: blur(var(--blur-md)) saturate(200%);
  border-radius: var(--radius-pill);
  padding: 0.625rem 1.5rem;
  display: flex;
  align-items: center;
  gap: 2.5rem;
  white-space: nowrap;
  transition: border-color var(--duration-fast) var(--ease-in-out-silk);
}

.floating-pill-nav:hover {
  border-color: var(--color-surface-border-md);
}

.nav-link {
  color: var(--color-text-secondary);
  font-family: var(--font-ui);
  font-size: 0.875rem;
  font-weight: 500;
  letter-spacing: 0.03em;
  text-decoration: none;
  transition: color var(--duration-fast) var(--ease-in-out-silk);
  position: relative;
}

.nav-link::after {
  content: '';
  position: absolute;
  bottom: -2px;
  left: 0;
  width: 0;
  height: 1px;
  background: var(--color-brand-primary);
  transition: width var(--duration-normal) var(--ease-luxury);
}

.nav-link:hover { color: var(--color-text-primary); }
.nav-link:hover::after { width: 100%; }
.nav-link.active { color: var(--color-brand-primary); }
.nav-link.active::after { width: 100%; }

/* ── PAGE TRANSITIONS ────────────────────────────────────────────────────── */

.page-enter {
  animation: pageEnter var(--duration-slow) var(--ease-out-expo) forwards;
}

@keyframes pageEnter {
  from { opacity: 0; transform: translateY(16px); }
  to   { opacity: 1; transform: translateY(0); }
}

.fade-in {
  animation: fadeIn var(--duration-normal) var(--ease-in-out-silk) forwards;
}

@keyframes fadeIn {
  from { opacity: 0; }
  to   { opacity: 1; }
}

.slide-up {
  animation: slideUp var(--duration-slow) var(--ease-luxury) forwards;
}

@keyframes slideUp {
  from { opacity: 0; transform: translateY(32px); }
  to   { opacity: 1; transform: translateY(0); }
}

/* ── TYPOGRAPHY UTILITIES ────────────────────────────────────────────────── */

.font-display { font-family: var(--font-display); }
.font-ui      { font-family: var(--font-ui); }
.font-mono    { font-family: var(--font-mono); }

.text-brand-primary   { color: var(--color-brand-primary); }
.text-brand-secondary { color: var(--color-brand-secondary); }
.text-brand-accent    { color: var(--color-brand-accent); }
.text-muted           { color: var(--color-text-secondary); }
.text-faint           { color: var(--color-text-tertiary); }

.heading-display {
  font-family: var(--font-display);
  font-weight: 700;
  line-height: 1.1;
  letter-spacing: -0.025em;
  color: var(--color-text-primary);
}

.heading-section {
  font-family: var(--font-display);
  font-weight: 600;
  line-height: 1.2;
  letter-spacing: -0.02em;
  color: var(--color-text-primary);
}

.label-luxury {
  font-family: var(--font-ui);
  font-size: 0.75rem;
  font-weight: 600;
  letter-spacing: 0.15em;
  text-transform: uppercase;
  color: var(--color-brand-secondary);
}

/* ── SCROLLBAR ───────────────────────────────────────────────────────────── */

::-webkit-scrollbar { width: 4px; height: 4px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: var(--color-surface-border-md); border-radius: 2px; }
::-webkit-scrollbar-thumb:hover { background: var(--color-brand-primary); }

/* ── SELECTION ───────────────────────────────────────────────────────────── */

::selection {
  background: var(--color-brand-primary-glow);
  color: var(--color-text-primary);
}
```

---

## [EXECUTION BLOCK 4: Root Layout & Global Navigation]

### 4.1 — `apps/brand-network-web/src/app/layout.tsx` (Root Layout)
```tsx
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
```

### 4.2 — `apps/brand-network-web/src/app/(corporate)/layout.tsx`
```tsx
import FloatingPillNav from '@/components/navigation/FloatingPillNav';
import Footer from '@/components/navigation/Footer';

export default function CorporateLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <FloatingPillNav />
      <main>{children}</main>
      <Footer />
    </>
  );
}
```

### 4.3 — `apps/brand-network-web/src/components/navigation/FloatingPillNav.tsx`
```tsx
'use client';

import Link from 'next/link';
import { useParams, usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';

const CORPORATE_LINKS = [
  { label: 'Find a Boutique', href: '/locator' },
  { label: 'Catalog', href: '/catalog' },
  { label: 'Virtual Try-On', href: '/try-on' },
  { label: 'Book', href: '/book' },
  { label: 'Journal', href: '/journal' },
] as const;

export default function FloatingPillNav() {
  const params = useParams();
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);

  // Tenant subdomain from dynamic route — scopes links to tenant context
  const subdomain = typeof params?.subdomain === 'string' ? params.subdomain : null;

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handler, { passive: true });
    return () => window.removeEventListener('scroll', handler);
  }, []);

  /**
   * Build href: if inside a tenant subdomain, prefix with /[subdomain]
   * to maintain tenant session context throughout navigation.
   */
  const buildHref = (href: string): string =>
    subdomain ? `/${subdomain}${href}` : href;

  return (
    <nav
      className="floating-pill-nav"
      style={{
        boxShadow: scrolled ? '0 8px 40px rgba(0,0,0,0.60)' : 'none',
        transition: 'box-shadow 0.3s ease',
      }}
      aria-label="Primary navigation"
    >
      {/* Brand Mark */}
      <Link
        href={subdomain ? `/${subdomain}` : '/home'}
        style={{
          fontFamily: 'var(--font-display)',
          fontSize: '1.125rem',
          fontWeight: 700,
          color: 'var(--color-brand-secondary)',
          textDecoration: 'none',
          letterSpacing: '-0.01em',
          marginRight: '0.5rem',
        }}
        aria-label="Top 10 Prom — Home"
      >
        TOP 10
      </Link>

      {/* Separator */}
      <span style={{
        width: '1px',
        height: '1.25rem',
        background: 'var(--color-surface-border-md)',
        display: 'block',
      }} aria-hidden="true" />

      {/* Navigation Links */}
      {CORPORATE_LINKS.map(({ label, href }) => {
        const builtHref = buildHref(href);
        const isActive = pathname === builtHref || pathname.startsWith(`${builtHref}/`);
        return (
          <Link
            key={href}
            href={builtHref}
            className={`nav-link ${isActive ? 'active' : ''}`}
          >
            {label}
          </Link>
        );
      })}

      {/* Auth CTA */}
      <Link href="/login" className="btn-primary" style={{ padding: '0.5rem 1.25rem', fontSize: '0.875rem' }}>
        Sign In
      </Link>
    </nav>
  );
}
```

### 4.4 — `apps/brand-network-web/src/components/navigation/Footer.tsx`
```tsx
import Link from 'next/link';

const FOOTER_LINKS = {
  Explore: [
    { label: 'Find a Boutique', href: '/locator' },
    { label: 'Prom Dresses', href: '/catalog?occasion=prom' },
    { label: 'Wedding Dresses', href: '/catalog?occasion=wedding' },
    { label: 'Virtual Try-On', href: '/try-on' },
    { label: 'Book Appointment', href: '/book' },
  ],
  Company: [
    { label: 'About Us', href: '/about' },
    { label: 'Journal', href: '/journal' },
    { label: 'Contact', href: '/contact' },
    { label: 'Careers', href: '/careers' },
  ],
  Legal: [
    { label: 'Privacy Policy', href: '/privacy' },
    { label: 'Terms of Service', href: '/terms' },
    { label: 'Accessibility', href: '/accessibility' },
  ],
} as const;

export default function Footer() {
  return (
    <footer
      style={{
        background: 'var(--color-bg-elevated)',
        borderTop: '1px solid var(--color-surface-border)',
        padding: '4rem 0 2rem',
        marginTop: 'auto',
      }}
    >
      <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 2rem' }}>
        {/* Top row */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '2fr 1fr 1fr 1fr',
          gap: '3rem',
          marginBottom: '3rem',
        }}>
          {/* Brand */}
          <div>
            <p className="heading-display" style={{ fontSize: '2rem', marginBottom: '1rem' }}>
              TOP 10 <span style={{ color: 'var(--color-brand-secondary)' }}>PROM</span>
            </p>
            <p className="text-muted" style={{ lineHeight: 1.7, maxWidth: '280px' }}>
              Discover your perfect look at one of our 55 luxury boutique locations across the network.
            </p>
            <p className="label-luxury" style={{ marginTop: '1.5rem' }}>
              AI-Powered Styling · Virtual Try-On
            </p>
          </div>

          {/* Link columns */}
          {Object.entries(FOOTER_LINKS).map(([category, links]) => (
            <div key={category}>
              <p className="label-luxury" style={{ marginBottom: '1rem' }}>{category}</p>
              <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
                {links.map(({ label, href }) => (
                  <li key={href}>
                    <Link
                      href={href}
                      style={{
                        color: 'var(--color-text-secondary)',
                        textDecoration: 'none',
                        fontSize: '0.875rem',
                        transition: 'color 0.2s ease',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--color-text-primary)')}
                      onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--color-text-secondary)')}
                    >
                      {label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom row */}
        <div style={{
          borderTop: '1px solid var(--color-surface-border)',
          paddingTop: '2rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <p style={{ color: 'var(--color-text-tertiary)', fontSize: '0.75rem' }}>
            © {new Date().getFullYear()} Top 10 Prom Network. All rights reserved.
          </p>
          <p style={{ color: 'var(--color-text-tertiary)', fontSize: '0.75rem' }}>
            55 Boutique Locations · AI-Powered Experience
          </p>
        </div>
      </div>
    </footer>
  );
}
```

### 4.5 — `apps/brand-network-web/src/app/[subdomain]/layout.tsx`
```tsx
import FloatingPillNav from '@/components/navigation/FloatingPillNav';
import Footer from '@/components/navigation/Footer';

interface SubdomainLayoutProps {
  children: React.ReactNode;
  params: Promise<{ subdomain: string }>; // MANDATORY: params is async in Next.js 16
}

export default async function SubdomainLayout({ children, params }: SubdomainLayoutProps) {
  const { subdomain } = await params; // MANDATORY: await params — sync access throws in Next.js 16

  return (
    <>
      <FloatingPillNav />
      <main data-subdomain={subdomain}>
        {children}
      </main>
      <Footer />
    </>
  );
}
```

---

## [VALIDATION CHECKPOINT — PHASE 2]

Execute in order. Each MUST achieve Exit Code 0.

```bash
# Typecheck the web app
pnpm --filter @toptenprom/brand-network-web typecheck

# Lint the web app
pnpm --filter @toptenprom/brand-network-web lint

# Verify proxy.ts exists and middleware.ts does NOT exist
ls apps/brand-network-web/src/proxy.ts      # Must exist
ls apps/brand-network-web/src/middleware.ts # Must NOT exist — if present, delete it
```

**Required Output:**
- Exit Code 0 on typecheck and lint
- `proxy.ts` exists with correct `export default function proxy()`
- `globals.css` contains all CSS custom properties from PHASE_MANIFEST.md
- No hardcoded color values (`#ffffff`, `#000000`, `bg-gray-900`, etc.) in any component
- `FloatingPillNav.tsx` uses `useParams()` for subdomain-aware routing
- All `params` accesses are `await`ed (zero synchronous param access)

**Update PHASE_MANIFEST.md:** Mark Phase 2 as ✅ COMPLETE.

**STOP. Await human approval before executing Phase 3.**
