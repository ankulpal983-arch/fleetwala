# OWNER ACTION RUNBOOK — PRE-PRODUCTION CONVERSION

**Project:** FleetWala Logistics Marketplace  
**Document:** `docs/OWNER_ACTIONS_PREPRODUCTION.md`  
**Date:** 22 November 2026  
**Security Warning:** **NEVER PASTE SECRETS (SERVICE_ROLE_KEY, DATABASE PASSWORDS, OAUTH SECRETS) IN PUBLIC CHAT.**

---

## Action 1: Execute Consolidated Database Migration (5 Minutes)

You have already created a Supabase project, but the database tables and RLS policies have not yet been created.

1. Open your browser and navigate to the [Supabase Dashboard](https://supabase.com/dashboard).
2. Select your **FleetWala Staging** project.
3. In the left navigation menu, click on **SQL Editor**.
4. Click **+ New query**.
5. In your local repository, open the file:
   `supabase/migrations/consolidated_staging_migration.sql`
6. Copy the **entire contents** of this file and paste it into the Supabase SQL Editor.
7. Click the green **Run** button (or press `Ctrl + Enter`).
8. **Expected Result:**
   ```text
   Success. No rows returned.
   ```
   *Note: This creates all 27 tables, enables Row Level Security (RLS) on all tables, installs business RPC functions (`apply_to_job`, `discover_workers`, `submit_job`, `review_job`), sets up the private storage bucket `worker-private-documents`, and enforces least-privilege security.*

---

## Action 2: Obtain Staging API Keys & Set Local Environment (2 Minutes)

1. In your Supabase Dashboard, navigate to **Project Settings** (gear icon at the bottom of the left sidebar) -> **API**.
2. Copy the following values:
   - **Project URL** (e.g. `https://xyzabcdefg.supabase.co`)
   - **anon / public key** (safe to expose in the browser)
3. In your local repository (`D:\Downloads\Fleet-Wala-Builder\Fleet-Wala-Builder`), create or edit `.env.local`:
   ```bash
   # Frontend Configuration
   PORT=3000
   BASE_PATH=/
   VITE_SUPABASE_URL=https://YOUR-STAGING-PROJECT.supabase.co
   VITE_SUPABASE_PUBLISHABLE_KEY=eyJhbGciOi...YOUR-ANON-KEY
   
   # Enable Live Staging Mode
   VITE_ENABLE_LIVE=true
   ```
   *(Keep your `service_role` secret private; do not put it in `.env.local` or any `VITE_*` variable).*

---

## Action 3: Configure URL Redirects in Supabase (1 Minute)

1. In your Supabase Dashboard, go to **Authentication** -> **URL Configuration**.
2. Set **Site URL** to:
   `http://localhost:3000` (or your deployed staging URL `https://staging.fleetwala.com`)
3. Under **Redirect URLs**, add the following entries:
   - `http://localhost:3000/**`
   - `http://localhost:5000/**`
   - `https://staging.fleetwala.com/**`
4. Click **Save**.

---

## Action 4: Enable Google & GitHub OAuth Providers (10 Minutes)

### A. Google OAuth
1. Go to the [Google Cloud Console](https://console.cloud.google.com/) -> **APIs & Services** -> **Credentials**.
2. Click **Create Credentials** -> **OAuth client ID**.
3. Select **Web application**.
4. Under **Authorized redirect URIs**, add:
   `https://YOUR-STAGING-PROJECT.supabase.co/auth/v1/callback`
5. Copy your **Client ID** and **Client secret**.
6. In Supabase Dashboard, go to **Authentication** -> **Providers** -> **Google**:
   - Toggle **Enable Google provider** to ON.
   - Paste **Client ID** and **Client secret**.
   - Click **Save**.

### B. GitHub OAuth
1. Go to [GitHub Settings](https://github.com/settings/developers) -> **OAuth Apps** -> **New OAuth App**.
2. Application Name: `FleetWala Staging`
3. Homepage URL: `http://localhost:3000`
4. Authorization callback URL:
   `https://YOUR-STAGING-PROJECT.supabase.co/auth/v1/callback`
5. Click **Register application**.
6. Generate a **Client secret**.
7. In Supabase Dashboard, go to **Authentication** -> **Providers** -> **GitHub**:
   - Toggle **Enable GitHub provider** to ON.
   - Paste **Client ID** and **Client secret**.
   - Click **Save**.

---

## Action 5: Provision Your Initial Administrator Account (2 Minutes)

Because self-registration as an administrator is strictly blocked by PostgreSQL RLS (Owner Decision #3), you must provision your administrator account directly in the Supabase SQL Editor:

1. Sign up on FleetWala (`http://localhost:3000/login`) using your admin email address.
2. In Supabase Dashboard -> **Authentication** -> **Users**, locate your user and copy your **User UID** (UUID).
3. In Supabase Dashboard -> **SQL Editor**, run the following query:
   ```sql
   INSERT INTO public.admin_principals (user_id, provisioned_by, reason)
   VALUES (
     'YOUR-COPIED-USER-UUID-HERE',
     'Project Owner Out-of-Band Bootstrap',
     'Primary platform trust & safety administrator'
   );
   ```
4. Now, when you log into FleetWala, the `public.is_admin()` function will return `true`, granting you access to `/admin`, the job moderation queue, employer verification, and the system audit log.

---

## Action 6: Verification & Hand-off

Once Actions 1 through 5 are complete:
1. Restart your dev server or test the running Vite instance at `http://localhost:3000`.
2. Visit `/login` and sign in with Google or Email.
3. Test creating a job posting as an Employer (`/employer/jobs`).
4. Test reviewing the job as an Admin (`/admin/jobs`).
5. Test applying to the job as a Worker (`/`).
