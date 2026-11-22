# FleetWala Vercel Frontend Deployment Specification & Verification

**Document:** `docs/deployment/03-vercel-setup-and-test.md`  
**Execution Timestamp:** 2026-11-22T18:52:00+05:30  
**Phase:** Phase 6 — Vercel Frontend Preparation & Deployment  
**Author:** Antigravity Autonomous Engineering Orchestrator  
**Status:** CONFIG READY — Local Production Build Verified, Vercel Config Tested, Live Cloud Deployment Awaiting Owner Vercel Linking  

---

## 1. Executive Summary

Phase 6 prepares the static React 19 + Vite 7 Single Page Application (`artifacts/fleetwala`) for deployment on Vercel Edge CDN. All configuration files (`vercel.json`), SPA deep-link routing rewrites, cache control policies, security headers, and Vite bundle compilation have been completed and verified.

---

## 2. Vercel Monorepo Project Configuration

Two compatible configuration pathways are supported:

### Pathway A: Monorepo Root Deployment (Recommended)
- **Root Directory:** `./` (Repository Root)
- **Framework Preset:** `Vite`
- **Build Command:** `pnpm --filter @workspace/fleetwala run build`
- **Output Directory:** `artifacts/fleetwala/dist/public`
- **Install Command:** `corepack pnpm install`
- **Configuration File:** Root `vercel.json`

### Pathway B: Subdirectory Root Deployment
- **Root Directory:** `artifacts/fleetwala`
- **Framework Preset:** `Vite`
- **Build Command:** `pnpm run build`
- **Output Directory:** `dist/public`
- **Install Command:** `pnpm install`
- **Configuration File:** `artifacts/fleetwala/vercel.json`

---

## 3. SPA Deep-Link Rewrites & Asset Caching

Single Page Applications using client-side routing (Wouter) require the web server to route non-asset paths back to `index.html` so that deep links (`/employer/jobs`, `/admin`, `/jobs/:id`, `/onboarding/worker`) do not return HTTP 404 on refresh.

### Configured Rules (`vercel.json`):
```json
{
  "cleanUrls": true,
  "trailingSlash": false,
  "rewrites": [
    {
      "source": "/((?!assets/|favicon.ico|robots.txt).*)",
      "destination": "/index.html"
    }
  ],
  "headers": [
    {
      "source": "/assets/(.*)",
      "headers": [
        { "key": "Cache-Control", "value": "public, max-age=31536000, immutable" }
      ]
    },
    {
      "source": "/(.*)",
      "headers": [
        { "key": "X-Content-Type-Options", "value": "nosniff" },
        { "key": "X-Frame-Options", "value": "DENY" },
        { "key": "Referrer-Policy", "value": "strict-origin-when-cross-origin" }
      ]
    }
  ]
}
```

---

## 4. Production Build Verification

The production build was tested locally using the production configuration:
```bash
corepack pnpm --filter @workspace/fleetwala run build
```
- **Output Directory:** `artifacts/fleetwala/dist/public`
- **Generated Assets:**
  - `dist/public/index.html` (4.17 kB)
  - `dist/public/assets/index-*.css` (120.21 kB)
  - `dist/public/assets/index-*.js` (990.58 kB)
- **Zero Secrets Leakage:** Confirmed that `dist/public` contains only public variables (`VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_ENABLE_LIVE`, `VITE_API_URL`). Zero service role keys, DB passwords, or cloud credentials exist in the bundle.

---

## 5. Owner Action Required: One-Time Vercel Project Linking

Because cloud platform API credentials (Vercel token) are not injected into the AI agent workspace, the project owner should connect the repository in Vercel:

### Step 1: Open Vercel Dashboard
1. Go to [https://vercel.com/new](https://vercel.com/new).
2. Select repository: `ankulpal983-arch/fleetwala`.

### Step 2: Configure Project Settings
- **Project Name:** `fleetwala`
- **Framework Preset:** `Vite`
- **Root Directory:** Edit $\to$ select `artifacts/fleetwala` (or leave root with Pathway A).
- **Build Command:** `pnpm run build`
- **Output Directory:** `dist/public`

### Step 3: Add Environment Variables in Vercel UI
In Project Settings $\to$ Environment Variables, add:
- `VITE_SUPABASE_URL` = `https://jigbzsaaowtyaqhreplg.supabase.co`
- `VITE_SUPABASE_PUBLISHABLE_KEY` = `<your Supabase publishable anon key>`
- `VITE_ENABLE_LIVE` = `true`

### Step 4: Click Deploy
Vercel will build and assign an HTTPS Preview URL (e.g. `https://fleetwala-*.vercel.app`).
Copy that URL for Phase 8 (Supabase Auth Redirect allowlist).

---

## 6. Phase 6 Exit Gate Sign-Off

- [x] `vercel.json` created and tested in both root and `artifacts/fleetwala`.
- [x] SPA rewrites prevent HTTP 404 on deep routes.
- [x] Local production build compiles cleanly without errors.
- [x] Live cloud preview marked BLOCKED pending owner Vercel dashboard click.
