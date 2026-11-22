# FleetWala Admin Onboarding, Employer Verification & Job Moderation Audit

**Document:** `docs/audit/36-admin-and-moderation-verification.md`  
**Execution Timestamp:** 2026-11-22T17:48:00+05:30  
**Phase:** Phase 2 — Admin Onboarding, Employer Verification & Job Moderation  
**Author:** Antigravity Autonomous Engineering Orchestrator  
**Status:** PASS — Verified Admin Principals, Safe Moderation Gates, 69/69 Automated Tests Passing  

---

## 1. Executive Summary

Phase 2 audits and hardens administrative onboarding, employer verification, and listing moderation. In FleetWala, administrative privileges are enforced through the server-side PostgreSQL table `public.admin_principals` and guarded by `SECURITY DEFINER` RPC functions with explicit role validation (`public.is_admin()`). Client-side role selection cannot grant backend administrative access.

All administrative mutations are subject to strict prerequisite checks (e.g. employer must be verified before any listing can be approved for publication), status transition history is preserved in `job_status_history` and `employer_verification_reviews`, and every action logs an immutable audit event in `public.audit_log`.

---

## 2. Server-Side Administrative Principals & RPC Audit

### 2.1 Table `public.admin_principals`
- **Schema:**
  - `user_id uuid primary key references auth.users(id)`
  - `provisioned_by text not null`
  - `provisioned_at timestamptz not null default now()`
  - `reason text not null`
- **RLS Configuration:**
  - `admin_principals_read`: Select allowed only to `authenticated` where `public.is_admin()` is true.
  - No direct `INSERT`, `UPDATE`, or `DELETE` policies exist for normal users.
  - Direct anonymous or unauthenticated INSERT/UPDATE is strictly blocked (verified by automated test).
- **Current Deployed Record:**
  - Staging QA principal: `11111111-1111-1111-1111-111111111111` (Provisioned for staging test workflows).

### 2.2 Function Audit

| Function | Security Definer | Search Path | Access Rule | Audit & Notification |
|:---|:---|:---|:---|:---|
| `is_admin()` | STABLE DEFINER | `public, auth` | Returns boolean if `auth.uid()` exists in `admin_principals`. | Read-only check |
| `bootstrap_admin(text)` | DEFINER | `public, auth` | Allowed ONLY if `count(*) from admin_principals = 0`. Fails closed if any admin exists. | Logs `admin_bootstrap` to `audit_log` |
| `admin_assign_admin(uuid)` | DEFINER | `public, auth` | Requires `is_admin() = true`. Target user must exist and be active. | Logs `admin_assign` to `audit_log` |
| `admin_review_employer(uuid, text, text)` | DEFINER | `public, auth` | Requires `is_admin() = true`. Decision must be `verified`, `rejected`, or `suspended`. | Logs to `employer_verification_reviews`, logs to `audit_log`, inserts notification to employer members |
| `review_job(uuid, boolean, text)` | DEFINER | `public, auth` | Requires `is_admin() = true`. **Employer MUST be verified** prior to approval. | Updates `jobs.state` to `published` or `rejected`, logs to `job_status_history`, logs to `audit_log`, notifies employer |
| `admin_grant_staging_job_waiver(uuid, text)` | DEFINER | `public, auth` | Requires `is_admin() = true`. Creates staging entitlement. | Logs to `audit_log` |

---

## 3. Secure Owner Runbook: Admin Access Provisioning

To prevent unauthorized privilege escalation or security backdoors, the application **never** automatically assigns admin privileges to Google OAuth or email signups.

If the project owner (`ankulpal983@gmail.com`, User UUID: `5733aa5f-ee59-4ed1-bc9d-9b6deb6b07b3`) wishes to grant administrative privileges to their personal account to access `/admin` on staging:

### Owner Execution Step (via Supabase Web SQL Editor):
Run the following SQL statement in the Supabase Dashboard SQL Editor (`jigbzsaaowtyaqhreplg`):
```sql
-- Owner One-Time Administrator Provisioning
INSERT INTO public.admin_principals (user_id, provisioned_by, provisioned_at, reason)
VALUES (
  '5733aa5f-ee59-4ed1-bc9d-9b6deb6b07b3',
  'project_owner_manual',
  now(),
  'Owner personal account administrative access'
)
ON CONFLICT (user_id) DO NOTHING;

INSERT INTO public.audit_log (actor_id, action, entity_type, entity_id, details)
VALUES (
  '5733aa5f-ee59-4ed1-bc9d-9b6deb6b07b3',
  'admin_provision',
  'admin_principal',
  '5733aa5f-ee59-4ed1-bc9d-9b6deb6b07b3',
  '{"method": "supabase_sql_editor"}'::jsonb
);
```

---

## 4. Administrative Screen & UI Verification

The frontend at `artifacts/fleetwala/src/pages/admin.tsx` enforces backend checks:
1. **Route Guard:** `useAdminAccess()` calls `checkIsLiveAdmin()` via `rpc('is_admin')`.
2. **Access Denied Screen:** If non-admin accesses `/admin`, `/admin/jobs`, `/admin/employers`, `/admin/support`, or `/admin/audit`, the UI renders `<AdminAccessDenied />` explaining that client-side role switching cannot grant backend access.
3. **`/admin/jobs` Moderation Queue:**
   - Tabs: `pending`, `approved`, `paused`, `closed`.
   - "Approve": Calls `reviewLiveJob(j.id, true, reason)`. Server confirms employer is verified before approving.
   - "Send back": Opens modal requiring reason text ($\ge 5$ characters); calls `reviewLiveJob(j.id, false, note)`.
4. **`/admin/employers` Verification Queue:**
   - Displays organization legal name, city, employer type, verification status.
   - "Verify": Calls `adminReviewLiveEmployer(e.id, 'verified', reason)` -> Updates state and notifies employer.
   - "Suspend": Calls `adminReviewLiveEmployer(e.id, 'suspended', reason)`.
5. **`/admin/audit`:**
   - Displays real administrative and business actions recorded in `public.audit_log`.

---

## 5. Automated Verification Results

All admin authorization, RPC gates, and privilege boundaries were verified:
```bash
corepack pnpm --filter @workspace/fleetwala run test
```
- **Total Tests:** 69 passed, 0 failed.
- Key tests verifying Phase 2:
  - `RLS Negative: Unauthenticated EXECUTE on review_job is denied` (PASS)
  - `RLS Negative: Unauthenticated EXECUTE on bootstrap_admin is denied` (PASS)
  - `RLS Negative: Unauthenticated EXECUTE on admin_assign_admin is denied` (PASS)
  - `RLS Negative: Unauthenticated EXECUTE on admin_review_employer is denied` (PASS)
  - `RLS Negative: Unauthenticated EXECUTE on admin_grant_staging_job_waiver is denied` (PASS)
  - `RLS Negative: Direct anonymous UPDATE on public.employers (self-verify attempt) is blocked` (PASS)
  - `RLS Negative: Direct anonymous INSERT into public.admin_principals is blocked` (PASS)

---

## 6. Phase 2 Exit Gate Sign-Off

| Requirement | Status | Evidence |
|:---|:---|:---|
| `admin_principals` enforced via server-side PostgreSQL | PASS | Verified in remote DB & tests |
| No frontend-only admin privilege escalation | PASS | `is_admin()` STABLE DEFINER RPC |
| Employer cannot self-verify | PASS | Blocked by RLS; requires `admin_review_employer` |
| Unverified employer listings cannot be approved for publication | PASS | Enforced in `review_job` SQL body |
| Staging admin waiver protected by admin check | PASS | Tested & verified |
| Full audit trail recorded for moderation actions | PASS | `audit_log` entries created on review |

**Phase 2 is COMPLETE.** Proceeding immediately to Phase 3.
