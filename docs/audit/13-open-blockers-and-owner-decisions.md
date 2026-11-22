# FleetWala Open Blockers & Owner Decisions Register
**Document ID:** `docs/audit/13-open-blockers-and-owner-decisions.md`  
**Audit Date:** 2026-11-22  
**Auditor:** Antigravity Autonomous Orchestrator  
**Status:** ACTION REQUIRED BY PLATFORM OWNER

---

## 1. External Integration Blockers

The local preview, build, unit test suite, and static security schema are 100% verified. The following items require external accounts, credentials, or business policy sign-off from the owner:

| Blocker ID | Domain | Nature of Blocker | Impact if Unresolved | Safe Interim State in Place |
| :---: | :--- | :--- | :--- | :--- |
| **BLK-01** | **SMS Gateway (MSG91)** | MSG91 is not a built-in dropdown provider in Supabase Auth. Requires either: (A) custom Send SMS Auth Hook, or (B) a natively supported provider (e.g. Twilio/Textlocal). | Real SMS OTPs cannot be received on actual physical mobile phones. | Resend cooldown timer (45s) and E.164 phone normalizer are verified in UI. Sign-in displays honest setup prompt when unconfigured. |
| **BLK-02** | **Payment Gateway** | Owner selection between Razorpay and Cashfree has not been confirmed, and sandbox API credentials are not set. | Real payments cannot be processed for ₹99 job posting and ₹10 candidate contact unlock. | Billing is strictly disabled by default (`billing_settings.enabled = false`). Unique DB constraint `(employer_id, worker_id)` prevents double-charging. |
| **BLK-03** | **Staging Database** | No disposable Supabase staging project URL and keys have been provided to execute the 15 migrations. | Real multi-tenant RLS policies cannot be tested against live PostgreSQL. | All 15 migrations have been audited, ordered, and documented in `docs/sql-execution-order.md`. |
| **BLK-04** | **TRAI DLT Entity Registration** | Indian telecom regulations mandate Principal Entity Registration and approved Content Templates for transactional OTPs. | SMS gateways will reject or block Indian OTP delivery without DLT registration. | Platform owner must register on an Indian DLT telecom portal (Jio, Airtel, Vi, Smartping). |

---

## 2. Owner Decisions Register

| Decision ID | Decision Topic | Recommended Approach | Alternative Options | Owner Decision Needed |
| :---: | :--- | :--- | :--- | :--- |
| **DEC-01** | **MSG91 Integration Architecture** | **Option 1: Supabase Custom SMS Hook** (`/api/auth/send-sms` on Express or Edge Function). Supabase generates OTP; our server dispatches via MSG91 Flow API. | **Option 2:** Use Twilio or Textlocal directly inside Supabase Dashboard dropdown. | Choose Option 1 (MSG91 via Auth Hook) or Option 2 (Native Provider). |
| **DEC-02** | **Payment Processor Selection** | **Razorpay:** Mature UPI, card, and netbanking support with standardized Indian payment flows. | **Cashfree:** Competitive pricing for Indian payouts and webhooks. | Confirm gateway selection and provide sandbox API keys through secure `.env.local`. |
| **DEC-03** | **Pricing Model Reconfirmation** | Keep PRD baseline: **₹99** per approved live job post, **₹10** per unique candidate contact unlock. | Free trial period or subscription credits. | Confirm whether ₹99 and ₹10 prices are approved for launch. |
| **DEC-04** | **Employer Login Method** | **Email Magic Link** (`signInWithOtp({ email })`). Passwordless, zero password credential leaks. | Email + Password + MFA for all employers. | Confirm whether Magic Link is approved or if passwords are required. |
| **DEC-05** | **Initial Administrator Identity** | Platform owner designates trusted email or Auth UUID for manual provisioning into `admin_principals`. | N/A (Admin must never be public signup). | Provide initial admin email address. |
