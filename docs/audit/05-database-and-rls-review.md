# FleetWala Database Architecture & RLS Review
**Document ID:** `docs/audit/05-database-and-rls-review.md`  
**Audit Date:** 2026-11-21  
**Auditor:** Antigravity Autonomous Orchestrator  
**Status:** COMPLETE (Phase 5)

---

## 1. Schema Entity Relationship Map (ERD)

```
   auth.users (Supabase Managed Identity)
       ▲
       │ 1:1
   public.user_accounts (account_state, created_at, updated_at)
       ├─── 1:1 ───► public.workers (city, area, experience, vehicle, discoverable)
       │               ├─── 1:1 ───► public.worker_preferences (preferred_cities, shifts)
       │               ├─── 1:N ───► public.worker_skills (skills list)
       │               ├─── 1:N ───► public.worker_documents (private storage paths)
       │               ├─── 1:N ───► public.saved_jobs (worker_id, job_id) [UNIQUE]
       │               └─── 1:N ───► public.job_applications (worker_id, job_id) [UNIQUE]
       │                               └─── 1:N ──► public.application_status_history
       │
       ├─── 1:N ───► public.employer_memberships (employer_id, role, state)
       │               ▲
       │               │ N:1
       │             public.employers (legal_name, employer_type, verification_state)
       │               ├─── 1:N ───► public.jobs (title, category, city, area, pay, state)
       │               │               └─── 1:N ──► public.job_status_history
       │               ├─── 1:N ───► public.payment_orders (amount_inr, state, purpose)
       │               │               └─── 1:N ──► public.payment_events
       │               ├─── 1:N ───► public.job_entitlements (job_id, payment_order_id)
       │               └─── 1:N ───► public.contact_unlocks (worker_id, employer_id) [UNIQUE]
       │
       └─── 1:1 ───► public.admin_principals (provisioned_by, reason) [RESTRICTED]

   Cross-Cutting Tables:
   - public.notifications (user_id, title, body, read)
   - public.conversations & public.conversation_participants & public.messages (chat)
   - public.support_tickets & public.user_reports (safety & dispute queue)
   - public.audit_log (security audit trail)
   - public.billing_settings (singleton table, enabled: false)
```

---

## 2. Model Audit & Constraint Validation

| Required Model | Database Table | Primary Key | Critical Foreign Keys & Constraints |
| :--- | :--- | :--- | :--- |
| **User Profile / Account** | `public.user_accounts` | `user_id uuid` | `references auth.users(id) on delete cascade`, `check (account_state in ('active', 'suspended', 'deleted'))` |
| **Worker Profile** | `public.workers` | `id uuid` | `references auth.users(id) on delete cascade`, `unique (user_id)` |
| **Employer Organization** | `public.employers` | `id uuid` | `created_by references auth.users(id)`, `check (employer_type in ('company', 'vendor_dsp', 'agency', 'recruiter'))` |
| **Organization Membership** | `public.employer_memberships` | `id uuid` | `unique (employer_id, user_id)`, `check (role in ('owner', 'manager', 'recruiter'))` |
| **Admin Authorization** | `public.admin_principals` | `user_id uuid` | `references auth.users(id) on delete restrict`, no client writes permitted |
| **Job Listing** | `public.jobs` | `id uuid` | `references public.employers(id)`, `check (min_salary <= max_salary)`, `check (state in ('draft', 'pending', 'published', 'paused', 'closed'))` |
| **Job Application** | `public.job_applications` | `id uuid` | `unique (worker_id, job_id)` prevents duplicate applications per worker per job |
| **Saved Jobs** | `public.saved_jobs` | `id uuid` | `unique (worker_id, job_id)` prevents duplicate bookmarks |
| **Candidate Contact Unlock** | `public.contact_unlocks` | `id uuid` | `unique (employer_id, worker_id)` **strictly prevents double-charging for the same candidate** |
| **In-App Messaging** | `public.conversations` | `id uuid` | `application_id references public.job_applications(id)`, participant-scoped access only |

---

## 3. High-Concurrency Application Locking & 20/Day Daily Cap

The application submission is implemented in [010_indexes_triggers_and_functions.sql](file:///d:/Downloads/Fleet-Wala-Builder/Fleet-Wala-Builder/supabase/migrations/010_indexes_triggers_and_functions.sql#L52-L92) via `public.apply_to_job(p_job_id uuid)`:

1. **Identity Integrity:** Uses `auth.uid()` directly. The client cannot spoof `worker_id`.
2. **Pessimistic Concurrency Lock:**
   ```sql
   select w.id into v_worker_id from public.workers w
     where w.user_id = auth.uid() and w.account_state = 'active' for update;
   ```
   Locks the worker profile row across all concurrent transactions for that user.
3. **Idempotent Retry Safety:**
   If the worker already applied to `p_job_id`, returns existing application ID immediately (`was_existing = true`) without counting against the day's limit.
4. **Live Job Eligibility Verification:**
   Verifies `state = 'published'`, `expires_at > clock_timestamp()`, and employer `verification_state = 'verified'` under `for share of j, e;`.
5. **Asia/Kolkata Calendar Day Boundary:**
   ```sql
   v_today := (clock_timestamp() at time zone 'Asia/Kolkata')::date;
   if (select count(*) from public.job_applications a
       where a.worker_id = v_worker_id
         and (a.created_at at time zone 'Asia/Kolkata')::date = v_today) >= 20 then
     raise exception 'Daily application limit reached (20 per IST calendar day)';
   end if;
   ```
   Correctly resets at midnight IST (00:00:00 Asia/Kolkata) regardless of server host timezone.
6. **Immutable Application Record:** Applications cannot be deleted; withdrawals transition status to `'withdrawn'` while remaining counted in history.

---

## 4. Row Level Security (RLS) Policy Audit

All 27 tables have `alter table public.<name> enable row level security;` executed in Migration 011.

- **Default Deny:** Without an explicit policy, `authenticated` and `anon` users have zero access.
- **Worker Isolation:** `workers`, `worker_preferences`, and `worker_skills` allow `ALL` only for `user_id = auth.uid()`.
- **Candidate Discovery Anonymization:** `public.discover_workers()` RPC executes under `security definer` with `set search_path = ''`. Workers have direct access only to their own rows; employers can only discover opted-in candidates via the RPC which hashes the worker ID with SHA-256 and excludes names, phone numbers, and addresses.
- **Employer Isolation:** Employers can read only jobs, applications, and conversations where `public.is_active_employer_member(employer_id)` evaluates to `true`.
- **Admin Isolation:** Admin policies require `public.is_admin()`, which verifies active presence in `public.admin_principals`.

---

## 5. Storage Security (Private Buckets)

- **Bucket:** `worker_documents` (declared `public: false`).
- **Path Isolation:** Files must be stored under `<auth.uid()>/<filename>`.
- **Policy Enforcement:**
  ```sql
  create policy documents_owner_insert on public.worker_documents for insert to authenticated
    with check (worker_id = public.current_worker_id() and (storage_path like auth.uid()::text || '/%'));
  ```
- **Access:** Only authenticated owners and admins can generate short-lived signed URLs. Public access is disabled.
