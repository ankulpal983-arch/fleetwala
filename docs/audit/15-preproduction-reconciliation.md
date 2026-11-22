# FleetWala Pre-Production Reconciliation & Architecture Mapping
**Document ID:** `docs/audit/15-preproduction-reconciliation.md`  
**Date:** 2026-11-22  
**Auditor:** Antigravity Autonomous Orchestrator  
**Status:** COMPLETE (Phase 0 Baseline)

---

## 1. Executive Reconciliation: Original PRD vs Pilot vs New Pre-Production Baseline

| Dimension | Original PRD (12 Nov 2026) | Replit Generated Pilot (Prior) | Owner-Approved Pre-Production Baseline (22 Nov 2026) |
| :--- | :--- | :--- | :--- |
| **Platform Target** | Native Expo Mobile App for workers; Web employer/admin "future" | React 19 + Vite 7 SPA with simulated pilot state | **Full Responsive Web SaaS** (Worker, Employer, Admin). Retain Vite/Express stack. Mobile-responsive web. |
| **Authentication Identity** | Clerk Authentication | Supabase Auth with Indian Phone OTP + Email Magic Link | **Supabase Auth ONLY**: Real Email + Password, Google OAuth, and GitHub OAuth for Workers and Employers. No Clerk. |
| **Phone OTP / MSG91 / DLT** | Phone OTP first | Hardcoded Phone OTP adapter via Supabase Phone Auth | **DEFERRED**. Remove active phone OTP requirement from login UI. Phone is optional profile data only; no SMS gateway dependency. |
| **Admin Access & Roles** | Role switcher demo | Top-level workspace switcher (`Shell.tsx`) | **Server-side allowlist (`admin_principals`) only**. Email/password + MFA. Zero client-side self-registration or switcher authorization. |
| **Data Layer & Persistence**| Local fixtures / Supabase proposal | Browser `localStorage` (`fleetwala.pilot.v1`) + 15 unexecuted SQL files | **Real Supabase PostgreSQL + RLS**. Retire silent localStorage demo persistence in authenticated staging mode. |
| **Worker Applications** | Free, 20/day limit | Local memory counter (`rules.ts`) | **Atomic server-side RPC `apply_to_job()`** enforcing 20/IST-day cap, concurrency locks, and duplicate prevention. |
| **Pricing & Monetization** | ₹99 job post, ₹10 contact unlock | Displayed in UI; billing disabled | **Gated / Disabled Pre-Production**. ₹99/job and ₹10/unlock preserved in DB schema; real checkout disabled until gateway keys provided. |
| **Worker Privacy** | Opt-in discovery | `discoverable: false` by default in local state | **Discoverability OFF by default**. Backend `discover_workers` RPC returns SHA-256 hashed handle; contact details strictly locked. |

---

## 2. Source-Level Capability & Route Mapping

The following matrix maps every route, its current demo implementation, and its target staging integration:

| Surface | Route | Current Demo Implementation (`store.tsx` / `fixtures.ts`) | Pre-Production Target (Supabase DB / Auth / RLS) |
| :--- | :--- | :--- | :--- |
| **Public** | `/welcome` | Static marketing landing page | Marketing landing page with Google/GitHub/Email auth entry points |
| **Public** | `/login` | Phone OTP tab + Work Email tab | **Email + Password, Google OAuth, GitHub OAuth**, forgot password |
| **Public** | `/legal/:doc`| Draft terms and privacy notice | Retained legal notices with DPDP Act and no-fee disclosures |
| **Worker** | `/` | `liveJobs(state.jobs)` filtered in memory | `supabase.from('jobs').select()` where `state='published' and expires_at > now()` |
| **Worker** | `/jobs/:id` | `state.jobs.find(id)` | `supabase.from('jobs').select().eq('id', id)` |
| **Worker** | `/saved` | `state.saved` array in localStorage | `supabase.from('saved_jobs').select()` joined to `jobs` |
| **Worker** | `/applications`| `state.applications` in localStorage | `supabase.from('job_applications').select()` joined to status history |
| **Worker** | `/profile` | `state.profile` in localStorage | `supabase.from('workers').select()` / `.update()` for `user_id = auth.uid()` |
| **Worker** | `/settings` | `state.prefs` in localStorage | `supabase.from('worker_preferences').upsert()` (discoverability toggle) |
| **Worker** | `/support` | `state.tickets` in localStorage | `supabase.from('support_tickets').insert()` |
| **Employer** | `/employer` | Filtered `state.jobs` & `state.apps` | `supabase.from('employers').select()` & aggregation counts for user's org |
| **Employer** | `/employer/jobs`| `actions.saveJob` in localStorage | `supabase.from('jobs').insert(draft)` and `submit_job()` RPC |
| **Employer** | `/employer/applicants`| In-memory applicant list | `supabase.from('job_applications').select()` for jobs owned by employer org |
| **Employer** | `/employer/candidates`| Anonymized mock list | `supabase.rpc('discover_workers')` (SHA-256 hashed handles only) |
| **Employer** | `/employer/team`| `state.team` in localStorage | `supabase.from('employer_memberships').select()` |
| **Admin** | `/admin` | `state.jobs.filter('pending')` | Aggregates from `jobs`, `employers`, and `support_tickets` via `is_admin()` |
| **Admin** | `/admin/jobs` | `actions.setJobStatus` in localStorage | `supabase.rpc('review_job')` / `admin_set_job_state()` |
| **Admin** | `/admin/employers`| `actions.setEmployerStatus` in localStorage | `supabase.from('employers').update(verification_state)` via admin RLS |
| **Admin** | `/admin/audit` | `state.audit` in localStorage | `supabase.from('audit_log').select()` (immutable security trail) |

---

## 3. LocalStorage Retirement & Migration Architecture

In the initial prototype, data mutations were handled by `PilotProvider` writing to `localStorage.setItem('fleetwala.pilot.v1', ...)`.

### Retirement Strategy:
1. **Unauthenticated / Demo Browsing:**
   If no Supabase session exists and `VITE_ENABLE_LIVE=false`, users can explore read-only public features.
2. **Authenticated Pre-Production Mode:**
   When an authenticated Supabase session is detected (`session !== null`), the application switches data sources to the **Supabase Repository Layer**.
3. **Removal of Workspace Switcher as Authorization:**
   The top-level switcher (`Shell.tsx`) which allowed switching between Worker, Employer, and Admin views in browser state is restricted to local development debugging only (`process.env.NODE_ENV === 'development'`) and removed as an authorization bypass. Real routes (`/admin`, `/employer`) enforce server-side and RLS checks.

---

## 4. Non-Destructive Database Execution Safety Plan

- The owner has created a Supabase project, but the 15 migrations have **not** been executed yet.
- We will review and verify every migration file (especially Auth triggers, RLS, and constraints) before proposing execution.
- We will provide an exact, idempotent, ordered SQL file and step-by-step Supabase SQL Editor instructions in `docs/audit/17-migration-review-and-execution.md`.
- No database operations will be run against production, and zero destructive `DROP` or `push-force` commands will be issued.
