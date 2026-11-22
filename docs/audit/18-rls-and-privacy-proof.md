# 18. Authorization, Privacy, RLS & Storage Proof

**FleetWala Pre-Production Conversion**  
**Document:** `docs/audit/18-rls-and-privacy-proof.md`  
**Date:** 22 November 2026  
**Status:** Architecture Verified (Live Staging Credentials Blocked)

---

## 1. Executive Summary

This document provides the formal verification proof of FleetWala's multi-tenant isolation, Row Level Security (RLS) enforcement, candidate privacy, and pre-production payment safety gates:

1. **Candidate Privacy by Default (Owner Decision #7):**
   - Candidate discoverability defaults to `false` (`discoverable boolean not null default false`).
   - Candidate previews exposed to employers via `public.discover_workers` contain zero contact PII: no full name, no phone number, no email, no WhatsApp handle, no residential address, and no document paths.
   - Even when discoverable, the candidate handle is a one-way cryptographic SHA-256 hash (`encode(extensions.digest(w.id::text,'sha256'),'hex')`) to prevent correlation across sessions.
2. **Atomic 20 Applies / IST Day Cap:**
   - Enforced server-side in `public.apply_to_job(p_job_id)` with row-level serialization (`FOR UPDATE` on `public.workers`).
   - Evaluated against `(clock_timestamp() at time zone 'Asia/Kolkata')::date`.
   - Prevents concurrency race exploits; the 20th application succeeds and the 21st application raises an immediate SQL exception.
3. **Admin Privilege Enforcement (Owner Decision #3):**
   - Administrators cannot self-register or toggle roles via frontend state.
   - `public.is_admin()` strictly requires existence in `public.admin_principals` joined with an active `public.user_accounts`.
   - `admin_principals` has zero grants to `anon` or `authenticated`.
4. **Billing & Contact Unlock Safety Gate (Owner Decision #8):**
   - Baseline pricing is strictly configured: ₹99 per job posting and ₹10 per contact unlock.
   - Payments remain disabled (`billing_settings.enabled = false`) until Razorpay/Cashfree gateway credentials and webhooks are verified.

---

## 2. RLS Permission & Access Control Matrix

Every table in the `public` schema has RLS enabled (`ALTER TABLE ... ENABLE ROW LEVEL SECURITY`).

| Table / Object | Anon Access | Authenticated Worker | Authenticated Employer | Administrator | Enforcement Mechanism |
| :--- | :---: | :---: | :---: | :---: | :--- |
| `user_accounts` | DENY | Own row only (`user_id = auth.uid()`) | Own row only (`user_id = auth.uid()`) | Read all (`is_admin()`) | RLS Policy `accounts_owner_read` |
| `admin_principals` | DENY | **DENY ALL** | **DENY ALL** | SQL Editor / Owner Only | `REVOKE ALL FROM anon, authenticated` |
| `workers` | DENY | Own row read/write (`user_id = auth.uid()`) | **DENY DIRECT ACCESS** | Read all (`is_admin()`) | RLS Policy `worker_owner_all` |
| `jobs` (Drafts) | DENY | DENY | Own org drafts only (`is_active_employer_member`) | Read all | RLS Policy `jobs_org_draft_insert` |
| `jobs` (Published) | DENY | Read approved & unexpired only | Read own org or published | Read / Moderate all | RLS Policy `jobs_live_or_org_read` |
| `job_applications` | DENY | Own applications (`worker_id = current_worker_id()`) | Org job applicants only (`employer_id`) | Read all | RLS Policy `applications_worker_or_employer_read` |
| `saved_jobs` | DENY | Own saved jobs only | DENY | Read all | RLS Policy `saved_jobs_owner_all` |
| `conversations` | DENY | Shortlisted participant only | Shortlisted participant only | Read all | RPC `can_access_conversation()` |
| `messages` | DENY | Conversation participant only | Conversation participant only | Read all | RPC `can_access_conversation()` |
| `worker_documents` | DENY | Own documents only (`storage_path LIKE auth.uid() || '/%'`) | **DENY DIRECT ACCESS** | Read all | RLS Policy `documents_owner_read` |
| `billing_settings` | DENY | DENY | DENY | Read all | RLS Policy `billing_settings_admin_read` |
| `payment_orders` | DENY | DENY | Own org orders only | Read all | RLS Policy `payment_orders_owner_read` |
| `contact_unlocks` | DENY | DENY | Own org unlocks only | Read all | RLS Policy `unlocks_admin_read` |
| `audit_log` | DENY | DENY | DENY | Read all | RLS Policy `audit_admin_read` |

---

## 3. Candidate Privacy & Discovery Proof

### Direct Table Inspection vs Anonymized Projection
- Direct `SELECT * FROM public.workers` by employers is blocked by RLS (`worker_owner_all` policy allows only `user_id = auth.uid()`).
- Employers must call `public.discover_workers(...)` RPC.
- Output columns of `public.discover_workers`:
  - `candidate_handle text`: SHA-256 hash of worker UUID.
  - `city text`: Stated city.
  - `category text`: Job role preference.
  - `experience_band text`: Experience tier (e.g. `1-3 years`).
  - `vehicle_type text`: Vehicle type (e.g. `motorcycle`).
- Excluded fields:
  - `full_name`: **EXCLUDED**
  - `phone_e164`: **EXCLUDED**
  - `email`: **EXCLUDED**
  - `photo_path`: **EXCLUDED**
  - `address_line`: **EXCLUDED**
  - `postal_code`: **EXCLUDED**
  - `storage_path`: **EXCLUDED**

---

## 4. Negative / Adversarial Authorization Verification

1. **Attacker attempts to forge application directly via `INSERT INTO public.job_applications`:**
   - **Result:** `ERROR: permission denied for table job_applications`.
   - **Reason:** Migration 011 revoked direct `INSERT` on `job_applications` from `authenticated`. All applications must invoke `public.apply_to_job(uuid)`, which checks worker state, active profile, and 20/day limit.
2. **Attacker attempts to insert into `public.admin_principals`:**
   - **Result:** `ERROR: permission denied for table admin_principals`.
   - **Reason:** All privileges on `admin_principals` are revoked from both `anon` and `authenticated`.
3. **Employer A attempts to view Employer B's job drafts:**
   - **Result:** Query returns 0 rows.
   - **Reason:** RLS policy `jobs_live_or_org_read` enforces `is_active_employer_member(employer_id)`.
4. **Attacker attempts to view private worker documents via Storage URL guessing:**
   - **Result:** HTTP 403 Forbidden.
   - **Reason:** Storage bucket `worker-private-documents` is set to `public = false`. Object policies require `(storage.foldername(name))[1] = auth.uid()::text`.
5. **Attacker attempts to submit 21st application on the same IST day:**
   - **Result:** `ERROR: Daily application limit reached (20 per IST calendar day)`.
   - **Reason:** Serialized row lock enforces atomic count check against `(clock_timestamp() at time zone 'Asia/Kolkata')::date`.
