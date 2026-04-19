# Phase 8: Production Deployment, CI/CD & Zero-Defect Pre-Flight

---

## [PRE-EXECUTION DIRECTIVE]
**MANDATORY FIRST ACTION:** Read `PHASE_MANIFEST.md` (Phase 0) in full. Verify ALL Phases 1–7 are marked ✅ COMPLETE before executing a single command in this phase.

**Role:** Principal Staff Engineer — DevOps & Release Engineering  
**Context:** Final pre-flight. Zero new feature code. Compile the entire ecosystem, validate environment integrity, and produce deployment-ready artifacts for Vercel and the iOS App Store.  
**Quality Standard:** Zero-defect CI/CD. A build that does not compile 100% cleanly is not released.  
**Execution Rules:**  
- Do NOT write new feature code. Fix only compilation errors.  
- `drizzle-kit check` is the correct command — NOT `drizzle-kit check:pg`.  
- All env vars MUST match the `ENV_MANIFEST` in PHASE_MANIFEST.md exactly.  
- OOM prevention: AI route handlers must have explicit memory limits.

---

## [EXECUTION BLOCK 1: Next.js / Vercel Compilation Readiness]

### 1.1 — `apps/brand-network-web/vercel.json`
```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "framework": "nextjs",
  "buildCommand": "pnpm build",
  "installCommand": "pnpm install --frozen-lockfile",
  "regions": ["iad1"],
  "functions": {
    "src/app/api/chat/route.ts": {
      "maxDuration": 30,
      "memory": 2048
    },
    "src/app/api/vto/initiate/route.ts": {
      "maxDuration": 30,
      "memory": 2048
    },
    "src/app/api/vto/webhook/route.ts": {
      "maxDuration": 30,
      "memory": 1024
    },
    "src/app/api/sync/route.ts": {
      "maxDuration": 30,
      "memory": 1024
    },
    "src/app/api/bookings/create/route.ts": {
      "maxDuration": 30,
      "memory": 512
    }
  },
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        { "key": "X-Frame-Options", "value": "DENY" },
        { "key": "X-Content-Type-Options", "value": "nosniff" },
        { "key": "X-XSS-Protection", "value": "1; mode=block" },
        { "key": "Referrer-Policy", "value": "strict-origin-when-cross-origin" },
        { "key": "Permissions-Policy", "value": "camera=(), microphone=(), geolocation=(self)" }
      ]
    },
    {
      "source": "/_next/static/(.*)",
      "headers": [
        { "key": "Cache-Control", "value": "public, max-age=31536000, immutable" }
      ]
    },
    {
      "source": "/fonts/(.*)",
      "headers": [
        { "key": "Cache-Control", "value": "public, max-age=31536000, immutable" }
      ]
    },
    {
      "source": "/videos/(.*)",
      "headers": [
        { "key": "Cache-Control", "value": "public, max-age=86400" }
      ]
    }
  ],
  "rewrites": [
    {
      "source": "/sitemap.xml",
      "destination": "/api/sitemap"
    }
  ]
}
```

### 1.2 — Verify `apps/brand-network-web/next.config.ts` is complete
Verify the following settings exist in `next.config.ts` from Phase 2. Patch any that are missing:

```typescript
// Required for Vercel deployment — verify these are present
const nextConfig: NextConfig = {
  reactCompiler: true,                      // ✅ stable in Next.js 16
  turbopack: { /* options */ },             // ✅ top-level, not experimental
  experimental: {
    typedRoutes: true,                      // ✅ compile-time route safety
    instrumentationHook: true,             // ✅ Vercel observability
  },
  images: {
    remotePatterns: [/* all patterns */],  // ✅ prevents UNCONFIGURED_HOST errors
  },
  logging: {
    browserToTerminal: 'error',            // ✅ Next.js 16.2 browser forwarding
  },
};
```

### 1.3 — Verify `apps/brand-network-web/src/app/api/bookings/create/route.ts` exists
If not created in Phase 4, create a minimal version now:
```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { db } from '@toptenprom/database';
import { appointments, customers, tenants } from '@toptenprom/database';
import { eq, and, sql } from 'drizzle-orm';
import crypto from 'crypto';

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: { locationId: string; serviceId: string; date: string; time: string };
  try {
    body = await request.json() as typeof body;
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const { locationId, serviceId, date, time } = body;

  if (!locationId || !serviceId || !date || !time) {
    return NextResponse.json({ error: 'All booking fields are required' }, { status: 400 });
  }

  // Get customer record
  let customerId: string | null = null;
  try {
    const result = await db.select({ id: customers.id }).from(customers).where(eq(customers.user_id, user.id)).limit(1);
    customerId = result[0]?.id ?? null;
  } catch {
    return NextResponse.json({ error: 'Customer profile not found' }, { status: 404 });
  }

  if (!customerId) {
    return NextResponse.json({ error: 'Please complete your customer profile first.' }, { status: 403 });
  }

  // Check tenant exists and is active
  let tenantExists = false;
  try {
    const tenantResult = await db.select({ id: tenants.id }).from(tenants).where(and(eq(tenants.id, locationId), eq(tenants.is_active, true))).limit(1);
    tenantExists = tenantResult.length > 0;
  } catch {
    return NextResponse.json({ error: 'Location lookup failed' }, { status: 500 });
  }

  if (!tenantExists) {
    return NextResponse.json({ error: 'Selected location is not available.', nearbyLocation: null }, { status: 409 });
  }

  // Create appointment
  const confirmationCode = `T10-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
  const appointmentDateTime = new Date(`${date}T${time.replace(' AM', '').replace(' PM', '')}`);

  try {
    await db.insert(appointments).values({
      tenant_id: locationId,
      customer_id: customerId,
      appointment_date: appointmentDateTime,
      duration_minutes: 90,
      service_type: serviceId,
      status: 'pending',
      confirmation_code: confirmationCode,
    });
  } catch (error) {
    console.error('[Booking Create] Failed:', error);
    return NextResponse.json({ error: 'Booking creation failed. Please try again.' }, { status: 500 });
  }

  return NextResponse.json({ confirmation_code: confirmationCode }, { status: 201 });
}
```

---

## [EXECUTION BLOCK 2: Environment Variable Final Audit]

### 2.1 — `.env.example` Completeness Check
Open `.env.example` at the workspace root. Verify EVERY key from this list is present, with a comment describing where to find it:

```bash
# ─── REQUIRED: All keys must be present in .env for the ecosystem to function ───

# DATABASE (Supabase Pooler — Transaction Mode, port 6543)
DATABASE_URL="postgresql://[user]:[password]@[host]:6543/[database]?pgbouncer=true"

# DATABASE (Supabase Direct — port 5432, for drizzle-kit migrations only)
DATABASE_URL_DIRECT="postgresql://[user]:[password]@[host]:5432/[database]"

# SUPABASE
NEXT_PUBLIC_SUPABASE_URL="https://[project-ref].supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="eyJ..."
SUPABASE_SERVICE_ROLE_KEY="eyJ..."       # NEVER expose to client — server only

# AUTH
NEXTAUTH_SECRET="[32+ character random string — generate with: openssl rand -base64 32]"

# AI / GENERATIVE
GOOGLE_GENERATIVE_AI_API_KEY="AIza..."   # Gemini 2.0 Flash — AI Stylist
FAL_KEY="..."                            # Fal.ai — VTO pipeline (flux-kontext-pro)

# MAPS
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY="AIza..." # Google Maps Locator Plus
GOOGLE_MAPS_SERVER_KEY="AIza..."          # Server-side geocoding & distance matrix

# RATE LIMITING (Upstash Redis)
UPSTASH_REDIS_REST_URL="https://..."
UPSTASH_REDIS_REST_TOKEN="..."

# DOMAIN
NEXT_PUBLIC_BASE_URL="https://toptenprom.com"   # Dev: http://localhost:3000
NEXT_PUBLIC_DOMAIN="toptenprom.com"             # Dev: localhost

# MOBILE SYNC
MOBILE_SYNC_API_SECRET="[64+ character random string — generate with: openssl rand -base64 48]"

# ANALYTICS
NEXT_PUBLIC_VERCEL_ANALYTICS_ID="..."   # From Vercel Dashboard > Project > Analytics
```

### 2.2 — Codebase sweep for undefined env vars
Run the following to catch any env var references not in `.env.example`:
```bash
# Grep all process.env references in the web app
grep -rn "process\.env\." apps/brand-network-web/src --include="*.ts" --include="*.tsx" | grep -v "node_modules" | awk -F'process.env.' '{print $2}' | awk -F'[^A-Z_]' '{print $1}' | sort | uniq

# Compare against .env.example keys
grep "^[A-Z]" .env.example | awk -F= '{print $1}' | sort

# Any reference in the first output NOT in the second output = missing from .env.example
```

---

## [EXECUTION BLOCK 3: Expo / EAS Mobile Deployment]

### 3.1 — `apps/mobile-instore-app/eas.json`
```json
{
  "cli": {
    "version": ">= 10.0.0",
    "appVersionSource": "remote"
  },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal",
      "env": {
        "EXPO_PUBLIC_API_URL": "http://localhost:3000",
        "EXPO_PUBLIC_MOBILE_SYNC_SECRET": "dev-secret-change-in-production"
      }
    },
    "preview": {
      "distribution": "internal",
      "ios": {
        "simulator": false,
        "buildConfiguration": "Release"
      },
      "android": {
        "buildType": "apk"
      },
      "env": {
        "EXPO_PUBLIC_API_URL": "https://staging.toptenprom.com"
      }
    },
    "production": {
      "distribution": "store",
      "ios": {
        "buildConfiguration": "Release",
        "autoIncrement": "buildNumber"
      },
      "android": {
        "buildType": "aab",
        "autoIncrement": "versionCode"
      },
      "env": {
        "EXPO_PUBLIC_API_URL": "https://toptenprom.com"
      }
    }
  },
  "submit": {
    "production": {
      "ios": {
        "appleId": "admin@toptenprom.com",
        "ascAppId": "[Your App Store Connect App ID]",
        "appleTeamId": "[Your Apple Team ID]"
      }
    }
  }
}
```

### 3.2 — `apps/mobile-instore-app/app.json` — Verify and patch
Verify these fields exist and have correct values. Patch any that are missing:

```json
{
  "expo": {
    "name": "Top 10 Prom In-Store",
    "slug": "toptenprom-instore",
    "version": "1.0.0",
    "orientation": "portrait",
    "icon": "./assets/icon.png",
    "userInterfaceStyle": "dark",
    "splash": {
      "image": "./assets/splash.png",
      "resizeMode": "contain",
      "backgroundColor": "#0B0A0E"
    },
    "ios": {
      "supportsTablet": true,
      "bundleIdentifier": "com.toptenprom.instore",
      "buildNumber": "1",
      "infoPlist": {
        "NSCameraUsageDescription": "Top 10 Prom needs camera access to capture customer photos for Virtual Try-On sessions.",
        "NSPhotoLibraryUsageDescription": "Top 10 Prom needs photo library access to upload customer photos for Virtual Try-On.",
        "NSLocalNetworkUsageDescription": "Top 10 Prom uses local network access to sync boutique data when connected to store Wi-Fi.",
        "ITSAppUsesNonExemptEncryption": false
      }
    },
    "android": {
      "adaptiveIcon": {
        "foregroundImage": "./assets/adaptive-icon.png",
        "backgroundColor": "#0B0A0E"
      },
      "package": "com.toptenprom.instore",
      "versionCode": 1,
      "permissions": [
        "android.permission.CAMERA",
        "android.permission.READ_EXTERNAL_STORAGE",
        "android.permission.WRITE_EXTERNAL_STORAGE",
        "android.permission.ACCESS_NETWORK_STATE",
        "android.permission.INTERNET"
      ]
    },
    "web": {
      "favicon": "./assets/favicon.png"
    },
    "plugins": [
      "expo-sqlite",
      [
        "expo-camera",
        {
          "cameraPermission": "Top 10 Prom needs camera access for Virtual Try-On photo capture."
        }
      ]
    ],
    "extra": {
      "eas": {
        "projectId": "[Your EAS Project ID]"
      }
    }
  }
}
```

---

## [EXECUTION BLOCK 4: Final Build Execution]

### 4.1 — Workspace-Wide Typecheck
```bash
# From workspace root
pnpm typecheck

# Expected: Zero TypeScript errors across all packages
```

### 4.2 — Workspace-Wide Lint
```bash
# From workspace root
pnpm lint

# Expected: Zero ESLint errors or warnings
```

### 4.3 — Database Schema Integrity
```bash
# CORRECT command — not drizzle-kit check:pg
pnpm --filter @toptenprom/database db:check

# Expected: "Everything is up to date"
```

### 4.4 — Production Build
```bash
# Next.js production build
pnpm --filter @toptenprom/brand-network-web build

# Expected output:
# ✓ Compiled successfully
# ✓ Linting and checking validity of types
# Route (app) output: all routes compiled
# ○ (Static)  prerendered as static content
# ƒ (Dynamic) server-rendered on demand
# No build errors
```

### 4.5 — Proxy Verification
```bash
# Verify proxy.ts exists and middleware.ts does NOT exist
ls apps/brand-network-web/src/proxy.ts && echo "✅ proxy.ts exists" || echo "❌ proxy.ts MISSING"
ls apps/brand-network-web/src/middleware.ts && echo "❌ middleware.ts found — DELETE IT" || echo "✅ middleware.ts correctly absent"
```

### 4.6 — Mobile Build Pre-Check
```bash
cd apps/mobile-instore-app

# Verify Expo doctor
npx expo-doctor

# Verify EAS CLI is installed
npx eas --version

# Run local TypeScript check
npx tsc --noEmit

# Verify schema file exists
ls src/db/schema.ts && echo "✅ WatermelonDB schema present"
```

---

## [EXECUTION BLOCK 5: Final Deployment Checklist]

### 5.1 — Vercel Deployment
```bash
# Install Vercel CLI if not present
npm install -g vercel@latest

# Link project (first time only)
cd apps/brand-network-web
vercel link

# Set environment variables in Vercel (run for each env var from .env.example)
vercel env add DATABASE_URL production
vercel env add DATABASE_URL_DIRECT production
vercel env add NEXT_PUBLIC_SUPABASE_URL production
vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY production
vercel env add SUPABASE_SERVICE_ROLE_KEY production
vercel env add NEXTAUTH_SECRET production
vercel env add GOOGLE_GENERATIVE_AI_API_KEY production
vercel env add FAL_KEY production
vercel env add NEXT_PUBLIC_GOOGLE_MAPS_API_KEY production
vercel env add GOOGLE_MAPS_SERVER_KEY production
vercel env add UPSTASH_REDIS_REST_URL production
vercel env add UPSTASH_REDIS_REST_TOKEN production
vercel env add NEXT_PUBLIC_BASE_URL production
vercel env add NEXT_PUBLIC_DOMAIN production
vercel env add MOBILE_SYNC_API_SECRET production
vercel env add NEXT_PUBLIC_VERCEL_ANALYTICS_ID production

# Deploy to production
vercel --prod
```

### 5.2 — Supabase Post-Deploy Steps
```bash
# 1. Run RLS migrations
pnpm --filter @toptenprom/database db:push

# 2. Run seed script (idempotent — safe to run)
pnpm --filter @toptenprom/database db:seed

# 3. Verify in Supabase Dashboard:
#    - Table Editor: confirm all 11 tables exist with correct columns
#    - Auth > Users: manually create test staff users matching seed user IDs
#    - Storage: create 'vto-images' bucket with public access
#    - Realtime: enable for all synced tables (appointments, walk_ins)
```

### 5.3 — Wildcard Domain Configuration
In Vercel Dashboard > Project > Domains:
```
Add: toptenprom.com
Add: *.toptenprom.com       ← Wildcard subdomain for all 55 boutiques
```

In DNS Provider:
```
A    @           76.76.21.21      (Vercel IP)
A    *           76.76.21.21      (Wildcard — points all subdomains to Vercel)
```

### 5.4 — Mobile: Submit to TestFlight
```bash
cd apps/mobile-instore-app

# Build for TestFlight (preview profile)
npx eas build --profile preview --platform ios

# Submit to TestFlight
npx eas submit --profile production --platform ios
```

---

## [FINAL VALIDATION CHECKLIST]

Print the following checklist to terminal before marking deployment complete:

```
═══════════════════════════════════════════════════════════════════
  TOP 10 PROM ECOSYSTEM — PRODUCTION DEPLOYMENT CHECKLIST
═══════════════════════════════════════════════════════════════════

PHASE COMPLETION
  [✅] Phase 0: PHASE_MANIFEST.md authored and locked
  [✅] Phase 1: Database schema + RLS policies applied
  [✅] Phase 2: proxy.ts (NOT middleware.ts) + design system
  [✅] Phase 3: Dashboard + role routing + error boundary
  [✅] Phase 4: AI Stylist + VTO + Locator + Booking
  [✅] Phase 5: Tenant storefronts + WatermelonDB mobile
  [✅] Phase 6: Schema audit + seed data hydrated
  [✅] Phase 7: All pages built + routing verified
  [✅] Phase 8: Production build + deployment

ARCHITECTURE INTEGRITY
  [  ] proxy.ts exists — middleware.ts does NOT exist
  [  ] All params are await-ed — zero sync access
  [  ] Turbopack config at top-level (not experimental)
  [  ] 'use cache' directives on all cached RSCs
  [  ] All inputs have font-size ≥ 16px (iOS zoom prevention)
  [  ] VTO uses Supabase Realtime (not Vercel WebSockets)
  [  ] VTO provider: fal-ai/flux-kontext-pro
  [  ] Walk-in table: walk_ins (not availability_inquiries)
  [  ] Tenant table: tenants (not boutiques)
  [  ] boutique_staff.role has no 'customer' value
  [  ] drizzle-kit check (not check:pg) passes
  [  ] redirect() is outside all try/catch blocks

DESIGN SYSTEM
  [  ] All colors via CSS custom properties (zero hardcoded)
  [  ] Catalog color filters use photography (zero CSS swatches)
  [  ] Bodoni Moda on all display headings
  [  ] Satoshi on all UI/body text
  [  ] --ease-luxury on all transitions
  [  ] Mobile nav is horizontal-scroll (not vertical overflow)
  [  ] .glass-card, .bento-card, .mesh-bg used throughout

SECURITY
  [  ] Admin gate /gate has Upstash rate limiting (5 req / 10 min)
  [  ] SUPABASE_SERVICE_ROLE_KEY never in client code
  [  ] /api/sync validates MOBILE_SYNC_API_SECRET header
  [  ] RLS policies applied to vto_sessions, client_style_profiles
  [  ] Security headers in vercel.json

DEPLOYMENT
  [  ] Vercel: all 16 env vars set for production
  [  ] Vercel: wildcard domain *.toptenprom.com configured
  [  ] Supabase: vto-images storage bucket public
  [  ] Supabase: Realtime enabled on appointments, walk_ins
  [  ] Supabase: 4 test staff users created matching seed IDs
  [  ] iOS: com.toptenprom.instore bundle ID set
  [  ] iOS: Camera + Photo Library permissions in app.json
  [  ] EAS: development, preview, production profiles configured

PERFORMANCE
  [  ] /api/chat memory: 2048MB (OOM prevention)
  [  ] /api/vto/initiate memory: 2048MB
  [  ] /_next/static: Cache-Control max-age=31536000 immutable
  [  ] Images: next/image with proper sizes prop on all instances
  [  ] Video splash: compressed mp4 + webm formats present

═══════════════════════════════════════════════════════════════════
  Ecosystem Status: READY FOR PRODUCTION
  Quality Level: Institutional Grade — Apple / LVMH Standard
  Build Date: $(date)
═══════════════════════════════════════════════════════════════════
```

**Update PHASE_MANIFEST.md:** Mark Phase 8 as ✅ COMPLETE.

**The Top 10 Prom Ecosystem is now production-ready.**
