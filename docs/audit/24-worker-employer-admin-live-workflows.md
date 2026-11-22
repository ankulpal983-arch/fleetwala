# 24 — Real Worker, Employer & Admin Live Workflows Audit Report

- **Document ID**: `DOC-AUDIT-024-LIVE-WORKFLOWS`
- **Target Supabase Reference**: `jigbzsaaowtyaqhreplg`
- **Target Supabase URL**: `https://jigbzsaaowtyaqhreplg.supabase.co`
- **Active Git Branch**: `real-preproduction-conversion`
- **Date**: 22 November 2026
- **Status**: **LIVE REAL WORKFLOWS WIRED & VALIDATED**

---

## 1. Executive Summary

This report documents the end-to-end integration of FleetWala's core persona workflows (Worker, Employer, and Administrator) with real Supabase database tables, Row Level Security policies, and stored procedures.

All simulated success notifications, mock listings, hardcoded candidates, and client-side administrative overrides have been decoupled from the live staging application.

---

## 2. Worker Persona Real Workflows (Phase 8)

### 2.1 Profile Onboarding & Persistence
- **Route**: `/onboarding/worker` & `/profile`
- **Database Table**: `public.workers`
- **Check Constraint Mappings**:
  - `experience_band`: UI `'1–3 years'` mapped to database check `'1-3'`; `'Fresher'` mapped to `'fresher'`.
  - `vehicle_type`: UI `'Two-wheeler'` mapped to database check `'motorcycle'`; `'E-bike'` mapped to `'ev'`.
- **Privacy Enforcement**:
  - `discoverable` defaults to `false`.
  - Workers must explicitly opt in before appearing in candidate discovery queries.
  - Zero PII (no phone numbers, email addresses, or Aadhaar identity documents) are exposed to public queries.
- **Status**: **PASS**

### 2.2 Live Job Discovery & Search
- **Route**: `/` (Find Jobs) & `/jobs/:id` (Job Detail)
- **Database Table**: `public.jobs`
- **RLS Policy**: `jobs_live_or_org_read` guarantees that authenticated workers can only read jobs where `state = 'published'`, `expires_at > now()`, and `is_verified_employer(employer_id) = true`.
- **Empty State Integrity**: When 0 published jobs exist in the live staging database, the UI renders an honest empty state ("No jobs match yet") rather than injecting fake demo vacancies.
- **Status**: **PASS**

### 2.3 Atomic Application Submission & 20/Day Rate Limit
- **RPC Function**: `public.apply_to_job(p_job_id uuid)`
- **Concurrency & Rate Limit Protection**:
  - Uses `pg_advisory_xact_lock` / row locks to prevent race conditions during rapid concurrent clicks across multiple tabs.
  - Calculates daily count using `(created_at at time zone 'Asia/Kolkata')::date`.
  - Strictly enforces maximum **20 applications per worker per IST calendar day**.
  - Idempotent: Subsequent clicks on an already applied job safely return `was_existing: true` without double-counting against the worker's quota.
- **Status**: **PASS**

---

## 3. Employer Persona Real Workflows (Phase 9)

### 3.1 Organization Onboarding & Membership
- **Route**: `/onboarding/employer`
- **Database Tables**: `public.employers`, `public.employer_memberships`
- **RPC Function**: `public.register_employer(p_legal_name, p_employer_type)`
- **Trust Guarantee**:
  - Direct client `INSERT` on `public.employers` is revoked.
  - Onboarding via `register_employer` RPC strictly forces `verification_state = 'pending'`.
  - An employer cannot mark itself verified or bypass trust moderation through frontend manipulation.
  - Automatically creates organization owner membership (`role = 'owner'`, `state = 'active'`).
- **Status**: **PASS**

### 3.2 Job Creation & Moderation Pipeline
- **Route**: `/employer/jobs`
- **Database Tables**: `public.jobs`, `public.job_status_history`
- **State Machine**:
  - `draft`: Created by employer owner/manager; private to organization members.
  - `pending_review`: Submitted via `submit_job(p_job_id)` RPC; locked against further edits.
  - `published`: Approved by administrator via `review_job` RPC; visible to workers only after employer is verified.
- **Pricing Baseline**:
  - PRD-agreed ₹99 per job posting displayed with clear Pre-Production Payment Gate Active banner.
  - Real credit card charges remain disabled (`billing_settings.enabled = false`).
- **Status**: **PASS**

### 3.3 Safe Candidate Discovery Preview
- **Route**: `/employer/candidates`
- **RPC Function**: `public.discover_workers(...)`
- **Privacy & Security Constraints**:
  - Can only be executed by active members of verified employers.
  - Filters strictly by `discoverable = true` and `account_state = 'active'`.
  - Returns only SHA-256 hashed handles (`candidate_handle`), city, category, experience band, and vehicle type.
  - Full names, phone numbers, and private documents are never exposed in candidate discovery.
- **Contact Unlock Baseline**:
  - PRD-agreed ₹10 per candidate unlock displayed.
  - Contact unlock simulations are disabled during pre-production.
- **Status**: **PASS**

---

## 4. Administrator Persona Real Workflows (Phase 10)

### 4.1 Strict Allowlist Authorization
- **Route**: `/admin`, `/admin/jobs`, `/admin/employers`, `/admin/audit`
- **Authorization Table**: `public.admin_principals`
- **Helper Routine**: `public.is_admin()`
- **Enforcement**:
  - Direct access to `public.admin_principals` is completely revoked from `anon` and `authenticated`.
  - Ordinary workers and employers navigating to `/admin` are presented with an `Administrator Access Denied` screen.
  - Switching the workspace dropdown in the UI does not grant backend authorization.
- **Status**: **PASS**

### 4.2 Job Moderation Queue
- **RPC Function**: `public.review_job(p_job_id uuid, p_approve boolean, p_reason text)`
- **Capabilities**:
  - Allows verified administrators to inspect job details and employer verification status.
  - Approving moves job state from `pending_review` to `published`.
  - Rejecting returns job to `draft` with the administrator's moderation note attached for the employer to revise.
  - Emits immutable audit records to `public.audit_log`.
- **Status**: **PASS**

---

## 5. Summary Workflow Verification Matrix

| Workflow Domain | Test Target | Backend Routine / Table | Result |
| :--- | :--- | :--- | :---: |
| **Worker Registration** | Email/Password Signup | `auth.users` -> `user_accounts` trigger | **PASS** |
| **Worker Onboarding** | Profile Persistence | `public.workers` | **PASS** |
| **Worker Discovery Opt-In** | Default Discoverability OFF | `workers.discoverable = false` | **PASS** |
| **Job Application** | Atomic IST 20/day limit | `public.apply_to_job(uuid)` | **PASS** |
| **Duplicate Application** | Idempotent handling | `unique(worker_id, job_id)` constraint | **PASS** |
| **Employer Registration** | Pending verification org | `public.register_employer(text, enum)` | **PASS** |
| **Job Submission** | Move draft to pending | `public.submit_job(uuid)` | **PASS** |
| **Candidate Discovery** | SHA-256 anonymized cards | `public.discover_workers(...)` | **PASS** |
| **Admin Moderation** | Approve / Reject listing | `public.review_job(uuid, bool, text)` | **PASS** |
| **Admin Security** | Deny ordinary user access | `public.is_admin()` via `admin_principals` | **PASS** |
| **Payment Gate** | Prevent live charges | `billing_settings.enabled = false` | **PASS** |
