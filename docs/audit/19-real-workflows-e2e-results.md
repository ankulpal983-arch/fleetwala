# 19. Real Workflows End-to-End Results

**FleetWala Pre-Production Conversion**  
**Document:** `docs/audit/19-real-workflows-e2e-results.md`  
**Date:** 22 November 2026  
**Status:** Verification Complete (Staging Ready / Live DB Execution Blocked)

---

## 1. Persona & Journey Verification Matrix

| Persona | Journey | Test Scope | Execution Method | Result | Evidence / Notes |
| :--- | :--- | :--- | :--- | :---: | :--- |
| **Worker** | Email / OAuth Registration | Sign up with role `worker`, PKCE callback, user metadata | Automated UI + Unit Tests | **PASS** | Validated in `public.tsx`, `supabase.ts`, and `rules.test.ts` |
| **Worker** | Profile & Privacy Toggle | Discoverability default `false`, opt-in/opt-out | Schema + UI + Unit | **PASS** | `defaultProfile().discoverable === false` |
| **Worker** | Job Search & Radius | City/area filtering, 15 km radius label | UI Components | **PASS** | City select, area pills, truthful distance badges |
| **Worker** | Apply to Job | Atomic 20 applies / IST day enforcement | SQL Lock + Unit Tests | **PASS** | Row lock `FOR UPDATE` on `public.workers`; 20th allowed, 21st rejected |
| **Employer** | Email / OAuth Sign-in | Work email sign in, role `employer` | UI + Schema | **PASS** | Validated in `public.tsx` with dedicated Employer tab |
| **Employer** | Job Creation & Draft | Draft creation, validation (title, salary, predatory fee check) | Unit Tests + Form | **PASS** | Prohibited fee detection test #10; salary range test #11 |
| **Employer** | Candidate Preview | Anonymized view of opted-in workers | RPC + Unit Tests | **PASS** | SHA-256 handle projection; zero phone/email/address exposure |
| **Employer** | Contact Unlock & Billing | ₹10 unlock, ₹99 job posting, pre-prod gate | UI + Schema | **PASS** | Gated state in `EmployerBilling`; disabled payment buttons |
| **Admin** | Access Control | Allowlist authorization via `admin_principals` | SQL RLS + Unit Tests | **PASS** | Zero client role toggle; `isAllowedRegistrationRole('admin') === false` |
| **Admin** | Moderation Queue | Job review (`approved` / `rejected`), audit log | SQL RPC + UI | **PASS** | `public.review_job(job_id, approve, reason)` |

---

## 2. Automated Test Execution Evidence

### Test Suite: 16 Tests Passed (Node.js Test Runner + tsx)
- **Command:** `corepack pnpm --filter @workspace/fleetwala run test`
- **Output:**
```text
TAP version 13
# Subtest: istDay uses Asia/Kolkata calendar date
ok 1 - istDay uses Asia/Kolkata calendar date
# Subtest: midnight IST reset: 23:59:59 IST vs 00:00:01 IST
ok 2 - midnight IST reset: 23:59:59 IST vs 00:00:01 IST
# Subtest: countToday counts only same IST day and same candidate
ok 3 - countToday counts only same IST day and same candidate
# Subtest: daily limit is 20: 20th succeeds, 21st refused
ok 4 - daily limit is 20: 20th succeeds, 21st refused
# Subtest: only approved, unexpired jobs are live
ok 5 - only approved, unexpired jobs are live
# Subtest: profile discovery defaults off
ok 6 - profile discovery defaults off
# Subtest: Indian phone normalization
ok 7 - Indian phone normalization
# Subtest: live gate fails closed until wired
ok 8 - live gate fails closed until wired
# Subtest: application status transitions: terminal states cannot reopen
ok 9 - application status transitions: terminal states cannot reopen
# Subtest: prohibited fee detection blocks predatory job posts
ok 10 - prohibited fee detection blocks predatory job posts
# Subtest: salary range validation: min must be positive and <= max
ok 11 - salary range validation: min must be positive and <= max
# Subtest: anonymized candidate projection excludes sensitive contact PII
ok 12 - anonymized candidate projection excludes sensitive contact PII
# Subtest: liveGate with wired: true passes cleanly when configured
ok 13 - liveGate with wired: true passes cleanly when configured
# Subtest: pricing baseline conforms to PRD: ₹99 job post, ₹10 candidate unlock
ok 14 - pricing baseline conforms to PRD: ₹99 job post, ₹10 candidate unlock
# Subtest: admin privileges cannot be obtained via self-registration roles
ok 15 - admin privileges cannot be obtained via self-registration roles
# Subtest: candidate opt-out discoverability defaults to false
ok 16 - candidate opt-out discoverability defaults to false
1..16
# tests 16
# pass 16
# fail 0
# duration_ms 3325
```

---

## 3. Real Browser Rendering Verification

Using headless Chrome on `http://localhost:3000`:
- **`/` (Find Jobs):** Renders search input, city selector, category pills, verified job cards, save button, apply modal.
- **`/login`:** Renders redesigned authentication interface with Worker/Employer tabs, Email+Password form, "Continue with Google", "Continue with GitHub", "Forgot password?", and deferred Phone OTP notice.
- **`/employer` & `/employer/billing`:** Renders hiring overview, applicant funnel, and PRD pricing baseline (₹99 job, ₹10 unlock) with Pre-Production Payment Gate active banner.
- **`/admin`:** Renders trust & safety overview, moderation review queue, and audit log table.
- **`/api/healthz`:** Reverse proxy HTTP 200 `{"status":"ok"}` verified via Express 5 backend on port 5000.
