# Phase 0: Project Constitution, Design System Anchor & Environment Manifest
> **READ THIS FILE AT THE START OF EVERY PHASE. IT IS THE SINGLE SOURCE OF TRUTH.**
> All phase agents MUST reference this document before writing a single line of code.

---

## [PROJECT IDENTITY]

**Ecosystem Name:** `toptenprom-ecosystem`  
**Package Namespace:** `@toptenprom`  
**Domain Pattern:** `toptenprom.com` (corporate) | `[subdomain].toptenprom.com` (boutiques)  
**Network Scale:** 55 boutique locations (multi-tenant SaaS)  
**Target Runtime:** Next.js 16.2.4 (App Router) | Expo SDK 52 (React Native)  
**Quality Standard:** Institutional Grade — Apple / LVMH rigor. Zero placeholders. Zero `// TODO`. Zero implicit `any` types.

---

## [CANONICAL FILE STRUCTURE]

```
toptenprom-ecosystem/
├── apps/
│   ├── brand-network-web/          # Next.js 16.2.4 web app
│   └── mobile-instore-app/         # Expo SDK 52 React Native app
├── packages/
│   ├── database/                   # Drizzle ORM — single source of truth schema
│   ├── typescript-config/          # Shared tsconfig bases
│   ├── eslint-config/              # Shared ESLint rules
│   └── ui-design-system/           # Shared Tailwind v4 theme + tokens
├── PHASE_MANIFEST.md               # This file
├── ENV_MANIFEST.md                 # All env vars (generated in Phase 1)
├── pnpm-workspace.yaml
└── turbo.json
```

---

## [CANONICAL DATABASE TABLE NAMES]
> These names are LOCKED. Every phase, every file, every seed, every server action MUST use these exact names. No aliases, no synonyms.

| Schema Table | Purpose |
|---|---|
| `tenants` | Core multi-tenant registry (NOT "boutiques") |
| `users` | Global Supabase Auth mirror |
| `boutique_staff` | Staff roles only — NO customer role in this table |
| `customers` | Separate customer identity table |
| `dresses` | Global dress catalog |
| `dress_inventory` | Per-tenant stock ledger |
| `appointments` | Cross-location booking |
| `walk_ins` | Kiosk queue (NOT "availability_inquiries") |
| `availability_inquiries` | DOES NOT EXIST — use `walk_ins` |
| `vto_sessions` | Virtual Try-On diffusion metadata |
| `client_style_profiles` | RAG preference vectors |
| `dress_reservations` | Prom registry |

**`boutique_staff` role enum:** `'super_admin' | 'owner' | 'manager' | 'stylist' | 'receptionist'`  
**Customer auth lives on:** `users` + `customers` tables only. Never `boutique_staff`.

---

## [ENVIRONMENT VARIABLE MANIFEST]
> Every variable listed below MUST exist in `.env.example` at workspace root after Phase 1.
> Every phase agent MUST reference this list when importing env vars. No invented key names.

```bash
# ── DATABASE (Supabase) ──────────────────────────────────────────
DATABASE_URL="postgresql://..."                    # Supabase Pooler (Transaction mode, port 6543)
DATABASE_URL_DIRECT="postgresql://..."             # Supabase Direct (port 5432, for migrations)
NEXT_PUBLIC_SUPABASE_URL="https://xxx.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="eyJ..."
SUPABASE_SERVICE_ROLE_KEY="eyJ..."                 # Server-only, never exposed to client

# ── AUTHENTICATION ───────────────────────────────────────────────
NEXTAUTH_SECRET="..."                              # 32-char random string

# ── AI / GENERATIVE ─────────────────────────────────────────────
GOOGLE_GENERATIVE_AI_API_KEY="AIza..."             # Gemini Pro — AI Stylist RAG
FAL_KEY="..."                                      # Fal.ai — VTO diffusion pipeline (flux-kontext-pro)

# ── MAPS ────────────────────────────────────────────────────────
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY="AIza..."          # Google Maps Locator Plus
GOOGLE_MAPS_SERVER_KEY="AIza..."                   # Server-side geocoding

# ── RATE LIMITING ────────────────────────────────────────────────
UPSTASH_REDIS_REST_URL="https://..."               # Upstash Redis — admin gate rate limiting
UPSTASH_REDIS_REST_TOKEN="..."

# ── DOMAIN & ROUTING ────────────────────────────────────────────
NEXT_PUBLIC_BASE_URL="https://toptenprom.com"
NEXT_PUBLIC_DOMAIN="toptenprom.com"

# ── MOBILE SYNC API ─────────────────────────────────────────────
MOBILE_SYNC_API_SECRET="..."                       # 64-char secret for WatermelonDB sync endpoint

# ── ANALYTICS ───────────────────────────────────────────────────
NEXT_PUBLIC_VERCEL_ANALYTICS_ID="..."              # Vercel Web Analytics
```

---

## [DESIGN SYSTEM: "PEARLED VELVET GLASS × EDITORIAL NOIR"]
> The complete design token specification. Every component in every phase MUST derive from these tokens. Hardcoded color values are a build-failure condition.

### Color Tokens
```css
/* ── BACKGROUNDS ──────────────────────────────────────── */
--color-bg-noir:          #0B0A0E;    /* Page root — near-black */
--color-bg-elevated:      #161420;    /* Cards, panels */
--color-bg-sunken:        #070609;    /* Input fills, inset surfaces */

/* ── GLASS SURFACES ────────────────────────────────────── */
--color-surface-glass:    rgba(255, 255, 255, 0.03);   /* Base glass fill */
--color-surface-glass-md: rgba(255, 255, 255, 0.06);   /* Hover / active glass */
--color-surface-border:   rgba(255, 255, 255, 0.08);   /* Glass card borders */
--color-surface-border-md:rgba(255, 255, 255, 0.14);   /* Focus borders */

/* ── BRAND ──────────────────────────────────────────────── */
--color-brand-primary:    #F24B9A;    /* Petal Rose — CTAs, active states */
--color-brand-secondary:  #C9A96E;    /* Champagne Gold — accents, labels */
--color-brand-accent:     #7B61FF;    /* Iris Purple — VTO, AI features */
--color-brand-primary-glow: rgba(242, 75, 154, 0.25);  /* Glow/shadow for primary */

/* ── TYPOGRAPHY ─────────────────────────────────────────── */
--color-text-primary:     #F8F4F0;    /* Ivory — headings, body */
--color-text-secondary:   rgba(248, 244, 240, 0.60);   /* Captions, metadata */
--color-text-tertiary:    rgba(248, 244, 240, 0.35);    /* Placeholders, disabled */
--color-text-inverse:     #0B0A0E;    /* On light surfaces */

/* ── SEMANTIC ───────────────────────────────────────────── */
--color-success:          #32D74B;
--color-warning:          #FFD60A;
--color-error:            #FF453A;
--color-info:             #0A84FF;
```

### Typography Scale
```css
/* ── FONT FAMILIES ─────────────────────────────────────── */
--font-display: 'Bodoni Moda', Georgia, serif;        /* Hero titles, editorial headers */
--font-ui:      'Satoshi', 'DM Sans', sans-serif;     /* Navigation, labels, body text */
--font-mono:    'JetBrains Mono', 'Fira Code', monospace; /* Data, codes */

/* ── TYPE SCALE ─────────────────────────────────────────── */
--text-xs:   0.75rem;   /* 12px — metadata, badges */
--text-sm:   0.875rem;  /* 14px — captions, secondary UI */
--text-base: 1rem;      /* 16px — body, inputs (iOS zoom floor) */
--text-lg:   1.125rem;  /* 18px */
--text-xl:   1.25rem;   /* 20px */
--text-2xl:  1.5rem;    /* 24px */
--text-3xl:  1.875rem;  /* 30px */
--text-4xl:  2.25rem;   /* 36px */
--text-5xl:  3rem;      /* 48px — section titles */
--text-6xl:  3.75rem;   /* 60px */
--text-7xl:  4.5rem;    /* 72px — hero displays */
--text-8xl:  6rem;      /* 96px — cinematic splash */

/* ── LETTER SPACING ─────────────────────────────────────── */
--tracking-tight:   -0.025em;
--tracking-normal:   0em;
--tracking-wide:     0.05em;
--tracking-widest:   0.15em;  /* Brand labels, ALL CAPS UI */

/* ── LINE HEIGHT ────────────────────────────────────────── */
--leading-tight:   1.1;   /* Display headings */
--leading-snug:    1.3;   /* Subheadings */
--leading-normal:  1.5;   /* Body */
--leading-relaxed: 1.7;   /* Editorial prose */
```

### Motion & Easing
```css
/* ── EASING CURVES ──────────────────────────────────────── */
--ease-luxury:      cubic-bezier(0.16, 1, 0.3, 1);     /* Primary — spring-like */
--ease-out-expo:    cubic-bezier(0.19, 1, 0.22, 1);    /* Page entries */
--ease-in-out-silk: cubic-bezier(0.4, 0, 0.2, 1);     /* Hover states */
--ease-spring:      cubic-bezier(0.34, 1.56, 0.64, 1); /* Micro-interactions */

/* ── DURATION ───────────────────────────────────────────── */
--duration-instant: 100ms;   /* Immediate feedback */
--duration-fast:    200ms;   /* Hover, focus */
--duration-normal:  350ms;   /* Most transitions */
--duration-slow:    600ms;   /* Page transitions, entrances */
--duration-cinematic: 1200ms; /* Splash, cinematic reveals */
```

### Spacing & Layout
```css
--radius-sm:   8px;
--radius-md:   12px;
--radius-lg:   16px;   /* Standard card radius */
--radius-xl:   24px;   /* Large panels */
--radius-pill: 9999px; /* Navigation pills, badges */

--blur-sm:     4px;
--blur-md:     12px;   /* Standard glass blur */
--blur-lg:     24px;   /* Hero overlays */
--blur-xl:     48px;   /* Backdrop hero */
```

### Component Classes (CSS)
```css
/* ── GLASS CARD ──────────────────────────────────────────── */
.glass-card {
  background: var(--color-surface-glass);
  border: 1px solid var(--color-surface-border);
  backdrop-filter: blur(var(--blur-md));
  -webkit-backdrop-filter: blur(var(--blur-md));
  border-radius: var(--radius-lg);
  transition: border-color var(--duration-fast) var(--ease-in-out-silk),
              background var(--duration-fast) var(--ease-in-out-silk);
}
.glass-card:hover {
  background: var(--color-surface-glass-md);
  border-color: var(--color-surface-border-md);
}

/* ── BENTO CARD (analytics / dashboard) ─────────────────── */
.bento-card {
  background: var(--color-surface-glass);
  border: 1px solid var(--color-surface-border);
  backdrop-filter: blur(var(--blur-md));
  -webkit-backdrop-filter: blur(var(--blur-md));
  border-radius: var(--radius-xl);
  padding: 1.5rem;
  position: relative;
  overflow: hidden;
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

/* ── MESH BACKGROUND ─────────────────────────────────────── */
.mesh-bg {
  background-color: var(--color-bg-noir);
  background-image:
    radial-gradient(ellipse 80% 60% at 20% 20%, rgba(242, 75, 154, 0.12) 0%, transparent 60%),
    radial-gradient(ellipse 60% 80% at 80% 80%, rgba(123, 97, 255, 0.10) 0%, transparent 60%),
    radial-gradient(ellipse 40% 40% at 50% 50%, rgba(201, 169, 110, 0.06) 0%, transparent 70%);
}

/* ── PRIMARY BUTTON ──────────────────────────────────────── */
.btn-primary {
  background: var(--color-brand-primary);
  color: var(--color-text-inverse);
  font-family: var(--font-ui);
  font-size: var(--text-base);
  font-weight: 600;
  letter-spacing: var(--tracking-wide);
  padding: 0.75rem 2rem;
  border-radius: var(--radius-pill);
  border: none;
  cursor: pointer;
  transition: transform var(--duration-fast) var(--ease-spring),
              box-shadow var(--duration-fast) var(--ease-in-out-silk);
  box-shadow: 0 0 0 0 var(--color-brand-primary-glow);
}
.btn-primary:hover {
  transform: scale(1.04);
  box-shadow: 0 0 32px 0 var(--color-brand-primary-glow);
}
.btn-primary:active { transform: scale(0.97); }
.btn-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  transform: none;
  box-shadow: none;
}

/* ── GHOST BUTTON ────────────────────────────────────────── */
.btn-ghost {
  background: transparent;
  color: var(--color-text-primary);
  font-family: var(--font-ui);
  font-size: var(--text-base);
  font-weight: 500;
  letter-spacing: var(--tracking-wide);
  padding: 0.75rem 2rem;
  border-radius: var(--radius-pill);
  border: 1px solid var(--color-surface-border-md);
  cursor: pointer;
  transition: background var(--duration-fast) var(--ease-in-out-silk),
              border-color var(--duration-fast) var(--ease-in-out-silk);
}
.btn-ghost:hover {
  background: var(--color-surface-glass-md);
  border-color: var(--color-brand-primary);
}

/* ── LUXURY INPUT ────────────────────────────────────────── */
.input-luxury {
  background: var(--color-bg-sunken);
  border: 1px solid var(--color-surface-border);
  border-radius: var(--radius-md);
  color: var(--color-text-primary);
  font-family: var(--font-ui);
  font-size: var(--text-base); /* MANDATORY: prevents iOS Safari zoom */
  padding: 0.875rem 1rem;
  width: 100%;
  outline: none;
  transition: border-color var(--duration-fast) var(--ease-in-out-silk),
              box-shadow var(--duration-fast) var(--ease-in-out-silk);
}
.input-luxury:focus {
  border-color: var(--color-brand-primary);
  box-shadow: 0 0 0 3px var(--color-brand-primary-glow);
}
.input-luxury::placeholder { color: var(--color-text-tertiary); }

/* ── FLOATING PILL NAV ───────────────────────────────────── */
.floating-pill-nav {
  position: fixed;
  top: 1.5rem;
  left: 50%;
  transform: translateX(-50%);
  z-index: 100;
  background: rgba(11, 10, 14, 0.80);
  border: 1px solid var(--color-surface-border);
  backdrop-filter: blur(var(--blur-md));
  -webkit-backdrop-filter: blur(var(--blur-md));
  border-radius: var(--radius-pill);
  padding: 0.5rem 1.5rem;
  display: flex;
  align-items: center;
  gap: 2rem;
  white-space: nowrap;
}

/* ── PAGE TRANSITION ─────────────────────────────────────── */
.page-enter {
  animation: pageEnter var(--duration-slow) var(--ease-out-expo) forwards;
}
@keyframes pageEnter {
  from { opacity: 0; transform: translateY(12px); }
  to   { opacity: 1; transform: translateY(0); }
}
```

---

## [THIRD-PARTY SERVICE REGISTRY]

| Service | Purpose | SDK / Package | Env Key |
|---|---|---|---|
| Supabase | Auth + PostgreSQL + Realtime | `@supabase/ssr` | `NEXT_PUBLIC_SUPABASE_*` |
| Drizzle ORM | Type-safe DB queries | `drizzle-orm`, `drizzle-kit` | `DATABASE_URL` |
| Fal.ai | VTO diffusion (flux-kontext-pro) | `@fal-ai/client` | `FAL_KEY` |
| Google Gemini | AI Stylist RAG | `@ai-sdk/google` | `GOOGLE_GENERATIVE_AI_API_KEY` |
| Google Maps | Locator Plus | `@googlemaps/js-api-loader` | `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` |
| Upstash Redis | Rate limiting (admin gate) | `@upstash/ratelimit`, `@upstash/redis` | `UPSTASH_REDIS_*` |
| WatermelonDB | Mobile offline sync | `@nozbe/watermelondb` | — |
| Vercel Analytics | Web telemetry | `@vercel/analytics` | `NEXT_PUBLIC_VERCEL_ANALYTICS_ID` |

---

## [PHASE COMPLETION REGISTRY]
> Each phase agent MUST update this section upon successful validation checkpoint completion.

| Phase | Title | Status | Completed By |
|---|---|---|---|
| 0 | Manifest & Constitution | ✅ LOCKED | Human Author |
| 1 | Monorepo Foundation & Data Layer | ✅ COMPLETE | Antigravity AI |
| 2 | Next.js Architecture & Design System | ✅ COMPLETE | Antigravity AI |
| 3 | Enterprise Dashboard | ✅ COMPLETE | Antigravity AI |
| 4 | AI Integrations & Consumer Gateways | ✅ COMPLETE | Antigravity AI |
| 5 | Tenant Storefronts & Offline Sync | ✅ COMPLETE | Antigravity AI |
| 6 | Schema Alignment & Data Hydration | ⬜ PENDING | — |
| 7 | Cinematic Brand Imprint & Routing | ⬜ PENDING | — |
| 8 | Production Deployment & CI/CD | ⬜ PENDING | — |

---

## [CRITICAL NEXT.JS 16.2.4 BREAKING CHANGE REGISTRY]
> Every phase agent MUST internalize these before touching any Next.js code.

1. **`proxy.ts` replaces `middleware.ts`** — `middleware.ts` is deprecated. Use `proxy.ts` with `export default function proxy(request: NextRequest)`. Node.js runtime only. Edge runtime → keep `middleware.ts` but acknowledge deprecation.
2. **Async params & searchParams are MANDATORY** — `params` and `searchParams` in `page.tsx`, `layout.tsx`, `route.ts` MUST be awaited: `const { slug } = await props.params`. Synchronous access throws at runtime.
3. **Turbopack config is top-level** — `next.config.ts` uses `turbopack: {}` at root, NOT `experimental.turbopack`.
4. **`'use cache'` directive** — Cache Components use `'use cache'` at function/component level. No `cacheComponents: true` config flag.
5. **React 19.2 is bundled** — Use `View Transitions`, `Activity`, `useEffectEvent` from React 19.2 where appropriate.
6. **React Compiler is stable** — Enable via `reactCompiler: true` in `next.config.ts` for automatic memoization.
7. **Turbopack is default** — `next dev` and `next build` use Turbopack by default. `--turbopack` flag is no longer needed.
