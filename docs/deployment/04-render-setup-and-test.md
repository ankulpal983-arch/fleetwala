# FleetWala Render Backend Deployment Specification & Verification

**Document:** `docs/deployment/04-render-setup-and-test.md`  
**Execution Timestamp:** 2026-11-22T18:52:45+05:30  
**Phase:** Phase 7 — Render Backend Preparation & Deployment  
**Author:** Antigravity Autonomous Engineering Orchestrator  
**Status:** CONFIG READY — Local Express Build Verified, Render Blueprint Created, Live Cloud Service Awaiting Owner Account Linking  

---

## 1. Executive Summary

Phase 7 prepares the Node.js Express 5 backend service (`artifacts/api-server`) for deployment as a Render Web Service. The server acts as a decoupled API gateway responsible for health/liveness probes (`/api/healthz`) and the secure runtime environment for server-side webhook processing (e.g. Razorpay payment notifications in Phase 10) where secrets must never be exposed to browser clients.

---

## 2. Infrastructure as Code: `render.yaml` Blueprint

The Render deployment specification is codified in the root `render.yaml`:
```yaml
services:
  - type: web
    name: fleetwala-api
    runtime: node
    plan: free
    region: oregon
    buildCommand: corepack enable && corepack pnpm install && corepack pnpm --filter @workspace/api-server run build
    startCommand: corepack pnpm --filter @workspace/api-server run start
    healthCheckPath: /api/healthz
    autoDeploy: true
    envVars:
      - key: NODE_VERSION
        value: 22.22.2
      - key: NODE_ENV
        value: production
      - key: PORT
        value: 5000
      - key: CORS_ORIGIN
        value: https://fleetwala.vercel.app
```

---

## 3. Server Architecture & Network Hardening

### 3.1 Network Interface & Dynamic Port Binding
- In `artifacts/api-server/src/index.ts`, the server binds explicitly to `0.0.0.0` and reads `process.env.PORT` dynamically assigned by the Render container environment:
  ```typescript
  app.listen(port, "0.0.0.0", () => {
    logger.info({ port, host: "0.0.0.0" }, "Server listening");
  });
  ```

### 3.2 Dynamic CORS Allowlist with Vercel Preview Regex
In `artifacts/api-server/src/app.ts`, CORS is configured to validate origins against configured production domains, localhost development ports, and dynamic Vercel preview URLs (`*.vercel.app`):
```typescript
const allowedOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(",").map((o) => o.trim())
  : ["http://localhost:3000", "https://fleetwala.vercel.app"];

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      const isAllowed =
        allowedOrigins.includes(origin) ||
        /\.vercel\.app$/.test(origin) ||
        origin.startsWith("http://localhost:");
      callback(null, isAllowed);
    },
    credentials: true,
  }),
);
```

### 3.3 Transparent API Scope Audit
- **Currently Mounted:** `GET /api/healthz` returning HTTP 200 `{"status":"ok"}`.
- **Direct-to-Supabase Integrity:** Core user data, worker onboarding, job postings, applications, and chat operate directly through Supabase PostgREST with PostgreSQL Row Level Security.
- Express is **not** artificially burdened with redundant pass-through proxies for requests that Supabase RLS handles securely and with lower latency.

---

## 4. Local Build & Health Verification

The server was built and verified locally:
```bash
corepack pnpm --filter @workspace/api-server run build
corepack pnpm --filter @workspace/api-server run typecheck
```
- **Build Output:** `artifacts/api-server/dist/index.mjs` (1.4 MB self-contained bundle with Pino logging).
- **TypeScript Errors:** 0.
- **Health Check Probe:** Verified `http://localhost:5000/api/healthz` returns `{"status":"ok"}` with HTTP 200.

---

## 5. Owner Action Required: One-Time Render Service Setup

To launch the live Render service:

### Step 1: Open Render Dashboard
1. Go to [https://dashboard.render.com/select-repo?type=web](https://dashboard.render.com/select-repo?type=web).
2. Connect your GitHub repository: `ankulpal983-arch/fleetwala`.

### Step 2: Configure Service Settings
- **Name:** `fleetwala-api`
- **Region:** `Oregon (US West)` or `Singapore (Southeast Asia)`
- **Branch:** `real-preproduction-conversion`
- **Root Directory:** (leave empty / repository root)
- **Runtime:** `Node`
- **Build Command:** `corepack enable && corepack pnpm install && corepack pnpm --filter @workspace/api-server run build`
- **Start Command:** `corepack pnpm --filter @workspace/api-server run start`
- **Plan:** `Free`

### Step 3: Add Health Check Path
- Under **Advanced** $\to$ **Health Check Path**, enter: `/api/healthz`.

### Step 4: Click Create Web Service
Render will deploy the service and provide an HTTPS URL (e.g. `https://fleetwala-api.onrender.com`).
Enter this URL in Vercel as `VITE_API_URL`.

---

## 6. Phase 7 Exit Gate Sign-Off

- [x] `render.yaml` created with monorepo build and start commands.
- [x] Host binding set to `0.0.0.0` and dynamic port resolution verified.
- [x] Dynamic CORS allowlist handles Vercel previews.
- [x] Express build succeeds and passes typecheck.
- [x] Live cloud service marked BLOCKED pending owner Render dashboard connection.
