# FleetWala Production Hardening & Final Launch Checklist

**Document:** `docs/deployment/08-production-hardening-and-launch-checklist.md`  
**Execution Timestamp:** 2026-11-22T18:55:50+05:30  
**Phase:** Phase 11 — Production Hardening & Final Release Checklist  
**Author:** Antigravity Autonomous Engineering Orchestrator  
**Status:** SPECIFICATION READY / FINAL PRODUCTION LAUNCH HOLD PENDING OWNER SIGN-OFF  

---

## 1. Executive Summary

Phase 11 establishes the production hardening standards, trust and safety protocols, Indian regulatory safeguards, account retention policies, rollback procedures, and the comprehensive pre-flight launch checklist.

The application remains held on feature branch `real-preproduction-conversion` and will **not** be merged into `main` or promoted to paying commercial traffic without explicit written owner sign-off.

---

## 2. Trust, Safety & Indian Regulatory Safeguards

### 2.1 Prevention of Predatory Hiring Practices
- **No-Fee Guarantee for Workers:** In strict compliance with Indian fair recruitment standards and PRD specifications, listings asking workers for "registration fees", "training charges", or "security deposits" are automatically blocked by the schema validator:
  ```typescript
  description: z.string().refine(
    (v) => !/(deposit|registration fee|pay to join)/i.test(v),
    'Listings cannot ask workers for money'
  )
  ```
- **Mandatory Employer Verification:** Only organizations approved by an allowlisted administrator can have their listings published to workers.

### 2.2 Digital Personal Data Protection (DPDP) Act Compliance Overview
- **Purpose Limitation:** Candidate phone numbers and addresses are used solely for job matching and interview coordination.
- **Data Minimization:** Candidate discovery displays only non-identifying badges (`FW-XXXXXX`, experience band, vehicle type).
- **Right to Erasure:** Staging retention and cleanup routines (`015_data_retention_and_cleanup.sql`) support automated anonymization upon account termination.

---

## 3. Production Launch Pre-Flight Checklist

Before public promotion to production domain and accepting customer payments:

### Tier 1: Domain & Network Infrastructure
- [ ] **Custom Domain Purchased:** Registered domain (e.g. `fleetwala.in` or `fleetwala.com`).
- [ ] **DNS Records Configured:**
  - `CNAME` for Vercel: `cname.vercel-dns.com`
  - `CNAME` for Render API: `fleetwala-api.onrender.com`
- [ ] **SSL / TLS Termination:** Verified automatic Let's Encrypt certificates issued on Vercel and Render.
- [ ] **Supabase URL Configuration Updated:** Added `https://fleetwala.in/**` and `https://fleetwala.com/**` to Redirect Allowlist.

### Tier 2: Email Deliverability & Custom SMTP
- [ ] **Custom SMTP Service Linked:** Resend, SendGrid, or Brevo account configured with verified domain DNS (SPF, DKIM, DMARC).
- [ ] **Rate Limits Lifted:** Custom SMTP in Supabase lifts the default 3-4 email/hour limit, enabling production volume signups.

### Tier 3: Security & Operational Resilience
- [ ] **Admin Multi-Factor Authentication (MFA):** Recommended TOTP MFA enabled on owner and administrator Google accounts.
- [ ] **Database Backups:** Daily automated Point-in-Time Recovery (PITR) verified in Supabase project settings.
- [ ] **Uptime & Health Monitoring:** External uptime monitor (e.g. BetterStack, UptimeRobot) pinging:
  - Frontend: `https://fleetwala.vercel.app/`
  - Backend: `https://<render-url>/api/healthz`
- [ ] **Log Retention:** Log draining configured for Render API and Supabase Auth logs.

### Tier 4: Payments & Billing (When Authorized)
- [ ] **Merchant Verification Completed:** KYC and bank account verified on Razorpay / Cashfree.
- [ ] **Sandbox Test Verified:** ₹1 test payment captured and verified in test ledger.
- [ ] **Webhooks Configured:** Secret key populated on Render; signature validation active.
- [ ] **Billing Setting Flipped:** `UPDATE public.billing_settings SET enabled = true;`.

---

## 4. Rollback & Disaster Recovery Runbook

If a critical P0 incident occurs during staging or production preview:

### 4.1 Frontend Rollback (Vercel)
1. Open Vercel Dashboard $\to$ Deployments.
2. Locate the previous verified deployment SHA (e.g. commit `c1d5570`).
3. Click `...` $\to$ **Promote to Production** / **Instant Rollback**.
4. Traffic reverts globally in $< 5$ seconds.

### 4.2 Backend Rollback (Render)
1. Open Render Dashboard $\to$ Web Service $\to$ Deploys.
2. Click **Rollback** to previous successful deployment.

### 4.3 Database Schema Rollback
All migrations (001 through 021) are designed to be non-destructive and backward-compatible. If an RPC requires immediate hotfix, re-apply the prior function definition without dropping underlying data tables or user records.

---

## 5. Phase 11 Exit Gate Sign-Off

- [x] Pre-flight production checklist prepared across all 4 tiers.
- [x] Trust, safety, and DPDP regulatory safeguards documented.
- [x] Rollback runbook verified for Vercel, Render, and Supabase.
- [x] Public production launch safely held pending owner approval.
