# FleetWala Production Environment Variable Matrix

**Document:** `docs/deployment/12-production-environment-variable-matrix.md`  
**Audit Date:** 2026-11-26  
**Phases:** Phases 10, 11 & 13

---

## 1. Vercel Frontend Variables (`@workspace/fleetwala`)

> [!CAUTION]
> Every variable prefixed with `VITE_` is statically inlined by Vite (`vite.config.ts`) into client JavaScript assets (`dist/public/assets/*.js`). **NEVER** store `SUPABASE_SERVICE_ROLE_KEY`, Postgres connection strings, SMTP credentials, or payment secrets in Vercel.

| Variable | Environments | Visibility | Required | Value / Guidance |
|---|---|---|---|---|
| `VITE_SUPABASE_URL` | Preview, Production | Public (Browser) | **Yes** | `https://<target-supabase-ref>.supabase.co` |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Preview, Production | Public (Browser) | **Yes** | Supabase `sb_publishable_...` / anon key |
| `VITE_ENABLE_LIVE` | Preview, Production | Public (Browser) | **Yes** | `true` |
| `VITE_API_URL` | Preview, Production | Public (Browser) | Recommended | `https://api.fleetwala.app` *(or staging Render URL in Preview)* |
| `BASE_PATH` | Preview, Production | Build-time | No | Defaults to `/` |

---

## 2. Render Backend API Variables (`@workspace/api-server`)

Configure in Render Service $\to$ Environment (synced partially via `render.yaml`, with secret keys added only inside Render's encrypted Environment UI):

| Variable | Visibility | Required | Default / Value | Notes |
|---|---|---|---|---|
| `NODE_VERSION` | Plain (`render.yaml`) | **Yes** | `22.22.2` | Matches verified local LTS runtime |
| `NODE_ENV` | Plain (`render.yaml`) | **Yes** | `production` | Enables HSTS header & production JSON pino logs |
| `PORT` | Internal (`render.yaml`) | **Yes** | `5000` (Render may inject dynamically) | Validated integer `1..65535` at startup |
| `CORS_ORIGIN` | Plain (`render.yaml`) | **Yes** | `https://fleetwala.app,https://www.fleetwala.app` | Strict comma-separated allowlist; unknown origins fail closed with HTTP 403 |
| `API_RATE_LIMIT_PER_MIN` | Plain (Optional) | No | `120` | Sliding-window max requests/min/IP |
| `LOG_LEVEL` | Plain (Optional) | No | `info` | Redacts `authorization` & `cookie` headers automatically |
| `SUPABASE_URL` | Secret/Env (When backend Supabase client used) | Optional now / **Yes later** | `https://<target-supabase-ref>.supabase.co` | Server-side API calls & webhooks |
| `SUPABASE_SERVICE_ROLE_KEY` | **Private Secret** | Optional now / **Yes later** | *(Encrypted secret in Render only)* | **NEVER** commit to Git or place in frontend env |
| `PAYMENT_WEBHOOK_SECRET` | **Private Secret** | Future (Phase 14) | *(Disabled until authorized)* | Razorpay/Cashfree HMAC verification secret |
| `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` | Server / **Private Secret** | Future (Phase 14) | *(Disabled until authorized)* | Activated only upon owner payment sign-off |

---

## 3. Local Development Environment (`.env.local`, gitignored)

Verified present at `D:\Downloads\Fleet-Wala-Builder\Fleet-Wala-Builder\.env.local` (untracked & ignored by `.gitignore`):
- `PORT=3000`
- `BASE_PATH=/`
- `VITE_SUPABASE_URL` (length 40 chars — Supabase `jigbzsaaowtyaqhreplg`)
- `VITE_SUPABASE_PUBLISHABLE_KEY` (length 46 chars)
- `VITE_ENABLE_LIVE=true`

`.env.example` contains placeholder templates only and zero real credentials.
