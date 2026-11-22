# 16. Supabase Auth & OAuth Setup

**FleetWala Pre-Production Conversion**  
**Document:** `docs/audit/16-supabase-auth-oauth-setup.md`  
**Date:** 22 November 2026  
**Status:** Pre-Production Auth Configured (Live Staging Credentials Blocked)

---

## 1. Executive Summary & Architectural Decisions

Following **Owner Decision #2, #3, and #4**, FleetWala's authentication architecture has been overhauled:
1. **Supabase Auth as Single Identity Source:** All fake sessions, mock roles, and prospective Clerk integrations are rejected. Workers and Employers authenticate exclusively through Supabase Auth.
2. **First-Class Email + Password & OAuth (Google & GitHub):**
   - Workers and Employers can sign in or register with verified Email + Password.
   - Workers and Employers can sign in with one click via Google OAuth and GitHub OAuth.
   - PKCE flow (`flowType: 'pkce'`) is configured in `@supabase/supabase-js` client to prevent authorization code interception on web clients.
3. **Mobile Phone OTP / MSG91 / DLT Deferred:**
   - As mandated by Owner Decision #4, Mobile Phone OTP is **removed from active registration requirements**.
   - Phone OTP with SMS is labeled as "Deferred / Coming Soon in Production" in the UI to prevent any dependency on external SMS gateways (MSG91, DLT templates, TRAI regulations).
   - Phone numbers remain optional profile fields for contact verification after account creation.
4. **Admin Invite / Provisioning-Only Security:**
   - Under Owner Decision #3, administrators can **NEVER** self-register or toggle privileges via frontend UI.
   - Administrative privileges require explicit server-side presence in `public.admin_principals` tied to a verified Supabase Auth UUID (`auth.uid()`).
   - MFA (TOTP / Authenticator App) is required for privileged operations.

---

## 2. Environment Variable Architecture & Ownership

| Variable | Environment | Scope | Sensitivity | Description |
| :--- | :--- | :--- | :--- | :--- |
| `VITE_SUPABASE_URL` | Frontend (`fleetwala`) | Client-public | Public | URL of the Supabase project (e.g. `https://xyz.supabase.co`). |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Frontend (`fleetwala`) | Client-public | Public | Publishable/anon API key. Safe for browser bundles. Subject to PostgreSQL RLS. |
| `VITE_ENABLE_LIVE` | Frontend (`fleetwala`) | Client-public | Public | Boolean (`true`/`false`). When `false`, defaults to pilot/demo data. When `true`, enables live Supabase repository queries. |
| `SUPABASE_SERVICE_ROLE_KEY` | Express (`api-server`) | Server-only | **CRITICAL SECRET** | Supabase bypass key for administrative cron/moderation tasks. **NEVER** exposed to frontend (`VITE_*`). |
| `PAYMENT_WEBHOOK_SECRET` | Express (`api-server`) | Server-only | **CRITICAL SECRET** | Razorpay / Cashfree webhook signing secret (disabled in pre-prod). |
| `SMS_PROVIDER_API_KEY` | Express / Edge Hook | Server-only | **CRITICAL SECRET** | Future MSG91 auth key for SMS Auth Hook (deferred). |

---

## 3. Auth Helper API (`src/lib/supabase.ts`)

The Supabase client is configured with PKCE and session persistence:

```typescript
client = createClient(url, key, {
  auth: {
    persistSession: true,
    detectSessionInUrl: true,
    autoRefreshToken: true,
    flowType: 'pkce',
  },
});
```

### Implemented Methods:
1. `signInWithEmail(email, password)`: Authenticates user against `auth.users`.
2. `signUpWithEmail(email, password, role, fullName)`:
   - Registers user with `options.data = { role, full_name }`.
   - Triggers `fleetwala_auth_user_created` trigger in Postgres to automatically create `public.user_accounts(user_id)`.
   - Sends email confirmation link redirecting to `/` (Worker) or `/employer` (Employer).
3. `resetPasswordForEmail(email)`: Dispatches password reset email pointing to `/login?reset=true`.
4. `updateUserPassword(newPassword)`: Updates the password for the recovered session.
5. `signInWithOAuth(provider, targetRole)`:
   - Initiates OAuth redirect with Google or GitHub.
   - Enforces PKCE challenge.
   - Redirects to `${origin}${base}/` or `${origin}${base}/employer`.
6. `signOut()`: Clears local session and Supabase auth tokens.
7. `useSession()`: React hook subscribing to `onAuthStateChange`.

---

## 4. Google & GitHub OAuth Provider Configuration

To enable Google and GitHub OAuth in Supabase Staging:

### A. Redirect URLs (Supabase Dashboard -> Authentication -> URL Configuration)
* **Site URL:** `http://localhost:3000/` (for local development) / `https://staging.fleetwala.com/` (for staging)
* **Allowed Redirect URLs:**
  - `http://localhost:3000/**`
  - `http://localhost:5000/**`
  - `https://staging.fleetwala.com/**`

### B. Google Cloud Console Configuration
1. Go to [Google Cloud Console](https://console.cloud.google.com/) -> APIs & Services -> Credentials.
2. Create **OAuth 2.0 Client ID** (Web application).
3. Authorized JavaScript Origins:
   - `http://localhost:3000`
   - `https://YOUR-STAGING-PROJECT.supabase.co`
4. Authorized Redirect URIs:
   - `https://YOUR-STAGING-PROJECT.supabase.co/auth/v1/callback`
5. Copy **Client ID** and **Client Secret** into Supabase Dashboard -> Authentication -> Providers -> Google.

### C. GitHub Developer Settings Configuration
1. Go to [GitHub Settings](https://github.com/settings/developers) -> OAuth Apps -> New OAuth App.
2. Application Name: `FleetWala Staging`
3. Homepage URL: `https://staging.fleetwala.com` (or `http://localhost:3000`)
4. Authorization callback URL:
   - `https://YOUR-STAGING-PROJECT.supabase.co/auth/v1/callback`
5. Copy **Client ID** and **Client Secret** into Supabase Dashboard -> Authentication -> Providers -> GitHub.

---

## 5. Security & Risk Analysis

1. **Account Linking & Unverified Email Attack Defense:**
   - Supabase Auth prevents identity hijacking by disabling automatic email linking for unverified third-party OAuth providers unless `email_verified: true` is cryptographically signed by Google/GitHub.
   - Users cannot sign up with email and then have an unverified OAuth provider hijack their account without verification.
2. **Role Injection Prevention:**
   - Metadata passed in `signUp({ options: { data: { role } } })` is purely an onboarding hint.
   - Administrative privileges are strictly checked against `public.admin_principals` via `public.is_admin()`. An attacker editing client user metadata **cannot** acquire admin privileges or bypass PostgreSQL RLS.
   - Employer org memberships require active membership rows in `public.employer_memberships` created by verified org owners.
3. **No Service Role Key in Client Bundle:**
   - Static analysis confirmed: zero references to `SUPABASE_SERVICE_ROLE_KEY` in `artifacts/fleetwala`.
   - All client queries use `VITE_SUPABASE_PUBLISHABLE_KEY` and are constrained by 27 RLS policies.

---

## 6. Verification Status

| Component | Test Method | Status | Evidence |
| :--- | :--- | :--- | :--- |
| **Auth Client Scaffolding** | TypeScript Typecheck | **PASS** | `corepack pnpm --filter @workspace/fleetwala run typecheck` (0 errors) |
| **Login UI Redesign** | DOM / Component Render | **PASS** | Email+Password, OAuth buttons, Deferred SMS section |
| **Live Staging Auth** | Supabase Network Ping | **BLOCKED** | Awaiting owner staging project credentials (`VITE_SUPABASE_URL`) |
| **Google OAuth Live Flow** | Browser Callback | **BLOCKED** | Awaiting owner Google Cloud Client ID & Secret in Supabase |
| **GitHub OAuth Live Flow** | Browser Callback | **BLOCKED** | Awaiting owner GitHub OAuth App Client ID & Secret in Supabase |

---

## 7. Minimal Owner Action Checklist (Auth)

1. [ ] Log into [Supabase Dashboard](https://supabase.com/dashboard) -> Select your project.
2. [ ] Navigate to **Project Settings** -> **API**:
   - Copy **Project URL** into `VITE_SUPABASE_URL`.
   - Copy **anon / public key** into `VITE_SUPABASE_PUBLISHABLE_KEY`.
3. [ ] Under **Authentication** -> **Providers**:
   - Enable **Google** (paste Google Client ID & Secret).
   - Enable **GitHub** (paste GitHub Client ID & Secret).
4. [ ] Under **Authentication** -> **URL Configuration**:
   - Add `http://localhost:3000/**` to **Redirect URLs**.
