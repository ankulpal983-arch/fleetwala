# FleetWala Launch Readiness & Open Decisions
**Document ID:** `docs/audit/08-launch-readiness-and-open-decisions.md`  
**Audit Date:** 2026-11-21  
**Auditor:** Antigravity Autonomous Orchestrator  
**Status:** COMPLETE (Phase 11)

---

## 1. Launch Readiness Checklist

| Readiness Gate | Status | Details / Actions Required |
| :--- | :---: | :--- |
| **Local Preview & Build** | **READY** | Vite dev server running on `http://localhost:3000/`. Production bundle builds cleanly via `pnpm build`. |
| **Pure Business Logic Tests** | **READY** | 12 automated unit tests passing (20/day cap, IST midnight, live status, anonymization, phone validation). |
| **Code Typecheck** | **READY** | `tsc -p tsconfig.json --noEmit` passes with 0 errors. |
| **Database Migrations** | **STAGED (UNEXECUTED)** | 15 migration files created in `supabase/migrations/`. Awaiting application to a disposable staging Supabase project. |
| **Supabase Authentication** | **BLOCKED (CONFIG)** | Supabase Phone Auth requires SMS provider selection and TRAI DLT template registration. |
| **Payment Integration** | **BLOCKED (SELECTION)** | ₹99 job posting / ₹10 contact unlock requires gateway selection (Razorpay vs Cashfree) and sandbox API credentials. |
| **Admin Provisioning** | **MANUAL (SECURE)** | Initial admin must be provisioned via SQL template into `admin_principals`, never via public client signup. |
| **Production Domain & SSL** | **PENDING** | Custom domain configuration, DNS records, and HTTPS termination. |

---

## 2. Environment Variable Matrix

| Variable Name | Exposure | Required Environment | Purpose |
| :--- | :--- | :--- | :--- |
| `PORT` | Build / Local | Development | Port for local Vite server (default: `3000`). |
| `BASE_PATH` | Build / Local | Development / Production | URL base path (default: `/`). |
| `VITE_SUPABASE_URL` | Browser-Public | Staging & Production | Supabase project URL (`https://<project-ref>.supabase.co`). |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Browser-Public | Staging & Production | Supabase public/anon publishable key. |
| `VITE_ENABLE_LIVE` | Browser-Public | Staging & Production | Feature flag (`true` to activate live portal; `false` keeps local pilot). |
| `SUPABASE_SERVICE_ROLE_KEY` | **SERVER-ONLY (SECRET)** | Edge / Webhook Server | For administrative RPCs and webhook validation. **NEVER expose to browser bundle.** |
| `PAYMENT_WEBHOOK_SECRET` | **SERVER-ONLY (SECRET)** | Edge / Webhook Server | HMAC signature verification for Razorpay/Cashfree webhook payloads. |
| `SMS_PROVIDER_API_KEY` | **SERVER-ONLY (SECRET)** | Supabase Dashboard | Configured directly in Supabase Auth provider settings. |

---

## 3. Open Decisions for the Platform Owner

Before moving from pilot preview to staging and live production:

1. **SMS Provider & TRAI DLT Compliance:**
   - Which SMS provider will be configured in Supabase Auth (Twilio, Gupshup, Exotel, Msg91)?
   - Has the company entity registered on an Indian telecom DLT portal (Jio, Airtel, Vi) for transactional OTP SMS templates?
2. **Payment Gateway Provider:**
   - Confirm preferred Indian payment processor: **Razorpay** (recommended for rapid UPI/card onboarding) or **Cashfree**?
   - Confirm pricing baseline: ₹99 per live job posting, ₹10 per candidate contact unlock.
3. **Employer Authentication Method:**
   - Default is Email Magic Link (`signInWithOtp({ email })`). Does the owner approve this, or prefer Email + Password with MFA?
4. **Initial Administrator Identification:**
   - Provide the email address or Auth UUID for the first trusted platform administrator so they can be provisioned into `admin_principals`.
5. **Approval to Execute Staging Migrations:**
   - Confirm when a disposable Supabase staging project has been created so the 15 SQL migrations can be safely verified.
