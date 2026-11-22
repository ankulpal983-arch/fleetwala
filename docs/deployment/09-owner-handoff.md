# FleetWala Pre-Production Owner Handoff & Cloud Launch Runbook

**Document:** `docs/deployment/09-owner-handoff.md`  
**Execution Timestamp:** 2026-11-22T18:56:50+05:30  
**Target Repository:** `https://github.com/ankulpal983-arch/fleetwala`  
**Development Branch:** `real-preproduction-conversion`  
**Supabase Reference:** `jigbzsaaowtyaqhreplg`  
**Author:** Antigravity Autonomous Engineering Orchestrator  

---

## 1. What Has Been Completed & Verified

1. **P0 Submit for Review Fix:**  
   - Added `updateLiveJobDraft()` to allow updating existing drafts without duplicating listings.
   - Upgraded `submit_job()` RPC via Migration `020` on remote Supabase with explicit validation, idempotency, and audit logging.
   - Connected `refreshLive()` in `JobDialog` so the employer listing view updates immediately upon submission.
2. **71/71 Automated Tests Passing:**  
   - All tests passing cleanly via `corepack pnpm test`.
3. **9/9 Browser Smoke Routes Verified:**  
   - Headless Chrome testing confirmed zero runtime exceptions, zero white screens across homepage, auth, onboarding, employer dashboard, and admin portal.
4. **Multi-Tenant Security & Discovery Alias:**  
   - Deployed Migration `021` adding `discover_candidates` alias and enforcing storage folder boundaries.
5. **Deployment Infrastructure Ready:**  
   - Created `vercel.json` with SPA routing rewrites and asset cache headers.
   - Created `render.yaml` with monorepo build commands and `0.0.0.0` host binding.

---

## 2. Actionable Owner Steps to Deploy to Cloud

### Step 1: Deploy Frontend on Vercel
1. Log into your [Vercel Dashboard](https://vercel.com/new).
2. Click **Add New...** $\to$ **Project** $\to$ Import `ankulpal983-arch/fleetwala`.
3. Configure Project Settings:
   - **Framework Preset:** `Vite`
   - **Root Directory:** Edit $\to$ choose `artifacts/fleetwala` (or leave `./` with root `vercel.json`)
   - **Build Command:** `pnpm run build`
   - **Output Directory:** `dist/public`
4. Add Environment Variables (names only):
   - `VITE_SUPABASE_URL` = `https://jigbzsaaowtyaqhreplg.supabase.co`
   - `VITE_SUPABASE_PUBLISHABLE_KEY` = *(your existing Supabase publishable anon key)*
   - `VITE_ENABLE_LIVE` = `true`
5. Click **Deploy**. Vercel will assign an HTTPS Preview URL (e.g. `https://fleetwala-*.vercel.app`).

---

### Step 2: Deploy Backend on Render
1. Log into your [Render Dashboard](https://dashboard.render.com/select-repo?type=web).
2. Select your repository: `ankulpal983-arch/fleetwala`.
3. Configure Web Service:
   - **Name:** `fleetwala-api`
   - **Branch:** `real-preproduction-conversion`
   - **Runtime:** `Node`
   - **Build Command:** `corepack enable && corepack pnpm install && corepack pnpm --filter @workspace/api-server run build`
   - **Start Command:** `corepack pnpm --filter @workspace/api-server run start`
   - **Plan:** `Free`
   - **Health Check Path:** `/api/healthz`
4. Add Environment Variables:
   - `PORT` = `5000`
   - `NODE_ENV` = `production`
   - `CORS_ORIGIN` = `https://fleetwala.vercel.app`
5. Click **Create Web Service**. Once deployed, Render will provide a URL (e.g. `https://fleetwala-api.onrender.com`).
6. *(Optional)* Add `VITE_API_URL` to Vercel pointing to this Render URL.

---

### Step 3: Update Supabase Redirect Allowlist
1. Open the [Supabase Dashboard](https://supabase.com/dashboard/project/jigbzsaaowtyaqhreplg).
2. Go to **Authentication** $\to$ **URL Configuration**.
3. Under **Redirect URLs**, ensure the following entries are present:
   - `http://localhost:3000/**`
   - `https://*.vercel.app/**`
   - `https://fleetwala.vercel.app/**`
4. Click **Save Changes**.

---

### Step 4: Optional Personal Admin Seat (If Desired)
If you wish to access the admin portal (`/admin`) using your personal Google account (`5733aa5f-ee59-4ed1-bc9d-9b6deb6b07b3`), execute the following query in the Supabase Dashboard SQL Editor:
```sql
INSERT INTO public.admin_principals (user_id, provisioned_by, provisioned_at, reason)
VALUES (
  '5733aa5f-ee59-4ed1-bc9d-9b6deb6b07b3',
  'project_owner_manual',
  now(),
  'Owner personal account admin access'
)
ON CONFLICT (user_id) DO NOTHING;
```

---

## 3. Owner Testing & UAT Instructions

Once your Vercel preview deployment is live:
1. Open your Vercel preview URL on your desktop and mobile browser.
2. Sign in with your Google account.
3. Navigate to **Employer $\to$ Jobs $\to$ New Job**:
   - Fill in job details $\to$ Click **Save draft** $\to$ Verify draft appears in the list.
   - Click the draft $\to$ Click **Submit for review** $\to$ Verify status transitions to `Pending review`.
4. Verify navigation to `/candidates` to view anonymized candidate cards.
5. Sign in as worker identity $\to$ Browse published jobs $\to$ Test applying.
