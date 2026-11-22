# 17. Database Migration Correction & Execution Plan

**FleetWala Pre-Production Conversion**  
**Document:** `docs/audit/17-migration-review-and-execution.md`  
**Date:** 22 November 2026  
**Status:** Consolidated Staging Script Prepared (Live Execution Blocked Pending Owner Staging Credentials)

---

## 1. Static Audit & Migration Integrity Review

All 15 SQL migration files in `supabase/migrations/` and `docs/sql-execution-order.md` were audited:

| Migration | Category | Purpose | Security / Concurrency Review |
| :--- | :--- | :--- | :--- |
| `001_extensions_and_enums.sql` | Schema Foundation | `pgcrypto`, 9 custom ENUMs | Idempotent extension creation; guarded types. |
| `002_auth_profiles_and_roles.sql` | Tenancy & Roles | `user_accounts`, `employers`, `employer_memberships`, `admin_principals` | `admin_principals` strictly revoked from `anon` & `authenticated`. Zero client role escalation. |
| `003_worker_profiles_and_preferences.sql` | Worker Domain | `workers`, `worker_preferences`, `worker_skills` | `discoverable boolean not null default false` (Owner Decision #7). PII isolated to `auth.uid()`. |
| `004_jobs_and_moderation.sql` | Job Lifecycle | `jobs`, `job_status_history`, `employer_verification_reviews` | State machine: `draft` -> `pending_review` -> `published` / `rejected` / `paused` / `closed`. Min/max salary constraint. |
| `005_applications_saved_jobs.sql` | Application Domain | `job_applications`, `application_status_history`, `saved_jobs` | Unique constraint `(worker_id, job_id)`. Withdrawn applications retained for audit. |
| `006_notifications_chat.sql` | Communication | `notifications`, `conversations`, `conversation_participants`, `messages` | Chat strictly gated: requires shortlisted application state and verified participation. |
| `007_storage_metadata.sql` | Document Storage | `storage.buckets`, `worker_documents` | Private bucket `worker-private-documents`. Objects restricted to `<auth.uid()>/<filename>`. |
| `008_billing_and_unlocks.sql` | Monetization Baseline | `billing_settings`, `payment_orders`, `payment_events`, `job_entitlements`, `contact_unlocks` | **₹99** job posting & **₹10** unlock preserved. `enabled = false` safely gate-keeps live transactions. |
| `009_audit_and_support.sql` | Governance | `audit_log`, `support_tickets`, `user_reports` | Tamper-resistant append-only logging for state changes and administrative mutations. |
| `010_indexes_triggers_and_functions.sql` | Core Business RPCs | `apply_to_job`, `submit_job`, `review_job`, `on_auth_user_created` | Fixed `search_path = ''`. Serialized row lock for 20/day apply limit. |
| `011_rls_policies.sql` | Access Control | 27 tables RLS-enabled, explicit least-privilege grants | Default deny on all public tables; no direct client `INSERT`/`UPDATE` bypassing business RPCs. |
| `012_views_and_safe_discovery.sql` | Privacy Projection | `discover_workers` RPC | Exposes only SHA-256 worker handle; zero candidate contact or document exposure. |
| `013_test_fixtures_staging_only.sql` | Seed Data | Staging seed entities | Isolated test fixtures only; never applied to production. |
| `014_database_verification.sql` | Diagnostics | Automated non-destructive queries | Pure `SELECT` queries inspecting RLS coverage and grant surfaces. |
| `015_data_retention_and_cleanup.sql` | Retention Gate | Data retention notice | Non-destructive marker. No automated deletion configured without legal counsel. |

---

## 2. Server-Side Concurrency & 20 Applies / IST Day Analysis

Owner Decision #7 mandates:
> "Worker can apply free up to 20 times per IST calendar day; backend enforcement including races."

In `010_indexes_triggers_and_functions.sql`, the `apply_to_job(p_job_id uuid)` RPC implements this:

```sql
-- Step 1: Explicit row-level lock on the worker's record serializes concurrent apply attempts
select w.id into v_worker_id from public.workers w
  where w.user_id = auth.uid() and w.account_state = 'active' for update;

-- Step 2: Idempotent duplicate check
select a.* into v_app from public.job_applications a
  where a.worker_id = v_worker_id and a.job_id = p_job_id;
if found then return query select v_app.id, true; return; end if;

-- Step 3: Exact Asia/Kolkata date boundary calculation
v_today := (clock_timestamp() at time zone 'Asia/Kolkata')::date;

-- Step 4: Atomic count validation
if (select count(*) from public.job_applications a
    where a.worker_id = v_worker_id
      and (a.created_at at time zone 'Asia/Kolkata')::date = v_today) >= 20 then
  raise exception 'Daily application limit reached (20 per IST calendar day)';
end if;

-- Step 5: Application insertion
insert into public.job_applications(worker_id, job_id, created_at)
  values (v_worker_id, p_job_id, clock_timestamp())
  returning * into v_app;
```

### Race Condition Analysis:
- Two requests arriving within 1ms of each other cannot execute Step 4 concurrently: the first request acquires `FOR UPDATE` on `public.workers(id)`.
- The second request blocks at Step 1 until the first transaction commits.
- When the second transaction unblocks, it reads the incremented application count from Step 4. If the count has reached 20, the second transaction raises an exception and aborts.
- **Verdict: ZERO race condition vulnerability.**

---

## 3. Consolidated Staging Migration Script

To ensure atomic execution without ordering errors, all 15 migrations have been consolidated into:
`supabase/migrations/consolidated_staging_migration.sql`

Key characteristics:
1. **Single Transactional Block:** Enclosed in `BEGIN ... COMMIT`. If any statement fails, the entire transaction rolls back cleanly.
2. **Idempotence:** Uses `CREATE TABLE IF NOT EXISTS`, `CREATE OR REPLACE FUNCTION`, `DROP TRIGGER IF EXISTS`, and `DROP POLICY IF EXISTS`.
3. **Storage Bucket Provisioning:** Inserts `worker-private-documents` into `storage.buckets` with `public = false`.

---

## 4. Live Execution Status: BLOCKED

As mandated by **Execution Rule E**:
> "Run migrations ONLY against explicitly identified disposable/staging project after explicit confirmation of target project ID and destructive-impact review; otherwise output ready-to-paste, ordered SQL and exact owner steps, mark execution BLOCKED."

### Status: **BLOCKED** (Awaiting Owner Confirmation of Staging Project ID)

### Instructions for Owner to Execute in Supabase:
1. Open [Supabase Dashboard](https://supabase.com/dashboard) and select your **Staging** project.
2. In the left sidebar, click on **SQL Editor**.
3. Click **+ New query**.
4. Open `supabase/migrations/consolidated_staging_migration.sql` from your local repo and paste the entire contents into the SQL Editor.
5. Click **Run** (or `Ctrl+Enter`).
6. Confirm the console displays: `Success. No rows returned`.
7. (Optional) Run `supabase/migrations/014_database_verification.sql` to verify that 0 public tables lack RLS and all least-privilege grants are intact.
