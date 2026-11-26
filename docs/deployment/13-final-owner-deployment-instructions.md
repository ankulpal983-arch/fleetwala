# FleetWala Final Owner Deployment & Cutover Instructions

**Document:** `docs/deployment/13-final-owner-deployment-instructions.md`  
**Date:** 2026-11-26  
**Repository:** `https://github.com/ankulpal983-arch/fleetwala`  
**Validated Branch:** `real-preproduction-conversion`  
**Domains (Registrar: Name.com):** `fleetwala.app` (Frontend), `www.fleetwala.app` (Redirect), `api.fleetwala.app` (Backend)  
**Operational Rule:** Zero external deploys, DNS edits, OAuth console edits, or billing activations were performed automatically. Follow these verified instructions when you choose to deploy.

---

## 1. Exact Render Backend Configuration (`@workspace/api-server`)

Verified directly from [render.yaml](file:///d:/Downloads/Fleet-Wala-Builder/Fleet-Wala-Builder/render.yaml), [package.json](file:///d:/Downloads/Fleet-Wala-Builder/Fleet-Wala-Builder/artifacts/api-server/package.json), [app.ts](file:///d:/Downloads/Fleet-Wala-Builder/Fleet-Wala-Builder/artifacts/api-server/src/app.ts), and [index.ts](file:///d:/Downloads/Fleet-Wala-Builder/Fleet-Wala-Builder/artifacts/api-server/src/index.ts):

| Setting | Exact Value / Specification |
|---|---|
| **Service Type** | `Web Service` (`type: web`) |
| **Service Name** | `fleetwala-api` |
| **Repository** | `https://github.com/ankulpal983-arch/fleetwala` |
| **Git Branch** | `real-preproduction-conversion` *(or `main` after separate owner merge authorization)* |
| **Runtime** | `Node` (`NODE_VERSION=22.22.2`) |
| **Region** | `oregon` *(configured in `render.yaml`; you may select `singapore` when creating manually for lower India latency)* |
| **Root Directory** | `./` *(Repository Root — required so `pnpm-workspace.yaml` resolves `@workspace/api-zod` and `@workspace/db`)* |
| **Build Command** | `corepack enable && corepack pnpm install --frozen-lockfile && corepack pnpm --filter @workspace/api-server run build` |
| **Start Command** | `corepack pnpm --filter @workspace/api-server run start` *(runs `node --enable-source-maps ./dist/index.mjs`)* |
| **Health Check Path** | `/api/healthz` *(returns HTTP `200` `{"status":"ok"}`)* |
| **CORS Configuration** | Strict comma-separated allowlist in `CORS_ORIGIN` (no wildcard `*.vercel.app`). Requests from unlisted browser `Origin` headers fail closed with HTTP `403`. |
| **Recommended Hosting Plan** | `free` (`render.yaml` default) is acceptable for **initial private staging only** (sleeps after ~15 min inactivity). Upgrade to a paid tier (e.g. **Starter**) before public launch or enabling webhooks. |
| **Custom Domain** | `api.fleetwala.app` (Render $\to$ Settings $\to$ Custom Domains $\to$ copy the issued `*.onrender.com` `CNAME` target to Name.com). |

### Render Environment Variables
- **Required / Present in `render.yaml`:**
  - `NODE_VERSION` = `22.22.2`
  - `NODE_ENV` = `production` *(enables HSTS header & structured production pino JSON logs)*
  - `PORT` = `5000` *(or Render-injected port validated integer `1..65535`)*
  - `CORS_ORIGIN` = `https://fleetwala.app,https://www.fleetwala.app` *(for controlled staging on a `*.vercel.app` preview/staging domain, explicitly list that exact `https://<staging-domain>` alongside or instead of `fleetwala.app`)*
- **Optional Runtime Tuning (Read by `app.ts` / `logger.ts`):**
  - `API_RATE_LIMIT_PER_MIN` = `120` *(default per-IP 60s window limit; exceeds $\to$ HTTP `429` + `Retry-After`)*
  - `LOG_LEVEL` = `info`
- **Future Server-Only Secrets (Keep Unset Now; Encrypted in Render Only When Needed):**
  - `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `PAYMENT_WEBHOOK_SECRET`, `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` *(billing remains disabled `billing_settings.enabled = false`)*.

---

## 2. Exact Vercel Frontend Configuration (`@workspace/fleetwala`)

Verified directly from root [vercel.json](file:///d:/Downloads/Fleet-Wala-Builder/Fleet-Wala-Builder/vercel.json), [artifacts/fleetwala/vercel.json](file:///d:/Downloads/Fleet-Wala-Builder/Fleet-Wala-Builder/artifacts/fleetwala/vercel.json), [vite.config.ts](file:///d:/Downloads/Fleet-Wala-Builder/Fleet-Wala-Builder/artifacts/fleetwala/vite.config.ts), and [package.json](file:///d:/Downloads/Fleet-Wala-Builder/Fleet-Wala-Builder/artifacts/fleetwala/package.json):

| Setting | Exact Value / Specification |
|---|---|
| **Project Name** | `fleetwala` *(use `fleetwala-staging` if hosting a separate staging project)* |
| **Repository** | `ankulpal983-arch/fleetwala` |
| **Production Branch** | `real-preproduction-conversion` *(until `main` merge is separately authorized)* |
| **Framework Preset** | `Other` or `Vite` *(root `vercel.json` specifies custom monorepo build & output)* |
| **Root Directory** | `./` *(Repository Root — recommended so root `vercel.json` builds workspace cleanly)* |
| **Install Command** | `corepack pnpm install --frozen-lockfile` |
| **Build Command** | `pnpm --filter @workspace/fleetwala run build` *(executes `vite build --config vite.config.ts`)* |
| **Output Directory** | `artifacts/fleetwala/dist/public` |
| **SPA Routing & Headers** | Configured in `vercel.json`: `cleanUrls: true`, `trailingSlash: false`, rewrite `/((?!assets/\|favicon.ico\|favicon.svg\|robots.txt).*)` $\to$ `/index.html`, immutable cache on `/assets/(.*)`, plus `X-Content-Type-Options`, `X-Frame-Options: DENY`, `Referrer-Policy`, `Strict-Transport-Security`, `Permissions-Policy`. |
| **API URL Config** | Set `VITE_API_URL=https://api.fleetwala.app` (or staging Render URL). Core auth/DB traffic flows directly via HTTPS to Supabase (`VITE_SUPABASE_URL`) with RLS enforcement. |
| **Custom Domain** | `fleetwala.app` (Primary) and `www.fleetwala.app` (308 redirect to `https://fleetwala.app`) configured in Vercel $\to$ Settings $\to$ Domains. |

### Vercel Environment Variables (Public Browser Build-Time Only)
> [!CAUTION]
> Vite statically inlines every `VITE_*` variable into public browser JS assets. **NEVER** add `SUPABASE_SERVICE_ROLE_KEY`, database connection strings, SMTP passwords, or payment secrets to Vercel.

| Variable | Value (Staging) | Value (Public Production) |
|---|---|---|
| `VITE_SUPABASE_URL` | `https://jigbzsaaowtyaqhreplg.supabase.co` | `https://<new-prod-project-ref>.supabase.co` |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Staging `sb_publishable_...` key | Production `sb_publishable_...` key |
| `VITE_ENABLE_LIVE` | `true` | `true` |
| `VITE_API_URL` | `https://<staging-render-url>.onrender.com` *(or empty until linked)* | `https://api.fleetwala.app` |
| `BASE_PATH` | `/` *(optional, defaults to `/`)* | `/` |

---

## 3. Separated Supabase Strategy (Staging vs. Clean Production)

### Option A — Controlled Private Online Staging (`jigbzsaaowtyaqhreplg`)
- Uses the hardened `jigbzsaaowtyaqhreplg` project (Migration `027` applied, `11111111-...` deleted, `001`–`027` reconciled).
- **Risks of Reusing Staging for Public Production Launch:**
  1. Contains historical staging records (`38` audit logs, `37` notifications, owner/test jobs and invitations) and staging schema artifacts such as `admin_grant_staging_job_waiver` (`018`) and staging UUID assumptions (`019`, `025`, `026`).
  2. Mixing test OAuth redirects, staging testers, and live paying/job-seeking customers risks accidental operational mix-ups and lacks a verified Point-in-Time Recovery (PITR) restore drill.

### Option B — Dedicated Clean Production Supabase Project (Mandatory Before Public Launch)
1. Create a fresh **Production** Supabase project in **`ap-south-1` (Mumbai)** (minimum latency + India DPDP data localization alignment).
2. Run [supabase/production/001_production_baseline_schema.sql](file:///d:/Downloads/Fleet-Wala-Builder/Fleet-Wala-Builder/supabase/production/001_production_baseline_schema.sql) once in SQL Editor (never run `013`, `018` staging waiver, `019`, `023`, `025`, or `026`).
3. Run read-only check [014_database_verification.sql](file:///d:/Downloads/Fleet-Wala-Builder/Fleet-Wala-Builder/supabase/migrations/014_database_verification.sql) and verify `28/28` RLS tables, `worker-private-documents` (`public = false`), `pgcrypto` in schema `extensions`, and `billing_settings.enabled = false`.
4. Provision the initial owner administrator out-of-band per [supabase/production/README.md](file:///d:/Downloads/Fleet-Wala-Builder/Fleet-Wala-Builder/supabase/production/README.md) after signing in once and inspecting your production `auth.users` UUID.
5. **Do NOT copy PII** (`workers`, `employers`, `messages`, `audit_log`) from staging into production without explicit authorization.
6. **Hosted Compatibility Requirement:** Because local PostgreSQL 18 verification cannot exercise hosted Supabase infrastructure, verify hosted **GoTrue OAuth**, **PgBouncer connection pooling**, **PostgREST RPC resolution**, and **private Storage signed-URL upload/download** directly on the hosted project before launch.

---

## 4. Name.com DNS Checklist (`fleetwala.app`)

1. **Snapshot Existing Zone First:** Export/screenshot ALL current Name.com DNS records (`A`, `AAAA`, `CNAME`, `MX`, `TXT`, `NS`, `CAA`, `SRV`) before modifying anything.
2. **Preserve Existing Mail Records:** Never overwrite or delete `MX`, `SPF`, `DKIM`, or `DMARC` TXT records.
3. **Obtain Real Targets From Dashboards (Never Guess IPs/Hostnames):**
   - **Apex (`@` / `fleetwala.app`):** Add the exact `A` or `ANAME`/`ALIAS` value shown inside Vercel $\to$ Domains.
   - **WWW (`www`):** Add the exact `CNAME` value issued by Vercel and set `www.fleetwala.app` $\to$ `https://fleetwala.app` redirect.
   - **API (`api`):** Add a `CNAME` record for `api` pointing to the exact `*.onrender.com` target displayed inside Render $\to$ Custom Domains.
4. **CAA & TLS Verification:** Verify any existing `CAA` records permit Let's Encrypt (`0 issue "letsencrypt.org"`) / Google Trust Services, wait for certificate provisioning, and verify `dig`/`nslookup` and `https://api.fleetwala.app/api/healthz`.

---

## 5. Google OAuth & Supabase Auth URL Configuration (Keep Localhost Working)

Verified directly from [supabase.ts](file:///d:/Downloads/Fleet-Wala-Builder/Fleet-Wala-Builder/artifacts/fleetwala/src/lib/supabase.ts) (`getRedirectUrl`) and [App.tsx](file:///d:/Downloads/Fleet-Wala-Builder/Fleet-Wala-Builder/artifacts/fleetwala/src/App.tsx):
- `signInWithOAuth` redirects to `${window.location.origin}/` (Worker) or `${window.location.origin}/employer` (Employer) using PKCE (`detectSessionInUrl: true`). `/auth/callback` is also mounted in the SPA router.
- `signUpWithEmail` (`emailRedirectTo`) redirects to `${window.location.origin}/` or `/employer`.
- `resetPasswordForEmail` redirects to `${window.location.origin}/login?reset=true`; `AuthCallbackPage` routes `#type=recovery` / `PASSWORD_RECOVERY` events to `/reset-password`.

| Platform Setting | Exact Staging Values | Exact Production Values |
|---|---|---|
| **Supabase Site URL** | `https://<staging-frontend-domain>` *(or `http://localhost:3000` while local-only)* | `https://fleetwala.app` |
| **Supabase Allowed Redirect URLs** *(preserve localhost!)* | `https://<staging-frontend-domain>/**`<br>`http://localhost:3000/**` | `https://fleetwala.app/**`<br>`https://www.fleetwala.app/**`<br>`http://localhost:3000/**` |
| **Google Cloud Console $\to$ Authorized JavaScript Origins** | `https://<staging-frontend-domain>`<br>`https://jigbzsaaowtyaqhreplg.supabase.co`<br>`http://localhost:3000` | `https://fleetwala.app`<br>`https://www.fleetwala.app`<br>`https://<prod-ref>.supabase.co`<br>`http://localhost:3000` |
| **Google Cloud Console $\to$ Authorized Redirect URIs** | `https://jigbzsaaowtyaqhreplg.supabase.co/auth/v1/callback` | `https://<prod-ref>.supabase.co/auth/v1/callback` |

*(Per owner freeze, external Google Cloud Console and Supabase Auth URL settings were **not** modified yet.)*

---

## 6. Controlled Private Online Access Strategy (No Security-by-Obscurity)

`robots.txt` (`Disallow: /`), `noindex` meta tags, and unpublished URLs do **not** block unauthorized visitors or automated scanners. Enforce real server-side controls during private online staging:

1. **Edge Gate on Frontend (Vercel Deployment Protection):**
   - Enable **Vercel Authentication** (or Password Protection with Vercel team/invited tester accounts) in Vercel $\to$ Settings $\to$ Deployment Protection. Note: Vercel Authentication protects all SPA assets and routes at the CDN edge before page code loads while still permitting authenticated testers to complete Google OAuth redirects seamlessly.
2. **Backend Origin Gate (Render):**
   - Set `CORS_ORIGIN` strictly to your authorized staging origin(s) — unknown origins receive HTTP `403`.
3. **Server-Side Auth Gate (Supabase Auth):**
   - In Supabase Dashboard (`jigbzsaaowtyaqhreplg`) $\to$ Authentication $\to$ Sign In / Providers, temporarily **Disable public user sign-ups** (*Allow new users to sign up = OFF*). Existing verified accounts (**Worker**, **Employer `flipkart`**, **Admin `ankulpalwork@gmail.com`**) continue signing in cleanly via Google OAuth, while uninvited signups (`/signup` or arbitrary Google accounts) fail server-side in GoTrue.
4. **Private Marketplace Data Gate (Optional Strict Lock During Closed Testing):**
   - Remember `get_public_published_jobs()` grants `anon` read of approved public job listings. Keep `billing_settings.enabled = false` and optionally revoke `anon` execute on `get_public_published_jobs()` (or keep zero live jobs outside testing) if even Vercel Edge bypass links must not preview listings anonymously.

---

## 7. Mandatory Public Launch Blockers (Before Customer Launch on `fleetwala.app`)

Public customer launch remains **NO-GO / BLOCKED** until every item below is completed and verified:

1. **Clean Production Supabase Provisioning:** Provision dedicated `ap-south-1` project using `supabase/production/001_production_baseline_schema.sql`, link custom Auth domain/OAuth, verify hosted Auth/Storage/PgBouncer/RLS behavior.
2. **Automated Backup & Tested Restore Drill:** Enable daily automated backups + Point-in-Time Recovery (PITR) on Supabase and document a verified restore drill into a separate project.
3. **Business Legal & DPDP Act 2023 Disclosures:** Replace all `[OWNER ACTION REQUIRED]` placeholders in [legal.tsx](file:///d:/Downloads/Fleet-Wala-Builder/Fleet-Wala-Builder/artifacts/fleetwala/src/pages/legal.tsx) with registered company legal name, CIN/LLPIN, Bengaluru/Karnataka registered office address, designated Grievance Officer name, and legal counsel sign-off + retention schedule approval (`015`).
4. **Functional Domain Mail & Custom SMTP:** Configure active mailboxes (`support@fleetwala.app`, `grievance@fleetwala.app`, `noreply@fleetwala.app`), publish valid `SPF`, `DKIM`, and `DMARC` DNS records, and configure Custom SMTP in Supabase Auth to lift the default 3–4 confirmation emails/hour ceiling.
5. **Production Monitoring & Paid Server Tier:** Upgrade Render from `plan: free` to an always-on plan before customer traffic/webhooks, configure uptime alerting on `https://fleetwala.app` and `https://api.fleetwala.app/api/healthz`, and configure external log retention.
6. **Payment Gateway Decision & Integration:** Either confirm an explicit free-beta promotional phase (`billing_settings.enabled = false`) OR obtain Razorpay/Cashfree merchant KYC, store secrets exclusively in Render, implement HMAC-SHA256 webhook verification with `payment_events.provider_event_id` idempotency, and run sandbox/live payment verification.
7. **Final Live Online Security & E2E Check:** Re-verify TLS/DNS, security headers, CORS denial, Google OAuth across all 3 roles on `https://fleetwala.app`, and negative anonymous/cross-tenant RLS probes on the hosted production environment.
