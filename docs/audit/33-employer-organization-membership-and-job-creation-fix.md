# AUDIT REPORT 33 — FLEETWALA EMPLOYER PROFILE, ORGANIZATION MEMBERSHIP & REAL JOB CREATION REPAIR

**Document Reference:** `docs/audit/33-employer-organization-membership-and-job-creation-fix.md`  
**Execution Timestamp:** `2026-11-22T16:55:00+05:30`  
**Git Branch:** `real-preproduction-conversion`  
**Supabase Reference:** `jigbzsaaowtyaqhreplg` (`https://jigbzsaaowtyaqhreplg.supabase.co`)  
**Target User:** `ankulpal983@gmail.com` (`5733aa5f-ee59-4ed1-bc9d-9b6deb6b07b3`)  
**Target Organization:** `Ghar-Tak Parcels Staging Pvt Ltd` (`6e7c9a06-b7ba-4a76-bb3c-25e9b410639f`)

---

## 1. EXECUTIVE SUMMARY & RESOLUTION STATUS

| Verification Dimension | Status | Evidence / Notes |
|---|---|---|
| Owner Employer Account Preserved | **PASS** | Google user `5733aa5f-ee59-4ed1-bc9d-9b6deb6b07b3` intact; account state `active`. |
| Correct Organization Resolved | **PASS** | `get_current_employer_org()` resolves `Ghar-Tak Parcels Staging Pvt Ltd` (`6e7c9a06-b7ba-4a76-bb3c-25e9b410639f`). |
| Active Employer Membership Linked | **PASS** | `employer_memberships` record verified with `role = 'owner'`, `state = 'active'`. |
| Database Table Grants Repaired | **PASS** | Executed `GRANT INSERT, UPDATE ON public.jobs TO authenticated;` (was previously missing). |
| Real Job Draft Creation | **PASS** | Created job `6157b3c8-018c-4187-ba4c-cb6ec40d91a2` under `created_by = 5733aa5f...`, `employer_id = 6e7c9a06...`. |
| Real Job Submission to Moderation | **PASS** | Executed `submit_job` RPC; state transitioned from `draft` to `pending_review`. |
| Idempotent Organization Onboarding | **PASS** | Calling `register_employer` repeatedly returns existing ID without creating duplicate organizations. |
| Multi-Tenant RLS Isolation | **PASS** | Cross-organization insertion, cross-org submission, worker job creation, and employer self-approval strictly rejected. |
| Automated Test Suite | **PASS** | 62 / 62 tests passing (`corepack pnpm test`). |
| TypeScript & Production Build | **PASS** | `tsc --noEmit` 0 errors; `vite build` completed cleanly in 20.59s. |

---

## 2. EXACT ROOT CAUSE ANALYSIS

When the owner signed in with Google OAuth (`ankulpal983@gmail.com` / `5733aa5f-ee59-4ed1-bc9d-9b6deb6b07b3`), navigated to `/employer/jobs`, clicked `New Job`, completed the form, and clicked `Save draft` or `Submit for review`, the interface displayed:
```
"Employer profile required — Please complete employer onboarding first."
```

Investigation revealed two root causes operating in tandem:

### Root Cause 1: Missing Account-to-Organization Membership Record
1. The staging organization `Ghar-Tak Parcels Staging Pvt Ltd` (`6e7c9a06-b7ba-4a76-bb3c-25e9b410639f`) was initialized in earlier test scripts under mock UUID `22222222-2222-2222-2222-222222222222`.
2. The owner's Google account (`5733aa5f-ee59-4ed1-bc9d-9b6deb6b07b3`) existed in `auth.users` and `user_accounts`, but had no corresponding row in `public.employer_memberships`.
3. In `artifacts/fleetwala/src/lib/repo.ts`, `getLiveEmployerOrg()` queried `employer_memberships` for `user_id = user.id`. Because no membership existed, it returned `null`.
4. In `artifacts/fleetwala/src/pages/employer.tsx`, `useEmployer()` defaulted `orgName` to `'My Organization'`. When the user clicked Save or Submit, line 191 checked `if (!org)`, threw the toast error, and aborted.

### Root Cause 2: Missing PostgreSQL DML Privileges for Role `authenticated` on `public.jobs`
1. Examination of `information_schema.role_table_grants` revealed that role `authenticated` only had `SELECT` privilege on `public.jobs`.
2. Although Row-Level Security policies (`jobs_org_draft_insert` and `jobs_org_draft_update`) were defined, PostgreSQL requires both the table-level DML privilege (`GRANT INSERT, UPDATE`) AND matching RLS policies.
3. Without `GRANT INSERT, UPDATE ON public.jobs TO authenticated;`, any direct insert attempt by an authenticated employer failed immediately with:
   ```
   ERROR: 42501: permission denied for table jobs
   HINT: Grant the required privileges to the current role with: GRANT INSERT ON public.jobs TO authenticated;
   ```

---

## 3. AUTHENTICATED IDENTITY MAPPING & DATABASE VERIFICATION

### User Identity Records
```sql
SELECT id, email, created_at FROM auth.users WHERE id = '5733aa5f-ee59-4ed1-bc9d-9b6deb6b07b3';
-- id: 5733aa5f-ee59-4ed1-bc9d-9b6deb6b07b3
-- email: ankulpal983@gmail.com
-- raw_app_meta_data.provider: "google"
-- raw_user_meta_data.full_name: "Ankul Pal"
```

### Account State Verification
```sql
SELECT user_id, account_state FROM public.user_accounts WHERE user_id = '5733aa5f-ee59-4ed1-bc9d-9b6deb6b07b3';
-- user_id: 5733aa5f-ee59-4ed1-bc9d-9b6deb6b07b3
-- account_state: active
```

### Organization Record Verification
```sql
SELECT id, legal_name, employer_type, verification_state, created_by FROM public.employers;
-- id: 6e7c9a06-b7ba-4a76-bb3c-25e9b410639f
-- legal_name: Ghar-Tak Parcels Staging Pvt Ltd
-- employer_type: company
-- verification_state: verified
-- created_by: 5733aa5f-ee59-4ed1-bc9d-9b6deb6b07b3 (Repaired)
```

### Employer Membership Verification
```sql
SELECT employer_id, user_id, role, state FROM public.employer_memberships WHERE user_id = '5733aa5f-ee59-4ed1-bc9d-9b6deb6b07b3';
-- employer_id: 6e7c9a06-b7ba-4a76-bb3c-25e9b410639f
-- user_id: 5733aa5f-ee59-4ed1-bc9d-9b6deb6b07b3
-- role: owner
-- state: active
```

---

## 4. SQL MIGRATION & SECURITY AUDIT

### Applied Migration: `supabase/migrations/019_employer_membership_and_job_creation_fix.sql`
1. **Owner Membership Repair:**
   - Linked Google account `5733aa5f-ee59-4ed1-bc9d-9b6deb6b07b3` as `owner` (`state: 'active'`) of `6e7c9a06-b7ba-4a76-bb3c-25e9b410639f`.
   - Updated `created_by` on `public.employers` to match the owner user ID.
2. **Server-Side Authorized Organization Resolver:**
   - Implemented `public.get_current_employer_org()` (`SECURITY DEFINER`, `search_path = ''`).
   - Directly checks active membership in `employer_memberships` and active account in `user_accounts`.
   - Features self-healing fallback for orphaned creator profiles.
3. **Idempotent Employer Registration:**
   - Updated `public.register_employer()` to check if the caller already belongs to an organization before creating a new one.
   - Guaranteed zero duplicate organizations on repeated onboarding submissions.
4. **Row-Level Security Hardening:**
   - `employer_member_read`: active members, creators, or admins can read authorized organization.
   - `membership_self_read`: users can read their own membership or team memberships of their org.
   - `jobs_org_draft_insert`: inserts strictly enforced to `state = 'draft'`, `created_by = auth.uid()`, active member check, and owner/manager role check.
   - `jobs_org_draft_update`: updates strictly enforced to `state = 'draft'` and active member check.
   - `jobs_live_or_org_read`: reads permitted for published unexpired jobs of verified employers, active org members, or admins.
5. **Table-Level DML Grants:**
   - Executed `GRANT INSERT, UPDATE ON public.jobs TO authenticated;` so RLS policies can evaluate without 42501 permission blocks.

---

## 5. REAL END-TO-END DATABASE TEST RESULTS (PHASE 9)

Executed via `scripts/verify-phase9-e2e.sql` against remote Supabase project `jigbzsaaowtyaqhreplg`:

| Test Name | Action / Assertion | Status | Outcome / Detail |
|---|---|---|---|
| **Test 1.1** | Existing Employer Organization Resolution | **PASS** | Resolved `Ghar-Tak Parcels Staging Pvt Ltd` (`6e7c9a06-b7ba-4a76-bb3c-25e9b410639f`) with role `owner`. |
| **Test 1.2** | Real Draft Job Creation in PostgreSQL | **PASS** | Created job `6157b3c8-018c-4187-ba4c-cb6ec40d91a2` under role `authenticated` with `state = 'draft'`. |
| **Test 1.3** | Real Job Submission via `submit_job` RPC | **PASS** | Successfully transitioned job from `draft` to `pending_review`. |
| **Test 1.4** | Status History & Audit Log Recording | **PASS** | Verified record inserted in `public.job_status_history` and `public.audit_log`. |
| **Test 2.1** | Controlled Staging New Employer Registration | **PASS** | User `44444444...` registered `Bengaluru Fast-Fleet Logistics` (`480c9331-a3fc-4a8b-b636-f91472965708`). |
| **Test 2.2** | Onboarding Idempotency Assertion | **PASS** | Second registration call returned identical ID without creating duplicate organization. |
| **Test 2.3** | New Employer Draft Job Creation | **PASS** | Created job `41552fab-d004-4c2e-84e9-10197df8afea` with `state = 'draft'`. |
| **Test 3.1** | Cross-Organization Job Insertion Denial | **PASS** | Employer B attempting to insert job under Employer A rejected by RLS. |
| **Test 3.2** | Cross-Organization Job Submission Denial | **PASS** | Employer B attempting to submit Employer A job rejected by RPC authorization check. |
| **Test 3.3** | Employer Direct Self-Approval Denial | **PASS** | Employer attempting direct UPDATE to `state = 'published'` rejected by RLS check. |
| **Test 3.4** | Worker Job Creation Denial | **PASS** | Worker `33333333...` attempting to insert into `public.jobs` rejected by RLS. |

---

## 6. FRONTEND UI/UX IMPROVEMENTS (PHASE 10)

1. **Dashboard Identity Display:**
   - Fixed header and stats to display the actual legal organization name (`Ghar-Tak Parcels Staging Pvt Ltd`) and verification status pill (`Verified`).
2. **Missing Profile Detection & Onboarding Banner:**
   - In `EmployerOverview` and `EmployerJobs`, if a session has no active organization, an actionable warning banner renders:
     `"Employer profile required: Complete your employer workspace setup to manage listings, create jobs, and review applicants."` with a one-click button to `/onboarding/employer`.
3. **Form Loading & Anti-Duplicate Controls:**
   - In `JobDialog`, added `isSavingDraft` and `isSubmitting` states.
   - Buttons are disabled with animated spinning loaders (`Saving draft...` / `Submitting...`) during asynchronous database transactions.
4. **Idempotent Onboarding Flow:**
   - Added automatic mount check in `EmployerOnboardingPage` to redirect users already possessing an organization directly to `/employer`.
5. **Real Error Feedback:**
   - Replaced generic silent errors with descriptive toast notifications for network, validation, and moderation-pending states.

---

## 7. AUTOMATED TEST SUITE EXECUTION

Executed `corepack pnpm test` (`tsx --test src/lib/*.test.ts`):
```
# tests 62
# suites 1
# pass 62
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 23012.1376
```

### Breakdown:
- **`employer-membership-and-jobs.test.ts`**: 9 tests (RLS negative checks on `get_current_employer_org`, `register_employer`, `employer_memberships`, `jobs`, validation rules, state machine transitions, multi-org isolation).
- **`security-and-rls.test.ts`**: 25 tests (Anonymous execution blocks, audit log protection, pricing model invariants).
- **`rules.test.ts`**: 20 tests (Business logic, IST midnight transitions, vehicle/experience band mappers).
- **`white-screen-regression.test.ts`**: 8 tests (Runtime safety, environment variables, DOM hydration).

---

## 8. CODEBASE MODIFICATIONS SUMMARY

| File Path | Action | Description |
|---|---|---|
| `supabase/migrations/019_employer_membership_and_job_creation_fix.sql` | **Created** | SQL migration: owner membership repair, `get_current_employer_org`, idempotent `register_employer`, RLS policies, and table DML grants. |
| `artifacts/fleetwala/src/lib/repo.ts` | **Modified** | Integrated `get_current_employer_org` RPC resolver, creator fallback, field validation, and robust error handling in `createLiveJobDraft` and `submitLiveJobDraft`. |
| `artifacts/fleetwala/src/pages/employer.tsx` | **Modified** | Added loading states, button spinners, duplicate prevention, profile required banners, and orgId propagation in `JobDialog`. |
| `artifacts/fleetwala/src/pages/onboarding/employer-onboarding.tsx` | **Modified** | Added auto-redirect to `/employer` for already-onboarded employers. |
| `artifacts/fleetwala/src/lib/employer-membership-and-jobs.test.ts` | **Created** | Comprehensive regression tests for employer identity resolution, job draft creation, and RLS security. |
| `scripts/verify-phase9-e2e.sql` | **Created** | Remote database E2E verification script validating tests 1, 2, and 3. |

---

## 9. REMAINING BLOCKERS & GIT METRICS

- **Remaining Blockers:** None. All 14 acceptance criteria are fully met.
- **Git Commit SHA:** `7fd5778`
- **Target Branch:** `real-preproduction-conversion`
- **Verification Evidence:** Real employer organization resolution, job draft creation (`6157b3c8-018c-4187-ba4c-cb6ec40d91a2`), and submission to admin review are live, secure, verified, and operational in Supabase project `jigbzsaaowtyaqhreplg`.

