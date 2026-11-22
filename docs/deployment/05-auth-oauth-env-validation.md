# FleetWala Supabase Auth & Cloud Environment Configuration

**Document:** `docs/deployment/05-auth-oauth-env-validation.md`  
**Execution Timestamp:** 2026-11-22T18:53:50+05:30  
**Phase:** Phase 8 — Supabase Auth & Cloud Environment for Deployed Origins  
**Author:** Antigravity Autonomous Engineering Orchestrator  
**Status:** PASS — Dynamic Origin Resolution Verified, Google OAuth Confirmed, Redirect Allowlist Documented  

---

## 1. Executive Summary

Phase 8 audits and validates authentication redirects, cross-origin resource sharing (CORS), Content Security Policies (CSP), and OAuth identity provider callbacks across local, Vercel preview, and production environments.

The frontend client dynamically derives callback URLs using `window.location.origin`, eliminating hardcoded origins and ensuring that redirects function identically across `localhost:3000`, dynamic Vercel branch previews (`*.vercel.app`), and custom production domains.

---

## 2. Supabase URL Configuration & Redirect Allowlist

In the Supabase Management Dashboard for project `jigbzsaaowtyaqhreplg`:

### 2.1 Navigation Path
**Authentication $\to$ URL Configuration**

### 2.2 Site URL & Wildcard Redirect Matrix

| Field | Configured Setting | Purpose / Coverage |
|:---|:---|:---|
| **Site URL** | `https://fleetwala.vercel.app` (or Vercel preview URL) | Default fallback origin for auth email confirmation and OAuth completions |
| **Redirect URLs** | `http://localhost:3000/**` | Local development and smoke testing |
| | `https://*.vercel.app/**` | Wildcard support for all Vercel feature branch and pull request preview deployments |
| | `https://fleetwala.vercel.app/**` | Canonical production domain |

> [!TIP]
> The wildcard entry `https://*.vercel.app/**` ensures that every Vercel preview deployment automatically satisfies Supabase's redirect origin validation without requiring manual URL updates for every Git commit.

---

## 3. Google OAuth Identity Provider Configuration

The owner has already configured Google OAuth in Supabase project `jigbzsaaowtyaqhreplg`.

### Authorized Callback Architecture:
```
1. User clicks "Sign in with Google" in Vercel SPA
         │
         ▼
2. Browser redirects to Supabase GoTrue Auth:
   https://jigbzsaaowtyaqhreplg.supabase.co/auth/v1/authorize?provider=google&redirectTo=https://<origin>/employer
         │
         ▼
3. Supabase redirects to Google Accounts:
   accounts.google.com/o/oauth2/v2/auth
         │
         ▼
4. Google returns code to Supabase Callback:
   https://jigbzsaaowtyaqhreplg.supabase.co/auth/v1/callback
         │
         ▼
5. Supabase exchanges token, creates session, and redirects to:
   https://<origin>/employer#access_token=...&refresh_token=...
         │
         ▼
6. FleetWala Session Provider hydrates user & routes to role dashboard
```

- **Google Cloud Console Settings:**
  - **Authorized JavaScript Origins:**
    - `https://jigbzsaaowtyaqhreplg.supabase.co`
    - `https://fleetwala.vercel.app`
    - `http://localhost:3000`
  - **Authorized Redirect URIs:**
    - `https://jigbzsaaowtyaqhreplg.supabase.co/auth/v1/callback`

---

## 4. Authentication Method Status Matrix

| Method | Production Status | Behavioral Guarantee / Known Constraints |
|:---|:---|:---|
| **Google OAuth** | **PASS / OPERATIONAL** | Verified by owner. Immediate session issuance; bypasses email rate limits. |
| **Email + Password** | **PASS / RATE-LIMITED** | Uses real Supabase Auth. Subject to Supabase free-tier rate limit (~3 emails/hr). Handled gracefully by `formatAuthError` with actionable user guidance. |
| **Custom SMTP** | **READY / RUNBOOK READY** | Runbook prepared in Audit Doc 28 for Resend/SendGrid/Brevo. Custom SMTP removes email rate limits once custom domain is provisioned. |
| **Mobile Phone OTP** | **DEFERRED** | Deferred per owner confirmed decision. API stubs preserved for future MSG91/SMS gateway activation. |

---

## 5. Security & Browser Origin Audit

1. **No Localhost Leaks in Production Bundles:**  
   Vite client bundle uses `window.location.origin` for runtime redirects. Localhost addresses only appear as fallbacks in development server proxies.
2. **Session Persistence:**  
   Tokens are stored in `localStorage` under key `sb-jigbzsaaowtyaqhreplg-auth-token` and automatically refreshed by `@supabase/supabase-js`.
3. **Logout & Session Termination:**  
   `signOut()` revokes Supabase session tokens and clears all cached role states.

---

## 6. Phase 8 Exit Gate Sign-Off

- [x] Dynamic redirect URL generation verified.
- [x] Supabase URL configuration and wildcard patterns documented.
- [x] Google OAuth flow verified end-to-end.
- [x] Email rate limits labeled accurately without demo bypasses.
