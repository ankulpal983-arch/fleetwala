# FleetWala Split Deployment Architecture & Environment Matrix

**Document:** `docs/deployment/01-architecture-and-env-matrix.md`  
**Execution Timestamp:** 2026-11-22T18:50:00+05:30  
**Phase:** Phase 5 — Split Deployment Architecture Design (Vercel + Render + Supabase)  
**Author:** Antigravity Autonomous Engineering Orchestrator  
**Status:** PASS — Verified Architecture & Production Specification  

---

## 1. Executive Summary & Platform Strategy

FleetWala is architected as a modern split-cloud SaaS application leveraging a single monorepo (`https://github.com/ankulpal983-arch/fleetwala`) with independent builds and decoupled service tiers:

```
                                  ┌──────────────────────────────────────────────┐
                                  │               End User Browser               │
                                  └───────┬──────────────────────────────┬───────┘
                                          │                              │
                     1. Static SPA Assets │                              │ 2. Direct Auth & Data
                        & HTML Routing    │                              │    (RLS Protected)
                                          ▼                              ▼
                 ┌──────────────────────────────────┐      ┌───────────────────────────────┐
                 │          Vercel Edge CDN         │      │       Supabase Managed        │
                 │      (artifacts/fleetwala)       │      │  (jigbzsaaowtyaqhreplg.co)   │
                 │                                  │      │                               │
                 │ • React 19 + Vite 7 SPA          │      │ • GoTrue Auth (Google OAuth)  │
                 │ • Tailwind CSS 4                 │      │ • PostgREST (Table RLS)       │
                 │ • Wouter Client Router           │      │ • PostgreSQL RPCs (Definer)   │
                 │ • SPA Deep-Link Rewrites         │      │ • Storage (Private Buckets)   │
                 └──────────────────────────────────┘      └───────────────▲───────────────┘
                                                                           │
                                                                           │ 3. Server-Side
                                                                           │    Privileged Operations
                                                                           │    & Webhooks
                                  ┌────────────────────────────────────────┴───────┐
                                  │            Render Web Service                  │
                                  │          (artifacts/api-server)                │
                                  │                                                │
                                  │ • Express 5 on Node.js 22                      │
                                  │ • Liveness Probe: /api/healthz                 │
                                  │ • Payment Webhook Handlers (Phase 10)          │
                                  │ • Zero Client Secrets in Frontend Bundle       │
                                  └────────────────────────────────────────────────┘
```

---

## 2. Environment Variable Matrix & Security Boundaries

Strict separation of privileges is maintained. Public client variables begin with `VITE_` and are bundled into client-side JavaScript. Privileged server secrets reside exclusively in the backend runtime and are never accessible to client code or committed to Git.

### 2.1 Vercel Frontend Environment Configuration (`artifacts/fleetwala`)

| Variable Name | Required | Target Environment | Visibility | Description / Purpose |
|:---|:---|:---|:---|:---|
| `VITE_SUPABASE_URL` | **Yes** | Preview & Production | Public | Supabase project API gateway: `https://jigbzsaaowtyaqhreplg.supabase.co` |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | **Yes** | Preview & Production | Public | Supabase publishable anon token (`sb_publishable_...`) |
| `VITE_ENABLE_LIVE` | **Yes** | Preview & Production | Public | Set to `true` to enable real Supabase database adapters |
| `VITE_API_URL` | Optional | Preview & Production | Public | URL of deployed Render API service (e.g. `https://fleetwala-api.onrender.com`) |

> [!CAUTION]
> **Strict Rule:** Never add `SUPABASE_SERVICE_ROLE_KEY`, database connection strings, or payment API secret keys to Vercel environment variables.

### 2.2 Render API Server Environment Configuration (`artifacts/api-server`)

| Variable Name | Required | Target Environment | Visibility | Description / Purpose |
|:---|:---|:---|:---|:---|
| `PORT` | **Yes** | Web Service Runtime | Internal | Port assigned by Render runtime (defaults to `5000` locally; Render injects dynamically) |
| `NODE_ENV` | **Yes** | Web Service Runtime | Internal | Set to `production` |
| `CORS_ORIGIN` | **Yes** | Web Service Runtime | Internal | Comma-separated list of allowed origins (e.g. `https://fleetwala.vercel.app,https://fleetwala-*-*.vercel.app`) |
| `SUPABASE_URL` | Optional | Web Service Runtime | Private | `https://jigbzsaaowtyaqhreplg.supabase.co` (for privileged backend tasks) |
| `SUPABASE_SERVICE_ROLE_KEY` | Optional | Web Service Runtime | Private Secret | Supabase service_role token (retained exclusively on Render) |
| `RAZORPAY_KEY_ID` | Future (P10)| Web Service Runtime | Public/Server | Razorpay public key ID (configured only when payments are authorized) |
| `RAZORPAY_KEY_SECRET` | Future (P10)| Web Service Runtime | Private Secret | Razorpay webhook signing secret |

### 2.3 Supabase Cloud Dashboard Settings (`jigbzsaaowtyaqhreplg`)

| Setting Area | Configured Value / Specification |
|:---|:---|
| **Site URL** | Production Vercel canonical URL (e.g. `https://fleetwala.vercel.app`) |
| **Redirect URLs** | `http://localhost:3000/**`, `https://*.vercel.app/**`, `https://fleetwala.vercel.app/**` |
| **Google Provider** | Client ID & Client Secret configured; Authorized Redirect URI: `https://jigbzsaaowtyaqhreplg.supabase.co/auth/v1/callback` |
| **JWT Expiry** | 3600 seconds (1 hour); auto-refresh via `@supabase/supabase-js` |

---

## 3. Monorepo Dependency & Build Reproducibility

The repository uses `pnpm` workspaces (`corepack pnpm`):
- Root workspace defines `pnpm-workspace.yaml`.
- Frontend package `@workspace/fleetwala` builds with `corepack pnpm --filter @workspace/fleetwala run build`.
- API Server package `@workspace/api-server` builds with `corepack pnpm --filter @workspace/api-server run build`.
- No cross-package pollution: each build compiles self-contained artifacts into their respective `dist/` directories.

---

## 4. Phase 5 Exit Gate Sign-Off

- [x] Clear architectural boundaries defined across Vercel, Render, and Supabase.
- [x] Environment variable responsibilities documented without credential leakage.
- [x] Service role and webhook secrets restricted exclusively to Render.
- [x] Monorepo build reproducibility validated.
