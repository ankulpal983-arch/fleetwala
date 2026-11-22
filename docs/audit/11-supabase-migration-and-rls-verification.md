# FleetWala Supabase Migration & RLS Security Static Audit
**Document ID:** `docs/audit/11-supabase-migration-and-rls-verification.md`  
**Audit Date:** 2026-11-22  
**Auditor:** Antigravity Autonomous Orchestrator  
**Status:** COMPLETE (Phase D Verified)

---

## 1. Migration Inventory & Dependency Order

The 15 SQL migration files in `supabase/migrations/` follow a strict, topological dependency chain:

| Migration File | Primary Prerequisite | Core Operations & DDL Objects | Static Syntax & Safety Assessment |
| :--- | :--- | :--- | :---: |
| `001_extensions_and_enums.sql` | Base Postgres | Extension `pgcrypto`; 9 custom enums (`account_state`, `job_state`, etc.). | **PASSED** (Idempotent `create extension if not exists`) |
| `002_auth_profiles_and_roles.sql` | `001` | Tables: `user_accounts`, `employers`, `employer_memberships`, `admin_principals`. | **PASSED** (Strict FKs to `auth.users(id)`) |
| `003_worker_profiles_and_preferences.sql` | `002` | Tables: `workers` (`discoverable: false`), `worker_preferences`, `worker_skills`. | **PASSED** (Cascade deletes scoped to worker) |
| `004_jobs_and_moderation.sql` | `002`, `003` | Tables: `jobs`, `job_status_history`, `employer_verification_reviews`. | **PASSED** (Salary range and title constraints) |
| `005_applications_saved_jobs.sql` | `003`, `004` | Tables: `job_applications` (`unique(worker_id, job_id)`), `saved_jobs`. | **PASSED** (Application uniqueness guaranteed) |
| `006_notifications_chat.sql` | `002`, `005` | Tables: `notifications`, `conversations`, `conversation_participants`, `messages`. | **PASSED** (Chat tied directly to job applications) |
| `007_storage_metadata.sql` | `003` | Bucket `worker-private-documents` (private) + `worker_documents` metadata. | **PASSED** (MIME types & byte limits constrained) |
| `008_billing_and_unlocks.sql` | `002`, `004` | Tables: `billing_settings`, `payment_orders`, `contact_unlocks` (`unique(employer, worker)`). | **PASSED** (Double-unlock structurally prevented) |
| `009_audit_and_support.sql` | `002` | Tables: `audit_log`, `support_tickets`, `user_reports`. | **PASSED** (Append-only audit trail) |
| `010_indexes_triggers_and_functions.sql` | `001`–`009` | Triggers, `search_path = ''` helpers, atomic `apply_to_job()` RPC. | **PASSED** (Pessimistic locking & IST day cap) |
| `011_rls_policies.sql` | `001`–`010` | Default-deny on all 27 tables; column-scoped grants; Storage RLS. | **PASSED** (Zero client writes to privileged fields) |
| `012_views_and_safe_discovery.sql` | `003`, `010` | RPC `discover_workers()` returning SHA-256 hashed handle and non-PII. | **PASSED** (Physical PII exclusion in SQL projection) |
| `013_test_fixtures_staging_only.sql`| `001`–`012` | Production guard preventing accidental dummy data seeding. | **PASSED** (Safe guard gate) |
| `014_database_verification.sql` | `001`–`013` | Read-only SQL assertions checking RLS flags and constraints. | **PASSED** (Read-only diagnostics) |
| `015_data_retention_and_cleanup.sql`| `001`–`014` | Data retention policy template and audit ledger preservation. | **PASSED** (No auto-destructive triggers) |

---

## 2. Table-by-Table Role Permission Matrix

| Database Table | Anonymous (`anon`) | Authenticated Worker | Authenticated Employer | Admin Principal | Service Role |
| :--- | :---: | :---: | :---: | :---: | :---: |
| `public.user_accounts` | Denied | `SELECT` (own), `UPDATE` (`display_label` only) | `SELECT` (own), `UPDATE` (`display_label` only) | `ALL` | Full Access |
| `public.workers` | Denied | `SELECT` (own), `INSERT` (non-admin cols), `UPDATE` (own) | Denied (Direct table denied) | `ALL` | Full Access |
| `public.worker_preferences` | Denied | `ALL` (own worker_id) | Denied | `ALL` | Full Access |
| `public.employers` | Denied | Denied | `SELECT` (own membership org) | `ALL` | Full Access |
| `public.employer_memberships` | Denied | Denied | `SELECT` (own membership) | `ALL` | Full Access |
| `public.jobs` | Denied | `SELECT` (live published only) | `SELECT` (own org), `INSERT` (`draft` only), `UPDATE` (drafts) | `ALL` | Full Access |
| `public.job_applications` | Denied | `SELECT` (own applications) | `SELECT` (applicants to own jobs) | `ALL` | Full Access |
| `public.contact_unlocks` | Denied | Denied | Denied (Access via RPC only) | `SELECT` | Full Access |
| `public.admin_principals` | Denied | Denied | Denied | `SELECT` | Full Access |
| `public.audit_log` | Denied | Denied | Denied | `SELECT` | Full Access |
| `storage.objects` (`worker-private-documents`) | Denied | `INSERT`, `SELECT`, `DELETE` (own `<auth.uid()>` folder only) | Denied | `SELECT` | Full Access |

---

## 3. High-Concurrency Server-Side 20/Day Enforcement Audit

The atomic application routine in Migration 010 enforces the 20/day limit strictly at the PostgreSQL transaction boundary:

```sql
select w.id into v_worker_id from public.workers w
  where w.user_id = auth.uid() and w.account_state = 'active' for update;

v_today := (clock_timestamp() at time zone 'Asia/Kolkata')::date;

if (select count(*) from public.job_applications a
    where a.worker_id = v_worker_id
      and (a.created_at at time zone 'Asia/Kolkata')::date = v_today) >= 20 then
  raise exception 'Daily application limit reached (20 per IST calendar day)';
end if;
```

### Safety Features Verified:
1. **Pessimistic Row Lock (`FOR UPDATE`):** If a worker submits requests in 5 browser tabs simultaneously, transaction 1 locks the worker record. Transactions 2 through 5 queue sequentially behind it, re-reading the committed count. Race conditions to exceed 20 are structurally impossible.
2. **Asia/Kolkata Timezone Clock:** The query calculates `v_today` using `clock_timestamp() at time zone 'Asia/Kolkata'`. It resets strictly at 00:00:00 IST regardless of server UTC time.
3. **Idempotent Retry:** If the worker already applied to the job, the function returns the existing application ID without throwing an error and without counting a new daily application.

---

## 4. Staging Execution Readiness Checklist

- [x] All 15 migrations verified syntactically.
- [x] Column-level security and default-deny policies confirmed.
- [x] Non-destructive execution plan documented in `docs/sql-execution-order.md`.
- [ ] **Awaiting disposable staging Supabase project credentials from owner** (marked **BLOCKED** from execution until approved).
