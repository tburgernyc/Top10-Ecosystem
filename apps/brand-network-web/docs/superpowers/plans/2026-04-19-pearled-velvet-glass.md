# Pearled Velvet Glass Token Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate all CSS design tokens to the definitive "Pearled Velvet Glass" schema — renaming 7 tokens, updating 3 values, adding 2 new tokens, fixing Bodoni Moda font weights, and cascading all renames to 41 component files.

**Architecture:** All changes are in `globals.css` (CSS variables + utility classes) and 41 `.tsx` component files (inline `var()` string replacements). No logic changes, no new files, no new dependencies. Tailwind v4 CSS-first config — there is no `tailwind.config.ts`.

**Tech Stack:** Next.js (App Router), Tailwind CSS v4, CSS custom properties

---

## File Map

| File | Change |
|---|---|
| `src/app/globals.css` | `:root` token renames + value updates + new tokens + `var()` reference updates + font weight corrections |
| `src/app/(admin)/gate/GateLoginForm.tsx` | Token rename cascade |
| `src/app/(auth)/login/LoginForm.tsx` | Token rename cascade |
| `src/app/(auth)/login/page.tsx` | Token rename cascade |
| `src/app/(corporate)/about/page.tsx` | Token rename cascade |
| `src/app/(corporate)/book/BookingWizard.tsx` | Token rename cascade |
| `src/app/(corporate)/catalog/CatalogGrid.tsx` | Token rename cascade |
| `src/app/(corporate)/catalog/page.tsx` | Token rename cascade |
| `src/app/(corporate)/contact/page.tsx` | Token rename cascade |
| `src/app/(corporate)/home/page.tsx` | Token rename cascade |
| `src/app/(corporate)/journal/page.tsx` | Token rename cascade |
| `src/app/(corporate)/locator/LocatorMap.tsx` | Token rename cascade |
| `src/app/(corporate)/locator/page.tsx` | Token rename cascade |
| `src/app/(corporate)/try-on/page.tsx` | Token rename cascade |
| `src/app/(corporate)/try-on/TryOnForm.tsx` | Token rename cascade |
| `src/app/(main)/dashboard/analytics/NetworkKPICards.tsx` | Token rename cascade |
| `src/app/(main)/dashboard/analytics/TenantKPITable.tsx` | Token rename cascade |
| `src/app/(main)/dashboard/bridal-party/BridalPartyClient.tsx` | Token rename cascade |
| `src/app/(main)/dashboard/bridal-party/page.tsx` | Token rename cascade |
| `src/app/(main)/dashboard/error.tsx` | Token rename cascade |
| `src/app/(main)/dashboard/franchise/FranchiseOnboardingForm.tsx` | Token rename cascade |
| `src/app/(main)/dashboard/franchise/page.tsx` | Token rename cascade |
| `src/app/(main)/dashboard/layout.tsx` | Token rename cascade |
| `src/app/(main)/dashboard/owner/page.tsx` | Token rename cascade |
| `src/app/(public)/guardian-portal/[tokenId]/page.tsx` | Token rename cascade |
| `src/app/(public)/vote/[token]/page.tsx` | Token rename cascade |
| `src/app/(public)/vote/[token]/VoteClient.tsx` | Token rename cascade |
| `src/app/page.tsx` | Token rename cascade |
| `src/app/[subdomain]/error.tsx` | Token rename cascade |
| `src/app/[subdomain]/not-found.tsx` | Token rename cascade |
| `src/app/[subdomain]/page.tsx` | Token rename cascade |
| `src/components/ai/AIStylistBot.tsx` | Token rename cascade |
| `src/components/dashboard/AppointmentList.tsx` | Token rename cascade |
| `src/components/dashboard/AssociateTaskView.tsx` | Token rename cascade |
| `src/components/dashboard/ChartSkeleton.tsx` | Token rename cascade |
| `src/components/dashboard/ClientProfile.tsx` | Token rename cascade |
| `src/components/dashboard/DashboardNav.tsx` | Token rename cascade |
| `src/components/dashboard/StylistUtilizationChart.tsx` | Token rename cascade |
| `src/components/dashboard/WalkInQueue.tsx` | Token rename cascade |
| `src/components/navigation/BackButton.tsx` | Token rename cascade |
| `src/components/navigation/FloatingPillNav.tsx` | Token rename cascade |
| `src/components/navigation/Footer.tsx` | Token rename cascade |

---

## Token Rename Reference (used across all tasks)

| Old name | New name | Value change |
|---|---|---|
| `--color-bg-noir` | `--color-bg` | None |
| `--color-surface-glass` | `--color-bg-glass` | `0.03` → `0.04` |
| `--color-brand-primary` | `--color-primary` | None |
| `--color-brand-primary-glow` | `--color-primary-glow` | `0.25` → `0.22` |
| `--color-text-primary` | `--color-text` | `#F8F4F0` → `#FFFFFF` |
| `--color-text-secondary` | `--color-text-muted` | warm-alpha → `#A1A1AA` |
| `--color-surface-border` | `--color-border` | None |

**NOT renamed** (keep as-is): `--color-surface-glass-md`, `--color-surface-border-md`, `--color-brand-secondary`, `--color-brand-accent`, `--color-brand-accent-glow`, `--color-text-tertiary`, `--color-text-inverse`, `--color-bg-sunken`, `--color-warning`, `--color-info`

---

## Task 1: Update `:root` Token Definitions in `globals.css`

**Files:** Modify `src/app/globals.css` lines 12–71

- [ ] **Step 1: Verify old tokens exist in `:root`**

  Run from `apps/brand-network-web/`:
  ```bash
  grep -n "color-bg-noir\|color-surface-glass:\|color-brand-primary:\|color-text-primary:\|color-text-secondary:\|color-surface-border:\|color-brand-primary-glow" src/app/globals.css
  ```
  Expected: lines 14, 19, 21, 25, 28, 32, 33 all show old token names.

- [ ] **Step 2: Replace the entire `:root` block**

  Open `src/app/globals.css`. Replace the full `:root { ... }` block (lines 12–71) with:

  ```css
  :root {
    /* Backgrounds */
    --color-bg:               #0B0A0E;
    --color-bg-elevated:      #16151A;
    --color-bg-sunken:        #070609;

    /* Glass Surfaces */
    --color-bg-glass:         rgba(255, 255, 255, 0.04);
    --color-surface-glass-md: rgba(255, 255, 255, 0.06);
    --color-border:           rgba(255, 255, 255, 0.08);
    --color-surface-border-md:rgba(255, 255, 255, 0.14);

    /* Brand */
    --color-primary:          #F24B9A;
    --color-primary-subtle:   rgba(242, 75, 154, 0.15);
    --color-primary-glow:     rgba(242, 75, 154, 0.22);
    --color-brand-secondary:  #C9A96E;
    --color-brand-accent:     #7B61FF;
    --color-brand-accent-glow: rgba(123, 97, 255, 0.20);

    /* Typography */
    --color-text:             #FFFFFF;
    --color-text-muted:       #A1A1AA;
    --color-text-tertiary:    rgba(248, 244, 240, 0.35);
    --color-text-inverse:     #0B0A0E;

    /* Semantic */
    --color-success:          #34D399;
    --color-success-glow:     rgba(52, 211, 153, 0.35);
    --color-warning:          #FFD60A;
    --color-error:            #F87171;
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
  ```

- [ ] **Step 3: Verify `:root` is updated**

  ```bash
  grep -n "color-bg-noir\|color-surface-glass:\|color-brand-primary:\|color-text-primary:\|color-text-secondary:\|color-surface-border:" src/app/globals.css
  ```
  Expected: no output (all old names gone from `:root`).

  ```bash
  grep -n "color-bg:\|color-bg-glass:\|color-primary:\|color-primary-subtle:\|color-primary-glow:\|color-text:\s\|color-text-muted:\|color-border:\s\|color-success-glow:" src/app/globals.css
  ```
  Expected: all new tokens appear in `:root`.

- [ ] **Step 4: Commit**

  ```bash
  git add src/app/globals.css
  git commit -m "feat: update :root CSS tokens to Pearled Velvet Glass schema"
  ```

---

## Task 2: Update `var()` References Inside `globals.css`

**Files:** Modify `src/app/globals.css` (everything below `:root`)

The component classes, body, typography utilities, scrollbar, and selection rules still reference old token names. This task updates them all with sed in the correct order (more-specific patterns first to avoid partial matches).

- [ ] **Step 1: Verify old `var()` references still exist**

  ```bash
  grep -c "var(--color-bg-noir)\|var(--color-surface-glass)\|var(--color-brand-primary)\|var(--color-text-primary)\|var(--color-text-secondary)\|var(--color-surface-border)" src/app/globals.css
  ```
  Expected: a count > 0.

- [ ] **Step 2: Apply renames in order (run from `apps/brand-network-web/`)**

  Run each command separately:

  ```bash
  # 1. brand-primary-glow → primary-glow (MUST be before brand-primary rename)
  sed -i 's/var(--color-brand-primary-glow)/var(--color-primary-glow)/g' src/app/globals.css

  # 2. brand-primary → primary (safe now that -glow variant is already renamed)
  sed -i 's/var(--color-brand-primary)/var(--color-primary)/g' src/app/globals.css

  # 3. surface-glass) → bg-glass) (bracket prevents matching surface-glass-md)
  sed -i 's/var(--color-surface-glass)/var(--color-bg-glass)/g' src/app/globals.css

  # 4. surface-border) → border) (bracket prevents matching surface-border-md)
  sed -i 's/var(--color-surface-border)/var(--color-border)/g' src/app/globals.css

  # 5. text-primary → text
  sed -i 's/var(--color-text-primary)/var(--color-text)/g' src/app/globals.css

  # 6. text-secondary → text-muted
  sed -i 's/var(--color-text-secondary)/var(--color-text-muted)/g' src/app/globals.css

  # 7. bg-noir → bg
  sed -i 's/var(--color-bg-noir)/var(--color-bg)/g' src/app/globals.css
  ```

- [ ] **Step 3: Verify no old `var()` references remain in globals.css**

  ```bash
  grep "var(--color-bg-noir)\|var(--color-surface-glass)\|var(--color-brand-primary)\|var(--color-text-primary)\|var(--color-text-secondary)\|var(--color-surface-border)" src/app/globals.css
  ```
  Expected: no output.

  Confirm `-md` variants were NOT touched:
  ```bash
  grep "surface-glass-md\|surface-border-md" src/app/globals.css
  ```
  Expected: these still appear (they were not renamed).

- [ ] **Step 4: Commit**

  ```bash
  git add src/app/globals.css
  git commit -m "feat: update var() references in globals.css to new token names"
  ```

---

## Task 3: Fix Bodoni Moda Font Weights in `globals.css`

**Files:** Modify `src/app/globals.css` lines ~377–390

The schema requires Bodoni Moda to never be bolded. `.heading-display` (700) and `.heading-section` (600) violate this.

- [ ] **Step 1: Verify current weights**

  ```bash
  grep -A5 "\.heading-display\|\.heading-section" src/app/globals.css | grep "font-weight"
  ```
  Expected: `font-weight: 700;` and `font-weight: 600;`

- [ ] **Step 2: Update `.heading-display` weight**

  In `src/app/globals.css`, find `.heading-display` and change `font-weight: 700` to `font-weight: 300`.

  The block should become:
  ```css
  .heading-display {
    font-family: var(--font-display);
    font-weight: 300;
    line-height: 1.1;
    letter-spacing: -0.025em;
    color: var(--color-text);
  }
  ```

- [ ] **Step 3: Update `.heading-section` weight**

  Find `.heading-section` and change `font-weight: 600` to `font-weight: 400`.

  The block should become:
  ```css
  .heading-section {
    font-family: var(--font-display);
    font-weight: 400;
    line-height: 1.2;
    letter-spacing: -0.02em;
    color: var(--color-text);
  }
  ```

- [ ] **Step 4: Verify weights are updated**

  ```bash
  grep -A5 "\.heading-display\|\.heading-section" src/app/globals.css | grep "font-weight"
  ```
  Expected: `font-weight: 300;` and `font-weight: 400;`

- [ ] **Step 5: Commit**

  ```bash
  git add src/app/globals.css
  git commit -m "feat: set Bodoni Moda heading weights to light/normal per schema"
  ```

---

## Task 4: Cascade Token Renames to `src/components/`

**Files:** 11 files under `src/components/`

- [ ] **Step 1: Verify old token names exist in components/**

  ```bash
  grep -rl "color-bg-noir\|color-surface-glass\b\|color-brand-primary\|color-text-primary\|color-text-secondary\|color-surface-border\b" src/components/
  ```
  Expected: a list of files.

- [ ] **Step 2: Apply all 7 renames to every file in `src/components/`**

  Run each command:
  ```bash
  sed -i 's/--color-brand-primary-glow/--color-primary-glow/g' $(grep -rl "color-brand-primary-glow" src/components/)
  sed -i 's/--color-brand-primary\([^-]\)/--color-primary\1/g' $(grep -rl "color-brand-primary" src/components/)
  sed -i 's/var(--color-surface-glass)/var(--color-bg-glass)/g' $(grep -rl "var(--color-surface-glass)" src/components/)
  sed -i 's/var(--color-surface-border)/var(--color-border)/g' $(grep -rl "var(--color-surface-border)" src/components/)
  sed -i 's/--color-text-primary/--color-text/g' $(grep -rl "color-text-primary" src/components/)
  sed -i 's/--color-text-secondary/--color-text-muted/g' $(grep -rl "color-text-secondary" src/components/)
  sed -i 's/--color-bg-noir/--color-bg/g' $(grep -rl "color-bg-noir" src/components/)
  ```

  > If any `grep -rl` returns no results, that sed command is a no-op — that's fine.

- [ ] **Step 3: Verify no old names remain in `src/components/`**

  ```bash
  grep -r "color-bg-noir\|color-surface-glass)\|var(--color-brand-primary)\b\|color-brand-primary-glow\|color-text-primary\|color-text-secondary\|color-surface-border)" src/components/
  ```
  Expected: no output.

- [ ] **Step 4: Commit**

  ```bash
  git add src/components/
  git commit -m "feat: cascade token renames to components/"
  ```

---

## Task 5: Cascade Token Renames to `src/app/(corporate)/`

**Files:** 10 files under `src/app/(corporate)/`

- [ ] **Step 1: Verify old token names exist**

  ```bash
  grep -rl "color-bg-noir\|color-surface-glass\|color-brand-primary\|color-text-primary\|color-text-secondary\|color-surface-border" src/app/\(corporate\)/
  ```
  Expected: a list of files.

- [ ] **Step 2: Apply all 7 renames**

  ```bash
  sed -i 's/--color-brand-primary-glow/--color-primary-glow/g' $(grep -rl "color-brand-primary-glow" "src/app/(corporate)/")
  sed -i 's/--color-brand-primary\([^-]\)/--color-primary\1/g' $(grep -rl "color-brand-primary" "src/app/(corporate)/")
  sed -i 's/var(--color-surface-glass)/var(--color-bg-glass)/g' $(grep -rl "var(--color-surface-glass)" "src/app/(corporate)/")
  sed -i 's/var(--color-surface-border)/var(--color-border)/g' $(grep -rl "var(--color-surface-border)" "src/app/(corporate)/")
  sed -i 's/--color-text-primary/--color-text/g' $(grep -rl "color-text-primary" "src/app/(corporate)/")
  sed -i 's/--color-text-secondary/--color-text-muted/g' $(grep -rl "color-text-secondary" "src/app/(corporate)/")
  sed -i 's/--color-bg-noir/--color-bg/g' $(grep -rl "color-bg-noir" "src/app/(corporate)/")
  ```

- [ ] **Step 3: Verify no old names remain**

  ```bash
  grep -r "color-bg-noir\|color-surface-glass)\|var(--color-brand-primary)\b\|color-brand-primary-glow\|color-text-primary\|color-text-secondary\|color-surface-border)" "src/app/(corporate)/"
  ```
  Expected: no output.

- [ ] **Step 4: Commit**

  ```bash
  git add "src/app/(corporate)/"
  git commit -m "feat: cascade token renames to app/(corporate)/"
  ```

---

## Task 6: Cascade Token Renames to `src/app/(main)/`

**Files:** 10 files under `src/app/(main)/`

- [ ] **Step 1: Verify old token names exist**

  ```bash
  grep -rl "color-bg-noir\|color-surface-glass\|color-brand-primary\|color-text-primary\|color-text-secondary\|color-surface-border" "src/app/(main)/"
  ```

- [ ] **Step 2: Apply all 7 renames**

  ```bash
  sed -i 's/--color-brand-primary-glow/--color-primary-glow/g' $(grep -rl "color-brand-primary-glow" "src/app/(main)/")
  sed -i 's/--color-brand-primary\([^-]\)/--color-primary\1/g' $(grep -rl "color-brand-primary" "src/app/(main)/")
  sed -i 's/var(--color-surface-glass)/var(--color-bg-glass)/g' $(grep -rl "var(--color-surface-glass)" "src/app/(main)/")
  sed -i 's/var(--color-surface-border)/var(--color-border)/g' $(grep -rl "var(--color-surface-border)" "src/app/(main)/")
  sed -i 's/--color-text-primary/--color-text/g' $(grep -rl "color-text-primary" "src/app/(main)/")
  sed -i 's/--color-text-secondary/--color-text-muted/g' $(grep -rl "color-text-secondary" "src/app/(main)/")
  sed -i 's/--color-bg-noir/--color-bg/g' $(grep -rl "color-bg-noir" "src/app/(main)/")
  ```

- [ ] **Step 3: Verify no old names remain**

  ```bash
  grep -r "color-bg-noir\|color-surface-glass)\|var(--color-brand-primary)\b\|color-brand-primary-glow\|color-text-primary\|color-text-secondary\|color-surface-border)" "src/app/(main)/"
  ```
  Expected: no output.

- [ ] **Step 4: Commit**

  ```bash
  git add "src/app/(main)/"
  git commit -m "feat: cascade token renames to app/(main)/"
  ```

---

## Task 7: Cascade Token Renames to Remaining `src/app/` Files

**Files:** auth, admin, public, subdomain, and root `src/app/page.tsx`

- [ ] **Step 1: Verify old token names exist**

  ```bash
  grep -rl "color-bg-noir\|color-surface-glass\|color-brand-primary\|color-text-primary\|color-text-secondary\|color-surface-border" \
    "src/app/(auth)/" "src/app/(admin)/" "src/app/(public)/" "src/app/[subdomain]/" src/app/page.tsx
  ```

- [ ] **Step 2: Apply all 7 renames**

  ```bash
  for dir in "src/app/(auth)/" "src/app/(admin)/" "src/app/(public)/" "src/app/[subdomain]/"; do
    files=$(grep -rl "color-brand-primary-glow" "$dir" 2>/dev/null) && [ -n "$files" ] && sed -i 's/--color-brand-primary-glow/--color-primary-glow/g' $files
    files=$(grep -rl "color-brand-primary" "$dir" 2>/dev/null) && [ -n "$files" ] && sed -i 's/--color-brand-primary\([^-]\)/--color-primary\1/g' $files
    files=$(grep -rl "var(--color-surface-glass)" "$dir" 2>/dev/null) && [ -n "$files" ] && sed -i 's/var(--color-surface-glass)/var(--color-bg-glass)/g' $files
    files=$(grep -rl "var(--color-surface-border)" "$dir" 2>/dev/null) && [ -n "$files" ] && sed -i 's/var(--color-surface-border)/var(--color-border)/g' $files
    files=$(grep -rl "color-text-primary" "$dir" 2>/dev/null) && [ -n "$files" ] && sed -i 's/--color-text-primary/--color-text/g' $files
    files=$(grep -rl "color-text-secondary" "$dir" 2>/dev/null) && [ -n "$files" ] && sed -i 's/--color-text-secondary/--color-text-muted/g' $files
    files=$(grep -rl "color-bg-noir" "$dir" 2>/dev/null) && [ -n "$files" ] && sed -i 's/--color-bg-noir/--color-bg/g' $files
  done

  # root page
  sed -i 's/--color-brand-primary-glow/--color-primary-glow/g' src/app/page.tsx
  sed -i 's/--color-brand-primary\([^-]\)/--color-primary\1/g' src/app/page.tsx
  sed -i 's/var(--color-surface-glass)/var(--color-bg-glass)/g' src/app/page.tsx
  sed -i 's/var(--color-surface-border)/var(--color-border)/g' src/app/page.tsx
  sed -i 's/--color-text-primary/--color-text/g' src/app/page.tsx
  sed -i 's/--color-text-secondary/--color-text-muted/g' src/app/page.tsx
  sed -i 's/--color-bg-noir/--color-bg/g' src/app/page.tsx
  ```

- [ ] **Step 3: Verify no old names remain**

  ```bash
  grep -r "color-bg-noir\|color-surface-glass)\|var(--color-brand-primary)\b\|color-brand-primary-glow\|color-text-primary\|color-text-secondary\|color-surface-border)" \
    "src/app/(auth)/" "src/app/(admin)/" "src/app/(public)/" "src/app/[subdomain]/" src/app/page.tsx
  ```
  Expected: no output.

- [ ] **Step 4: Commit**

  ```bash
  git add "src/app/(auth)/" "src/app/(admin)/" "src/app/(public)/" "src/app/[subdomain]/" src/app/page.tsx
  git commit -m "feat: cascade token renames to remaining app/ routes"
  ```

---

## Task 8: Final Verification & Build Check

- [ ] **Step 1: Full codebase scan for old token names**

  Run from `apps/brand-network-web/`:
  ```bash
  grep -r "color-bg-noir\|color-surface-glass)\|var(--color-brand-primary)\b\|--color-brand-primary:\|color-brand-primary-glow\|color-text-primary\|color-text-secondary\|color-surface-border)" src/
  ```
  Expected: **no output**. If anything appears, apply the relevant sed command to that file and re-verify.

- [ ] **Step 2: Confirm new tokens and values are present in `:root`**

  ```bash
  grep "color-primary-subtle\|color-success-glow\|color-bg-glass\|color-text-muted\|color-primary-glow\|16151A\|34D399\|F87171\|FFFFFF" src/app/globals.css
  ```
  Expected: all 7 patterns appear.

- [ ] **Step 3: Confirm `-md` variants still intact**

  ```bash
  grep "surface-glass-md\|surface-border-md" src/app/globals.css
  ```
  Expected: both appear unchanged.

- [ ] **Step 4: Run TypeScript type check**

  ```bash
  npx tsc --noEmit
  ```
  Expected: no errors. (Token names are runtime strings — TS won't catch CSS var typos — but this catches any syntax errors introduced during edits.)

- [ ] **Step 5: Run Next.js build**

  ```bash
  npx next build
  ```
  Expected: build completes with no errors.

- [ ] **Step 6: Final commit if any stragglers were fixed in Step 1**

  ```bash
  git add -p
  git commit -m "fix: clean up any remaining old token references"
  ```
