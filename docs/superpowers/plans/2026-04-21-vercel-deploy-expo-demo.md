# Vercel Deploy + Expo Go Demo Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Deploy `brand-network-web` to Vercel on `toptenprom.store` and configure the Expo mobile app to point at it for client demos via Expo Go.

**Architecture:** Full monorepo pushed to a fresh GitHub repo. Vercel project root set to `apps/brand-network-web`. Mobile `eas.json` updated to use `toptenprom.store`. No code-level changes — config only.

**Tech Stack:** Next.js 16, Vercel, Expo 52, EAS, pnpm monorepo, Turborepo

---

### Task 1: Update `eas.json` domain

**Files:**
- Modify: `apps/mobile-instore-app/eas.json`

- [ ] Replace `staging.toptenprom.com` → `staging.toptenprom.store`
- [ ] Replace `toptenprom.com` → `toptenprom.store` (preview + production envs)
- [ ] Commit: `git commit -m "config: update eas.json API URLs to toptenprom.store"`

---

### Task 2: Commit all pending changes and push to new repo

**Files:** all tracked changes

- [ ] Stage and commit any remaining changes
- [ ] User creates new GitHub repo (e.g. `toptenprom-ecosystem`) at github.com
- [ ] `git remote set-url origin <new-repo-url>`
- [ ] `git push -u origin main --tags`

---

### Task 3: Vercel project setup (user action)

- [ ] Create new Vercel project → import from new GitHub repo
- [ ] Set **Root Directory** to `apps/brand-network-web`
- [ ] Framework: Next.js (auto-detected)
- [ ] Add custom domain: `toptenprom.store`
- [ ] Input all env vars from `.env.example` (list provided after push)

---

### Task 4: Expo Go demo prep

- [ ] Confirm `EXPO_PUBLIC_API_URL` in `eas.json` dev profile points to `http://localhost:3000` (correct for local dev)
- [ ] For demo: run `expo start` in `apps/mobile-instore-app` — QR code shown in terminal
- [ ] Client installs Expo Go (iOS App Store / Google Play) and scans QR
- [ ] Override API URL at demo time: `EXPO_PUBLIC_API_URL=https://toptenprom.store expo start`
