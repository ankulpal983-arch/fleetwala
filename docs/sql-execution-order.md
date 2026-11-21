# FleetWala Supabase SQL Execution Order & Runbook
**Document ID:** `docs/sql-execution-order.md`  
**Execution Environment:** Disposable Staging Supabase Project ONLY  
**Status:** DRAFT / REVIEWABLE (DO NOT RUN AGAINST PRODUCTION)

---

## 1. Prerequisites Before Applying Migrations

1. Create a dedicated **staging** project on [Supabase Dashboard](https://supabase.com/dashboard).
2. Never run these scripts on an existing production database without verified snapshots and explicit sign-off.
3. Ensure the project is on PostgreSQL 15+ with standard `auth` and `storage` schemas active.

---

## 2. Ordered Execution Sequence

Apply each file sequentially in the **Supabase Dashboard SQL Editor** (or via `supabase db push` / `psql` if connected to staging):

| Step | Migration File | Dependency / Prerequisite | Verified Content & Impact |
| :---: | :--- | :--- | :--- |
| **01** | `001_extensions_and_enums.sql` | Base PostgreSQL | Enables `pgcrypto` extension; declares enums (`account_state`, `job_state`, `application_state`, `payment_state`, `employer_type`, `membership_role`, `ticket_state`). |
| **02** | `002_auth_profiles_and_roles.sql` | `001` | Creates `user_accounts`, `employers`, `employer_memberships`, and `admin_principals`. Ties accounts 1:1 to `auth.users`. |
| **03** | `003_worker_profiles_and_preferences.sql` | `002` | Creates `workers` (discoverability default `false`), `worker_preferences`, and `worker_skills`. |
| **04** | `004_jobs_and_moderation.sql` | `002` | Creates `jobs` table, salary/opening constraints, `job_status_history`, and `employer_verification_reviews`. |
| **05** | `005_applications_saved_jobs.sql` | `003`, `004` | Creates `job_applications` with `unique (worker_id, job_id)`, `application_status_history`, and `saved_jobs`. |
| **06** | `006_notifications_chat.sql` | `002`, `005` | Creates `notifications`, `conversations` (tied to applications), `conversation_participants`, and `messages`. |
| **07** | `007_storage_metadata.sql` | `003` | Creates `worker_documents` metadata table (private document references). |
| **08** | `008_billing_and_unlocks.sql` | `002`, `004`, `005` | Creates `billing_settings` (default disabled), `payment_orders`, `payment_events`, `job_entitlements`, and `contact_unlocks` with `unique (employer_id, worker_id)`. |
| **09** | `009_audit_and_support.sql` | `002` | Creates immutable `audit_log`, `support_tickets`, and `user_reports`. |
| **10** | `010_indexes_triggers_and_functions.sql` | `001`–`009` | Creates performance indexes, touch triggers, `on_auth_user_created` trigger on `auth.users`, security helper functions (`current_worker_id()`, `is_admin()`, `is_active_employer_member()`), and atomic RPCs (`apply_to_job()` enforcing 20/day IST limit, `submit_job()`). |
| **11** | `011_rls_policies.sql` | `001`–`010` | Enables RLS on all 27 tables; adds granular owner-only, employer-isolated, and admin-restricted access policies. |
| **12** | `012_views_and_safe_discovery.sql` | `003`, `010`, `011` | Implements `public.discover_workers()` RPC returning SHA-256 hashed handles and non-identifying attributes only. |
| **13** | `013_test_fixtures_staging_only.sql` | `001`–`012` | Staging fixture validation gate (disabled for production). |
| **14** | `014_database_verification.sql` | `001`–`013` | Read-only schema verification diagnostics checking RLS flags and constraints. |
| **15** | `015_data_retention_and_cleanup.sql` | `001`–`014` | Data retention policy template and audit ledger preservation. |

---

## 3. Initial Owner Setup via SQL Editor

Because the application deliberately prohibits self-assigning admin or employer roles:

### Step A: Provisioning Initial Verified Employer (Template)
```sql
-- Run in Supabase SQL Editor after user signs up via Email Magic Link
with new_org as (
  insert into public.employers (legal_name, employer_type, verification_state, created_by)
  values ('Ghar-Tak Parcels Pvt Ltd', 'company', 'verified', '<EMPLOYER_AUTH_UUID>'::uuid)
  returning id
)
insert into public.employer_memberships (employer_id, user_id, role, state)
select id, '<EMPLOYER_AUTH_UUID>'::uuid, 'owner', 'active' from new_org;
```

### Step B: Provisioning First Admin Principal (Template)
```sql
-- Run in Supabase SQL Editor to designate a trusted operator as admin
insert into public.admin_principals (user_id, provisioned_by, reason)
values ('<ADMIN_AUTH_UUID>'::uuid, 'Platform Owner', 'Initial Admin Provisioning');
```
