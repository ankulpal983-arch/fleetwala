# FleetWala Three-Role Workflow, Database RPC & RLS Verification Report

**Document:** `docs/audit/64-authenticated-three-role-business-workflow-verification.md`  
**Audit Date:** 2026-11-26  
**Branch:** `real-preproduction-conversion`  
**Supabase Ref:** `jigbzsaaowtyaqhreplg`

---

## 1. Honest Verification Scope Boundary

In strict compliance with verification accuracy rules:
- **No synthetic or bypass authentication (`fleetwala_test_auth`) was kept or used.**
- Interactive authenticated logins for Worker (`Google OAuth`), Employer (`flipkart`), and Admin (`ankulpalwork@gmail.com`) require interactive credentials/OAuth browser consent and were **not executed interactively in Chrome during this offline audit session** *(prior authenticated E2E execution against `jigbzsaaowtyaqhreplg` was recorded at commit `6068843` in `docs/audit/53-three-account-hiring-communication-e2e.md` and `docs/audit/61-ankul-real-worker-identity-and-discovery-reconciliation.md`)*.
- Therefore, this report separates **(A) Directly Observed Live Database State & RPC Contracts**, **(B) Directly Observed Negative Security / Unauthenticated Browser Tests**, and **(C) Pending Interactive Authenticated Post-027 Re-Verification**.

---

## 2. Directly Verified Remote Database Entities & Privacy Preservation (`jigbzsaaowtyaqhreplg`)

Read-only SQL verification (`supabase db query --remote --read-only`) confirmed all genuine user records remain completely intact:
- `public.employers`: **1** verified genuine organization (`flipkart`)
- `public.jobs`: **1** approved job (`delivery hiring for delhi ncr`)
- `public.workers`: **2** worker profiles (including genuine `Ankul` profile, Delhi NCR / Dwarka, discoverable)
- `public.job_applications`: **1** active hiring record (`6ed9e756-...`)
- `public.conversations` / `public.messages`: **1** conversation (`e8fa2e36-...`) with **4** persisted messages
- `public.candidate_invitations`: **3** records
- `public.audit_log`: **38** records; `public.notifications`: **37** records

---

## 3. PostgreSQL RPC & Code-Path Audit Across All 3 Roles

### 3.1 Employer Workflow Audit
- **Organization Resolution & Draft Creation:** Inspected live `register_employer`, `get_current_employer_org`, `jobs_org_draft_insert`, `jobs_org_draft_update`, and `submit_job` SQL definitions in `pg_proc`. Verified active membership + `user_accounts.account_state = 'active'` gates.
- **Job Visibility & Pause/Close:** Inspected `update_employer_job_state` & `jobs_live_or_org_read` policy — only `'published'` unexpired jobs of `'verified'` employers are exposed to visitors/workers via `get_public_published_jobs`. Note `public.jobs` table schema does not currently store `shift`, `experience_band`, `fuel_allowance`, or `openings` columns, so `repo.ts` supplies normalized display defaults.
- **Applicants & Invitations (`get_employer_applicants` / `create_application_invitation`):** Identified and fixed `workers` RLS nested select returning `null` (`FW-CANDIDATE`) via new `get_employer_applicants` RPC in staged Migration `027` (exposing SHA-256 `FW-XXXXXX` code + anonymized city/vehicle/experience even when `discoverable = false`). Tightened `create_candidate_invitation` and `create_application_invitation` in `027` to enforce `verification_state = 'verified'`.
- **Chat (`ensure_application_conversation`, `can_access_conversation`, `send_message`, `get_user_conversations`):** Inspected live SQL functions — all enforce `shortlisted`/`hired` or `accepted` invitation + participant membership (`auth.uid()`).

### 3.2 Admin Workflow Audit
- **Access Control:** `ProtectedAdminRoute`, `AdminAccessDenied`, and `is_admin()` RPC check `public.admin_principals` + `user_accounts.account_state = 'active'`.
- **Job Moderation & Employer Verification:** Inspected `review_job` (enforces `verification_state = 'verified'` before publishing), `admin_review_employer`, and `admin_set_job_state` (pauses/closes/reopens with `audit_log`). Fixed `admin.tsx` to wire **Pause**/**Close** buttons to `admin_set_job_state`, read live `audit_log` and `support_tickets`, and show live employer verification badges.

### 3.3 Worker Workflow Audit
- **Discovery, Application Limit & Free Guarantee:** Verified `apply_to_job` SQL checks `state = 'published'`, unexpired `expires_at`, verified employer, idempotency, and atomic `count(*) >= 20` on `(created_at at time zone 'Asia/Kolkata')::date`. No payment check blocks workers (`₹0`).
- **Fixed Client Gaps (`worker-jobs.tsx` & `worker-more.tsx`):**
  - Fixed live Hero strength/name/usage/discoverability and `SavedJobs` bookmark persistence.
  - Fixed `Applications` hiding live rows when `state.jobs === []`, and wired `Withdraw` to `setLiveApplicationStatus(..., 'withdrawn')`.
  - Fixed `SettingsPage` discoverability toggle to use `setLiveWorkerDiscoverability` rather than re-submitting empty `state.profile`.
  - Verified pure coordinate validation, city-hub Haversine matching, and Indian pincode logic via `predeployment-audit.test.ts`.

---

## 4. Direct Automated Negative & Browser Guard Results (This Session)

- **`anonClient` RLS Negative Suite (`security-and-rls.test.ts` + `predeployment-audit.test.ts`):** Confirmed unauthenticated users receive 0 rows or `42501` denial across all 14 tested private tables and cannot invoke privileged RPCs (`is_admin`, `apply_to_job`, `submit_job`, `review_job`, `admin_set_job_state`, `admin_review_employer`, `discover_workers`, `create_candidate_invitation`, `create_application_invitation`, `respond_to_candidate_invitation`, `send_message`, `set_application_status`, `save_worker_profile`, `bootstrap_admin`).
- **Unauthenticated Route Guards in Headless Chrome (`localhost:3000` & preview `127.0.0.1:3000`):**
  - `/employer` & `/employer/candidates` $\to$ Render `Employer Workspace Required` with `0` runtime errors and zero candidate roster leakage (`test-candidates-page.cjs` PASS).
  - `/admin` $\to$ Renders `Administrator Access Denied` with `0` runtime errors.
  - `/applications` $\to$ Renders `Worker Portal Only` sign-in prompt cleanly.
  - `/support` $\to$ Rejects unauthenticated submit with `Please sign in to submit a tracked grievance or support ticket.` (never fakes success).

---

## 5. Recommended Authenticated Post-027 Interactive Walkthrough (Owner Sign-Off Step)

Once the owner authorizes Migration `027` on staging (`jigbzsaaowtyaqhreplg`), perform a 5-minute interactive Chrome check with real Google/email logins for the 3 accounts:
1. **Worker (`Ankul`):** Sign in $\to$ verify Hero shows `Ankul`, `Delhi NCR`, live IST usage counter $\to$ toggle discoverability in `/settings` $\to$ confirm `/profile` details remain untouched $\to$ view `/applications` & accept/decline test invitation.
2. **Employer (`flipkart`):** Sign in $\to$ verify `/employer/applicants` renders SHA-256 `FW-XXXXXX` handle & worker summary via `get_employer_applicants` $\to$ verify `/employer/candidates` Dwarka filter renders cleanly.
3. **Admin (`ankulpalwork@gmail.com`):** Sign in $\to$ verify `/admin` shows `audit_log` & `support_tickets` counts $\to$ verify `/admin/jobs` displays real employer verification badge and Pause/Close controls cleanly.
