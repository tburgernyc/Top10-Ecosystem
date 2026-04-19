# Pearled Velvet Glass — Token Migration & Typography Update

**Date:** 2026-04-19
**Scope:** `apps/brand-network-web`

---

## Overview

Align the existing "Pearled Velvet Glass × Editorial Noir" design system to the definitive token schema. This involves renaming 7 CSS custom properties, updating 3 values, adding 2 new tokens, and correcting Bodoni Moda font weights across typography utility classes. All renamed tokens are cascaded to every component file that references them.

---

## Section 1 — CSS Token Changes (`globals.css` `:root`)

### 1a. Token Renames (with value changes where noted)

| Old Token | New Token | Value Change |
|---|---|---|
| `--color-bg-noir` | `--color-bg` | None — `#0B0A0E` |
| `--color-surface-glass` | `--color-bg-glass` | `rgba(255,255,255,0.03)` → `rgba(255,255,255,0.04)` |
| `--color-brand-primary` | `--color-primary` | None — `#F24B9A` |
| `--color-brand-primary-glow` | `--color-primary-glow` | `rgba(242,75,154,0.25)` → `rgba(242,75,154,0.22)` |
| `--color-text-primary` | `--color-text` | `#F8F4F0` → `#FFFFFF` |
| `--color-text-secondary` | `--color-text-muted` | `rgba(248,244,240,0.60)` → `#A1A1AA` |
| `--color-surface-border` | `--color-border` | None — `rgba(255,255,255,0.08)` |

### 1b. Value-Only Updates (names unchanged)

| Token | Old Value | New Value |
|---|---|---|
| `--color-bg-elevated` | `#161420` | `#16151A` |
| `--color-success` | `#32D74B` | `#34D399` |
| `--color-error` | `#FF453A` | `#F87171` |

### 1c. New Tokens Added

```css
--color-primary-subtle: rgba(242, 75, 154, 0.15);
--color-success-glow:   rgba(52, 211, 153, 0.35);
```

### 1d. Tokens Kept As-Is

These tokens are not in the new schema but are actively used in components — they remain untouched:
`--color-bg-sunken`, `--color-surface-glass-md`, `--color-surface-border-md`, `--color-brand-secondary`, `--color-brand-accent`, `--color-brand-accent-glow`, `--color-text-tertiary`, `--color-text-inverse`, `--color-warning`, `--color-info`

---

## Section 2 — Typography Weight Corrections (`globals.css`)

Bodoni Moda must never be bolded per the schema weight profile (`light` or `normal` only).

| Class | Property | Old | New |
|---|---|---|---|
| `.heading-display` | `font-weight` | `700` | `300` |
| `.heading-section` | `font-weight` | `600` | `400` |

---

## Section 3 — Component File Cascade

All `var()` references to renamed tokens are updated across every `.tsx` and `.ts` file under `src/`. The 7 rename mappings:

```
var(--color-bg-noir)            → var(--color-bg)
var(--color-surface-glass)      → var(--color-bg-glass)
var(--color-brand-primary)      → var(--color-primary)
var(--color-brand-primary-glow) → var(--color-primary-glow)
var(--color-text-primary)       → var(--color-text)
var(--color-text-secondary)     → var(--color-text-muted)
var(--color-surface-border)     → var(--color-border)
```

**41 files** across: admin/gate, auth/login, corporate (about, book, catalog, contact, home, journal, locator, try-on), dashboard (analytics, bridal-party, franchise, owner, layout, error), public (guardian-portal, vote), root page, subdomain (page, error, not-found), components (ai, dashboard, navigation).

---

## Implementation Notes

- **No `tailwind.config.ts` exists.** This project uses Tailwind v4 (CSS-first via `@import "tailwindcss"`). All design tokens live exclusively in `globals.css`.
- Component files also update internal `style={{}}` prop references and any CSS-in-JS strings using old token names.
- The `globals.css` component classes (`.glass-card`, `.bento-card`, `.btn-primary`, etc.) also reference the renamed tokens — these are updated in the same pass as Section 1.
