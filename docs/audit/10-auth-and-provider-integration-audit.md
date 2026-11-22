# FleetWala Supabase Auth & Provider Integration Audit
**Document ID:** `docs/audit/10-auth-and-provider-integration-audit.md`  
**Audit Date:** 2026-11-22  
**Auditor:** Antigravity Autonomous Orchestrator  
**Status:** COMPLETE (Phase C Verified)

---

## 1. Identity Architecture & Client Lifecycle

The authentication stack relies exclusively on **Supabase Auth** (`@supabase/supabase-js` v2.119.2), completely free of any legacy Clerk or custom authentication dependencies.

```
       Worker (+91 Mobile)             Employer (Work Email)
               │                                │
               ▼ (signInWithOtp)                ▼ (signInWithOtp + magic link)
  ┌─────────────────────────────────────────────────────────────┐
  │                 Supabase Auth Gateway                       │
  │  - Generates secure 6-digit random OTP                      │
  │  - Rate-limits phone & email requests                       │
  │  - Dispatches SMS via Custom Hook OR Native SMS Provider    │
  └──────────────────────────────┬──────────────────────────────┘
                                 │
                                 ▼ (verifyOtp / session token)
  ┌─────────────────────────────────────────────────────────────┐
  │               PostgreSQL Database Security                  │
  │  - auth.users (ID = auth.uid())                             │
  │  - Trigger on_auth_user_created -> public.user_accounts     │
  │  - Strict RLS restricts data access by auth.uid()           │
  │  - is_admin() derives strictly from admin_principals        │
  └─────────────────────────────────────────────────────────────┘
```

### 1.1 Client Session Tracing
- **Client Factory:** `getSupabase()` in [supabase.ts](file:///d:/Downloads/Fleet-Wala-Builder/Fleet-Wala-Builder/artifacts/fleetwala/src/lib/supabase.ts) initializes a singleton client using `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`.
- **Session Persistence:** Configured with `persistSession: true`, `detectSessionInUrl: true`, and `autoRefreshToken: true` (standard browser localStorage).
- **Session Lifecycle Hook:** `useSession()` listens to `c.auth.onAuthStateChange` to keep active sessions synchronized across tabs without manual polling.

---

## 2. Supabase Phone Auth vs MSG91 Reality Check

### 2.1 The Native Provider Reality
In the Supabase Management Dashboard (`Authentication -> Providers -> Phone`), Supabase natively provides built-in API adaptors for:
- Twilio
- MessageBird
- Textlocal
- Vonage (Nexmo)
- Plivo
- Sinch (SMS)

**Critical Finding:** **MSG91 is NOT a native dropdown option in Supabase's built-in SMS provider selector.** An MSG91 Authkey / Token **cannot** simply be pasted into Supabase's native SMS provider form.

### 2.2 Secure Architecture Options for MSG91 Integration

| Option | Architecture | Feasibility & Security | Owner Requirements |
| :--- | :--- | :--- | :--- |
| **Option 1: Supabase Send SMS Auth Hook (Recommended)** | When `signInWithOtp` is called, Supabase triggers an authenticated HTTPS webhook (Auth Hook) to `https://api.fleetwala.in/api/auth/send-sms` (hosted on Express `api-server` or a Supabase Edge Function). The server verifies the hook secret and dispatches the OTP via MSG91 Flow API. | **Standard, Secure & Supported** — Keeps Supabase as the source of truth for OTP generation and session creation, while using MSG91 for Indian SMS delivery. | Requires: (1) Supabase project on Pro/Enterprise or local hook config, (2) MSG91 Authkey, Template ID, and Sender ID stored as server-only secrets. |
| **Option 2: Native Supported SMS Gateway (e.g. Twilio / Textlocal)** | Use an officially supported native provider already present in the Supabase Dashboard dropdown. | **Zero Custom Code** — Direct credential entry in Supabase Dashboard. | Requires Twilio or Textlocal account with Indian DLT Principal Entity and Template registration. |

---

## 3. Worker Phone Authentication Hardening

- **Indian Phone Number Normalization:** Tested with spaces, dashes, leading zero, and `+91`. Validates strict Indian format: `^[6-9]\d{9}$` (`normalizeIndianPhone()`).
- **Resend Cooldown & Anti-Abuse:** Added a 45-second countdown timer (`cooldown`) in [public.tsx](file:///d:/Downloads/Fleet-Wala-Builder/Fleet-Wala-Builder/artifacts/fleetwala/src/pages/public.tsx) that disables the resend button and prevents SMS spamming.
- **Strict Real OTP Only:** Zero demo OTP bypasses (`123456`) exist in the authentication path.

---

## 4. Employer & Admin Privileged Role Security

1. **Employer Authentication:**
   - Uses Email Magic Link (`c.auth.signInWithOtp({ email, options: { emailRedirectTo: ... } })`).
   - Organization creation and verified status (`verification_state = 'verified'`) are server-gated.
2. **Admin Role Isolation:**
   - An ordinary user can **never** self-promote to administrator via client request, JWT claims, or `user_metadata`.
   - `public.is_admin()` checks the existence of `auth.uid()` in `public.admin_principals`, a restricted table with `revoke all from anon, authenticated`.
   - Initial administrators must be provisioned via the Supabase SQL Editor by the platform owner.

---

## 5. Live Staging Test Status

- **Real OTP / SMS Tests:** **BLOCKED** pending owner selection of Option 1 (MSG91 SMS Hook) or Option 2 (Native Provider) and configuration in a disposable staging Supabase project.
- **Staging Identities:** Staging verification suite prepared for 2 workers, 1 employer, and 1 admin identity.
