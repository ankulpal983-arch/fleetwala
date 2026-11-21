# FleetWala Architecture & Security Threat Model Audit
**Document ID:** `docs/audit/04-security-findings.md`  
**Audit Date:** 2026-11-21  
**Auditor:** Antigravity Autonomous Orchestrator  
**Status:** COMPLETE (Phase 3)

---

## 1. Actual System Architecture & Data Flow

### 1.1 Stack Identity & Technical Reality
- **Frontend Layer:** React 19.1 SPA + Vite 7.3 + Wouter 3.3 + TanStack React Query 5.9 + Tailwind CSS 4.1.
- **Client Supabase SDK:** `@supabase/supabase-js` v2.119.2 using browser-safe publishable/anon key.
- **API Scaffold:** Express 5.3 + Pino (reserved for future webhook handling; currently isolated).
- **Backend & Database:** Supabase PostgreSQL with Row Level Security (RLS), custom PostgreSQL functions with `set search_path = ''`, and private storage buckets.
- **Identity Provider:** Supabase Auth (Phone OTP for Workers, Email Magic Link for Employers, allowlisted admin principals for Admins).

```
   ┌────────────────────────────────────────────────────────┐
   │                 Web Browser (Client)                   │
   │  React 19 + Vite SPA (Worker, Employer, Admin Shell)   │
   └─────────────┬───────────────────────────┬──────────────┘
                 │ (Direct REST / RPC / Auth)│ (Future Webhooks / Server Ops)
                 ▼                           ▼
   ┌───────────────────────────┐   ┌───────────────────────────┐
   │       Supabase Auth       │   │   Express / Edge Server   │
   │ Phone OTP / Magic Link    │   │ (Payment Webhooks / HMAC) │
   └─────────────┬─────────────┘   └─────────────┬─────────────┘
                 │                               │
                 ▼                               │
   ┌─────────────────────────────────────────┐   │
   │         Supabase PostgreSQL DB          │◄──┘
   │  - Row Level Security (RLS) on all tabs │
   │  - Atomic RPC: apply_to_job() [IST cap] │
   │  - Anonymized RPC: discover_workers()   │
   │  - Strict Constraints (org-worker pair) │
   │  - Audit Log Trail & Security Triggers  │
   └─────────────────────────────────────────┘
```

### 1.2 Stack Recommendation: RETAIN Current Stack
- **Recommendation:** Keep the current React + Vite SPA + Supabase architecture.
- **Justification:** The codebase is cleanly structured with tested pure business rules (`lib/rules.ts`), responsive UI components, and comprehensive 15-part PostgreSQL migrations. Rebuilding in Next.js App Router would introduce server/client boundary rewrites, SSR hydration issues, and significant delay with zero security advantage over Supabase RLS with stored procedures and edge functions.

---

## 2. Role-Based Access Control (RBAC) & Tenancy Model

1. **Anonymous Visitor (`anon` role):**
   - Public marketing (`/welcome`), login (`/login`), legal drafts (`/legal/*`).
   - May view only approved, unexpired jobs published by verified employers (`jobs_live_or_org_read`).
   - Zero access to worker profiles, employer dashboards, applicant data, candidate previews, or admin routes.
2. **Worker Role (`authenticated` with worker profile):**
   - Bound to `auth.uid() = workers.user_id`.
   - Full read/write to own profile, preferences, vehicle, skills, and saved jobs.
   - Applications: Atomic submission via `public.apply_to_job()` RPC. Can view only their own applications (`worker_id = current_worker_id()`).
   - Discoverability is opt-in (`discoverable: false` by default).
   - Zero access to other workers' sensitive PII, documents, or employer candidate pipelines.
3. **Employer Member (`owner`, `manager`, `recruiter`):**
   - Bound to `employer_memberships` where `user_id = auth.uid()` and employer is `verified`.
   - Access strictly restricted to organization-owned jobs and applicants to those specific jobs.
   - Candidate discovery (`discover_workers`): Receives SHA-256 hashed handle and non-identifying attributes (city, category, experience band, vehicle). Never receives worker phone, email, or exact address.
   - Contact unlock: Unique per `(employer_id, worker_id)`. Requires verified payment order; double charging is structurally blocked by DB unique constraint.
4. **Admin Role (`admin_principals`):**
   - Derived exclusively from server-side `admin_principals` table (`is_admin()` SQL function).
   - Never derived from client metadata (`user_metadata`).
   - Can moderate jobs, verify/suspend employers, review audit logs, and resolve support disputes.

---

## 3. Threat Modeling & Vulnerability Findings

### Finding 1: Client Role-Switching in Pilot UI (Severity: LOW in Pilot / CRITICAL if Live)
- **Code Path:** [shell.tsx](file:///d:/Downloads/Fleet-Wala-Builder/Fleet-Wala-Builder/artifacts/fleetwala/src/components/shell.tsx#L49-L54)
- **Scenario:** The UI switcher allows toggling between Worker, Employer, and Admin views in browser state.
- **Risk:** If ported to production without server-side route guards, any visitor could access `/admin`.
- **Mitigation:**
  - The UI clearly labels this as a local pilot demonstration with sample data.
  - In live mode (`gate.blocked || gate.showLiveData`), the router fails closed to `<LiveSetup />`.
  - Database migrations enforce strict RLS via `public.is_admin()`, rejecting all unauthorized queries even if the frontend navigates to `/admin`.
- **Verification:** Unit test `live gate fails closed until wired` PASSED.

---

### Finding 2: Concurrency & Daily Application Limit Bypasses (Severity: HIGH)
- **Code Path:** [010_indexes_triggers_and_functions.sql](file:///d:/Downloads/Fleet-Wala-Builder/Fleet-Wala-Builder/supabase/migrations/010_indexes_triggers_and_functions.sql#L52-L92)
- **Scenario:** A malicious worker opens 25 browser tabs and fires simultaneous apply requests at 23:59:59 IST to exceed the 20/day limit.
- **Mitigation:**
  - Atomic PostgreSQL transaction `apply_to_job(p_job_id uuid)`.
  - Row-level lock on worker profile: `select w.id into v_worker_id from public.workers w where w.user_id = auth.uid() for update;`.
  - Evaluates current IST date using server clock: `(clock_timestamp() at time zone 'Asia/Kolkata')::date`.
  - Counts all applications on that calendar date; raises exception if `>= 20`.
  - Unique constraint on `(worker_id, job_id)` prevents duplicate applications.
- **Verification:** Tested in rules test suite (`countToday` and `canApplyToday`).

---

### Finding 3: PII Exposure in Candidate Discovery (Severity: HIGH)
- **Code Path:** [012_views_and_safe_discovery.sql](file:///d:/Downloads/Fleet-Wala-Builder/Fleet-Wala-Builder/supabase/migrations/012_views_and_safe_discovery.sql#L4-L26)
- **Scenario:** An employer inspects API network responses or browser hydration state to read workers' phone numbers, Aadhaar, or addresses without paying the ₹10 contact unlock fee.
- **Mitigation:**
  - Employers have NO `SELECT` grant on `public.workers`.
  - The `discover_workers` RPC returns only `candidate_handle` (SHA-256 digest of worker ID), `city`, `category`, `experience_band`, and `vehicle_type`.
  - PII columns (`phone`, `first_name`, `last_name`, `address`) are physically absent from the SQL projection.
- **Verification:** SQL definition audited; RLS policies verify default-deny on `public.workers`.

---

### Finding 4: Insecure Direct Object Reference (IDOR) on Applications & Unlocks (Severity: MEDIUM)
- **Code Path:** [011_rls_policies.sql](file:///d:/Downloads/Fleet-Wala-Builder/Fleet-Wala-Builder/supabase/migrations/011_rls_policies.sql#L60-L67)
- **Scenario:** Employer A queries applications submitted to Employer B's job listing by guessing the application UUID.
- **Mitigation:**
  - RLS policy `applications_worker_or_employer_read` permits access only if `worker_id = current_worker_id()` OR `exists (select 1 from public.jobs j where j.id = job_id and public.is_active_employer_member(j.employer_id))`.
  - Queries for other employers' applications return empty sets (`0 rows`).

---

### Finding 5: Replay & Double-Charging on Contact Unlocks (Severity: MEDIUM)
- **Code Path:** [008_billing_and_unlocks.sql](file:///d:/Downloads/Fleet-Wala-Builder/Fleet-Wala-Builder/supabase/migrations/008_billing_and_unlocks.sql#L35-L42)
- **Scenario:** An employer repeatedly clicks "Unlock Contact" for the same worker, resulting in multiple ₹10 charges.
- **Mitigation:**
  - Unique constraint on `public.contact_unlocks (employer_id, worker_id)`.
  - Database prevents inserting duplicate unlock records. Application checks for existing unlock before generating payment order.

---

### Finding 6: SQL Function Search Path Vulnerabilities (Severity: LOW / Best Practice)
- **Code Path:** [010_indexes_triggers_and_functions.sql](file:///d:/Downloads/Fleet-Wala-Builder/Fleet-Wala-Builder/supabase/migrations/010_indexes_triggers_and_functions.sql#L13)
- **Mitigation:** All `SECURITY DEFINER` functions in migrations 010 and 012 explicitly specify `set search_path = ''` to prevent search path hijacking attacks.
