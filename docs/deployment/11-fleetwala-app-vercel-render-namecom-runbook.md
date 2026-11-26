# FleetWala Cloud Deployment Runbook (Vercel + Render + Name.com + Supabase)

**Document:** `docs/deployment/11-fleetwala-app-vercel-render-namecom-runbook.md`  
**Audit Date:** 2026-11-26  
**Phases:** Phases 10, 11, 12, 13 & 14  
**Status:** PREPARATION ONLY — **DO NOT DEPLOY / DO NOT MODIFY DNS WITHOUT OWNER AUTHORIZATION**

---

## 1. Planned Topology (`fleetwala.app`)

- **Frontend SPA (Vercel):** `https://fleetwala.app` (with optional `https://www.fleetwala.app` redirect) serving `@workspace/fleetwala` (`artifacts/fleetwala/dist/public`).
- **Backend API (Render):** `https://api.fleetwala.app` running `@workspace/api-server` (`artifacts/api-server/dist/index.mjs`, port from `PORT`, host `0.0.0.0`).
- **Database & Auth (Supabase):** `https://jigbzsaaowtyaqhreplg.supabase.co` (staging/pre-production) or dedicated production Supabase project once authorized.

---

## 2. Vercel Frontend Preparation Checklist (`artifacts/fleetwala`)

Verified in repository: `vercel.json`, `artifacts/fleetwala/vercel.json`, `artifacts/fleetwala/vite.config.ts`.
- **Framework Preset:** Other / Vite (monorepo root build configured in root `vercel.json`).
- **Build Command:** `pnpm --filter @workspace/fleetwala run build`
- **Output Directory:** `artifacts/fleetwala/dist/public`
- **SPA Rewrites:** `/((?!assets/|favicon.ico|favicon.svg|robots.txt).*) -> /index.html` *(Updated to preserve `/favicon.svg` and static assets).*
- **Security Headers Configured:** `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`, `Strict-Transport-Security`, `Permissions-Policy`, immutable asset caching on `/assets/(.*)`.
- **Bundle Check Required After Every Deploy Change:** Confirm zero `service_role`, payment secrets, or test auth bypasses appear in compiled JS assets.

---

## 3. Render Backend Preparation Checklist (`artifacts/api-server`)

Verified in repository: `render.yaml`, `artifacts/api-server/src/app.ts`, `artifacts/api-server/src/index.ts`.
- **Build Command (`render.yaml`):** `corepack enable && corepack pnpm install --frozen-lockfile && corepack pnpm --filter @workspace/api-server run build`
- **Start Command (`render.yaml`):** `corepack pnpm --filter @workspace/api-server run start` *(Executes `node --enable-source-maps ./dist/index.mjs`)*
- **Health Check Path:** `/api/healthz` (HTTP 200 `{ "status": "ok" }`)
- **Host/Port Binding:** `0.0.0.0` binding, dynamic `process.env.PORT` validation (`1..65535`).
- **Security & Reliability Middleware Implemented:**
  - Fail-closed CORS allowlist via `CORS_ORIGIN` (no wildcard `*.vercel.app` fallback; denies unknown `Origin` with HTTP 403).
  - HTTP `100kb` JSON/urlencoded body size cap (`413` on oversized payload).
  - Per-IP sliding-window API rate limit (`API_RATE_LIMIT_PER_MIN`, default `120/min`, HTTP `429` + `Retry-After`).
  - Baseline headers (`X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`, `Strict-Transport-Security` in production, `x-powered-by` disabled).
  - Structured pino request logging with `authorization` and `cookie` redaction; graceful `SIGTERM`/`SIGINT` HTTP server drain.
- **Note on Render Free Tier:** Services on Render `plan: free` sleep after ~15 minutes of inactivity. Upgrade to a paid tier before commercial payment webhooks are enabled.

---

## 4. Name.com DNS Preparation Checklist (`fleetwala.app`)

**DO NOT MODIFY NAME.COM DNS RECORDS YET.** When deployment is separately authorized:

1. **Audit Existing Zone First (Pre-Edit Snapshot):**
   - Export/screenshot ALL existing DNS records at Name.com (`A`, `AAAA`, `CNAME`, `MX`, `TXT`, `NS`, `CAA`) before changing anything.
   - Verify whether any **MX, SPF, DKIM, or DMARC** records already exist for `@` (`fleetwala.app`) so email DNS records are **never overwritten**.
2. **Vercel Frontend Records (Add exact targets issued by Vercel Domains):**
   - **Apex (`@` / `fleetwala.app`):** Configure the exact `A` or `ANAME`/`ALIAS` record value provided in Vercel Project $\to$ Settings $\to$ Domains (do not guess or hardcode static IPs).
   - **Optional `www` (`www.fleetwala.app`):** Configure the exact `CNAME` target provided by Vercel and configure 308/301 redirect `www.fleetwala.app` $\to$ `https://fleetwala.app`.
3. **Render Backend Subdomain (`api.fleetwala.app`):**
   - Add `api` `CNAME` pointing to the exact Render-provided `*.onrender.com` service hostname shown in Render $\to$ Custom Domains.
4. **TLS & CAA Verification:**
   - Ensure any `CAA` records on `fleetwala.app` permit certificate issuance by Let's Encrypt (`0 issue "letsencrypt.org"`) / Google Trust Services if restricted.
   - Wait for TLS issuance and verify `https://fleetwala.app`, `https://www.fleetwala.app`, and `https://api.fleetwala.app/api/healthz` via `nslookup`/`dig` and browser HTTPS inspection.
5. **Domain Mail & Deliverability DNS (Required before Public Launch):**
   - Provision mailboxes **`support@fleetwala.app`**, **`grievance@fleetwala.app`**, and transactional sender **`noreply@fleetwala.app`**.
   - Publish valid **SPF**, **DKIM**, and **DMARC** TXT records per mail/SMTP provider instructions and test live delivery before removing `[OWNER ACTION REQUIRED]` banners.

---

## 5. Supabase Auth & OAuth Cutover Checklist (`jigbzsaaowtyaqhreplg` or Prod Project)

**DO NOT EDIT EXTERNAL OAUTH SETTINGS YET.** When authorized:

1. **Supabase $\to$ Authentication $\to$ URL Configuration:**
   - **Site URL:** `https://fleetwala.app`
   - **Explicit Redirect URLs (avoid broad wildcards):**
     - `https://fleetwala.app/**`
     - `https://www.fleetwala.app/**` (if enabled)
     - `http://localhost:3000/**` *(Preserve for local development)*
     - *(Optional staging preview domain only if needed for a specific Vercel staging URL)*
2. **Google Cloud Console (OAuth Client):**
   - **Authorized JavaScript origins:** `https://fleetwala.app`, `https://www.fleetwala.app`, `http://localhost:3000`, `https://<supabase-project-ref>.supabase.co`
   - **Authorized redirect URIs:** `https://<supabase-project-ref>.supabase.co/auth/v1/callback`
3. **GitHub OAuth (if enabled in Supabase Providers):**
   - Verify Authorization Callback URL matches `https://<supabase-project-ref>.supabase.co/auth/v1/callback`.
4. **Password Recovery & Email Confirmation:**
   - Client pages dynamically resolve `${window.location.origin}/auth/callback` and `${window.location.origin}/reset-password`; verify Supabase Custom SMTP (using `noreply@fleetwala.app` after DNS verification) lifts the default ~3–4 emails/hr limit before public launch.

---

## 6. Payment Security & Future Activation Gate (Phase 14)

- **Current Verified State:**
  - `public.billing_settings.enabled = false`
  - Employer pricing remains `₹99 / job posting`, `₹10 / contact unlock`; worker applications remain **₹0 (Free)** (`<= 20 / IST day`).
  - Zero fake payment endpoints or unauthorized unlock RPCs exist in Express or Supabase.
  - `admin_grant_staging_job_waiver` is restricted strictly to `is_admin()`; staging waivers must NEVER be exposed to employers or non-admin users in production.
- **Required Before Payment Activation:** Separate owner authorization, Razorpay/Cashfree merchant KYC, server-side `POST /api/payments/create-order` + HMAC-SHA256 webhook verification with idempotent `provider_event_id` checks on Render, and controlled DB flip `billing_settings.enabled = true`.
