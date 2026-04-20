# Expo In-Store Mobile App — Design Spec
**Date:** 2026-04-20
**Status:** Approved

## Overview

A staff-only Expo (React Native) app for Top 10 Prom boutique staff. Runs on a shared in-store tablet. Provides a unified queue view (walk-ins + today's appointments), walk-in check-in, walk-in → appointment conversion, and VTO (Virtual Try-On) photo capture. Offline-first via WatermelonDB synced against the existing `/api/sync` endpoint.

---

## 1. Architecture & Project Structure

```
apps/mobile-instore-app/
├── app/
│   ├── (auth)/
│   │   └── index.tsx          # Store code entry screen
│   └── (app)/
│       ├── _layout.tsx        # Tab navigator (Queue | VTO)
│       ├── queue/
│       │   ├── index.tsx      # Combined walk-ins + appointments list
│       │   └── check-in.tsx   # New walk-in form
│       └── vto/
│           └── index.tsx      # Camera capture + dress ID entry
├── src/
│   ├── db/
│   │   ├── database.ts        # WatermelonDB instance (expo-sqlite adapter)
│   │   ├── models/
│   │   │   ├── WalkIn.ts
│   │   │   └── Appointment.ts
│   │   ├── schema.ts          # WatermelonDB table/column definitions
│   │   └── sync.ts            # synchronize() wrapper → /api/sync
│   ├── store/
│   │   └── auth.ts            # expo-secure-store: tenant_id, store_name, sync_secret
│   └── lib/
│       └── api.ts             # fetch wrapper with x-sync-secret header
├── assets/
├── app.json                   # Already configured (dark theme, permissions)
└── eas.json                   # Already configured (dev/preview/production)
```

**Key constraints:**
- WatermelonDB uses the `expo-sqlite` adapter (already listed in `app.json` plugins)
- `tenant_id` + `sync_secret` persisted in `expo-secure-store` after store code entry
- All API calls include `x-sync-secret` header (validated by `/api/sync`)
- Dark theme `#0B0A0E` throughout; requires EAS development build (not Expo Go)

---

## 2. Auth — Store Code Flow

**First launch:** Single screen with logo + Store Code input. Staff enter the store's code.

**Login request:** `POST /api/mobile/auth` with `{ store_code }`. Server looks up matching tenant, returns `{ tenant_id, store_name, sync_secret }`. All three saved to `expo-secure-store`.

**Subsequent launches:** App reads `tenant_id` from secure storage and navigates directly to the Queue tab. No re-auth needed.

**Change store:** Settings sheet accessible from queue header. Clears secure storage, returns to code entry screen.

**Error states:**
- Invalid code → inline field error: "Code not recognised — check with your manager."
- Network failure → "Couldn't reach server — check Wi-Fi and try again."

**New API route:** `POST /api/mobile/auth` in `apps/brand-network-web/src/app/api/mobile/auth/route.ts`

---

## 3. Navigation & Screens

Two bottom tabs after auth:

### Tab 1 — Queue (default)

**`queue/index.tsx`**
- Scrollable list with two labelled sections:
  - **Walk-Ins** — filtered to statuses `waiting`, `called`, `with_stylist`
  - **Appointments** — today's date, statuses `pending`, `confirmed`, `arrived`
- Each row: name, status badge (colour-coded), wait time or appointment time, party size
- Tapping a walk-in row opens a bottom sheet with:
  - Status actions: Call → Seat with Stylist → Complete / Mark Left
  - Assign stylist (picker)
  - **"Convert to Appointment"** action
- FAB (bottom right): **+ Check In** → navigates to `queue/check-in.tsx`
- Offline banner (top): "Offline — changes will sync when connected" when no connectivity

**`queue/check-in.tsx`**
- Full-screen form: name (text), phone (phone keyboard), party size (stepper 1–10), occasion (picker from `dressOccasionEnum`), notes (optional multiline)
- Submit creates WatermelonDB record immediately (optimistic) and triggers background sync
- `queue_position` assigned locally as `max(current positions) + 1`; server reconciles the canonical value on next pull

### Tab 2 — VTO

**`vto/index.tsx`**
- Top half: live `expo-camera` preview
- Bottom half:
  - Dress ID text input
  - Color name text input (required — maps to `vto_sessions.color_name`)
  - **Scan Tag** button — activates barcode scanning mode on the camera
  - **Capture & Send** button (disabled until dress ID and color name are both filled)
- On capture: still image taken, base64-encoded, POSTed to `POST /api/vto/initiate` with `{ dress_id, color_name, image_base64, tenant_id }`
- Status card replaces form: `queued → processing → completed` with output image displayed inline on completion
- Offline guard: if no connectivity, toast "VTO requires an internet connection" blocks submission

---

## 4. WatermelonDB Models & Sync

### `WalkIn` model
Columns mirror the `walk_ins` Drizzle table:
`tenant_id`, `customer_name`, `phone_number`, `party_size`, `occasion`, `notes`, `status`, `queue_position`, `estimated_wait_minutes`, `assigned_stylist_id`, `checked_in_at`, `called_at`, `completed_at`

### `Appointment` model
Columns mirror the `appointments` Drizzle table (pull-only):
`tenant_id`, `customer_id`, `stylist_id`, `appointment_date`, `duration_minutes`, `service_type`, `status`, `notes`, `confirmation_code`

### Sync behavior
- `sync.ts` wraps WatermelonDB `synchronize()`:
  - Pull: `GET /api/sync?tenant_id=X&last_pulled_at=Y`
  - Push: `POST /api/sync` (walk-in mutations only — appointments are pull-only)
- Sync triggers: app foreground, after walk-in status change, after check-in submit
- `last_pulled_at` timestamp persisted in MMKV between syncs
- Conflict resolution: last-write-wins (WatermelonDB default) — acceptable since each store manages its own walk-ins

**No server changes needed for sync** — existing `/api/sync` already handles both tables with this shape.

---

## 5. Walk-In → Appointment Conversion

Accessible via "Convert to Appointment" in the walk-in bottom sheet.

**Conversion modal fields:**
- Date/time picker (defaults to now)
- Duration stepper (default 60 min)
- Service type text input
- Stylist assignment picker

**On confirm:** `POST /api/mobile/convert-walkin` with `{ walk_in_id, appointment_date, duration_minutes, service_type, stylist_id }`

**Server logic:**
1. Look up or create `customers` record by phone number
2. Create `appointments` row with generated `confirmation_code`
3. Update `walk_ins` status to `with_stylist`

**Why server-side:** `appointments` requires `customer_id` (FK to `customers`) and server-generated `confirmation_code` — cannot be done client-only without risking orphaned records.

**Error handling:** Conversion is not optimistic. If the POST fails, the modal stays open with an inline error. Walk-in status is not updated locally until server confirms success.

**New API route:** `POST /api/mobile/convert-walkin` in `apps/brand-network-web/src/app/api/mobile/convert-walkin/route.ts`

---

## 6. Error Handling & Offline UX

| Scenario | Behavior |
|---|---|
| No connectivity | Slim banner on queue screen; walk-in mutations queue locally |
| Sync failure | Silent retry on next foreground / connectivity restore |
| VTO while offline | Toast blocks submission: "VTO requires an internet connection" |
| VTO POST failure | Inline error card with Retry button |
| Conversion failure | Modal stays open with error banner; no local status change |
| Invalid store code | Inline field error |
| Auth network failure | Inline error with retry prompt |

---

## 7. New API Routes Required

| Method | Route | Purpose |
|---|---|---|
| `POST` | `/api/mobile/auth` | Validate store code, return tenant_id + sync_secret |
| `POST` | `/api/mobile/convert-walkin` | Convert walk-in to appointment atomically |

Existing routes used without modification:
- `GET/POST /api/sync` — WatermelonDB pull/push
- `POST /api/vto/initiate` — VTO session creation

---

## 8. Key Dependencies to Add

```json
"@nozbe/watermelondb": "^0.27.x",
"@nozbe/with-observables": "^1.6.x",
"expo-secure-store": "^13.x",
"react-native-mmkv": "^2.x",
"@react-native-community/netinfo": "^11.x"
```

`expo-camera` (includes barcode scanning as of SDK 50+) and `expo-sqlite` are already declared in `app.json` plugins.
