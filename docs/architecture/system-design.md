# FleetWala — System Architecture & System Design Document

**Document ID:** FW-ARCH-001  
**Target Environment:** Local Pre-Production (Windows Development)  
**Database:** Remote Supabase PostgreSQL (`jigbzsaaowtyaqhreplg`)  
**Frontend:** React 19 + Vite 7 + TypeScript + Tailwind CSS 4 (`http://localhost:3000`)  
**Backend:** Express 5 (`http://localhost:5000`)  
**Branch:** `real-preproduction-conversion`  

---

## 1. Executive System Context & Trust Boundaries

FleetWala is an on-demand logistics workforce and hiring marketplace designed specifically for the Indian supply chain ecosystem (covering hyper-local delivery, 2-wheeler/3-wheeler delivery partners, warehouse sorters, and hub associates).

```
                      TRUST BOUNDARY 1 (Public Internet / Browser Client)
 +-------------------------------------------------------------------------------+
 |                                                                               |
 |   Prospective Workers / Visitors        Registered Workers / Employers        |
 |   [Unauthenticated / Anon]              [Authenticated JWT: Role Bearer]      |
 |              |                                          |                     |
 |              v                                          v                     |
 |   +-----------------------------------------------------------------------+   |
 |   |              React 19 Single Page Application (Vite 7)                |   |
 |   |    - AuthProvider / useAuth()                                         |   |
 |   |    - Protected Routes (Admin, Employer, Worker)                       |   |
 |   |    - TanStack Query (Server State Cache + Invalidation)               |   |
 |   |    - Role Navigation & Atomic Logout                                  |   |
 |   +-----------------------------------------------------------------------+   |
 +----------------------|-----------------------------------|--------------------+
                        |                                   |
       TRUST BOUNDARY 2 | (HTTPS / WSS / REST RPCs)         | (Internal IPC / Local)
                        v                                   v
 +---------------------------------------------------+  +------------------------+
 |         Supabase Managed Cloud Platform           |  | Express 5 API Server   |
 |             (jigbzsaaowtyaqhreplg)                |  | (Localhost:5000)       |
 |                                                   |  |                        |
 |  +---------------------------------------------+  |  | - Healthz Monitoring   |
 |  | GoTrue Auth Service                         |  |  | - Mock Payment Webhook|
 |  | - JWT Minting & Token Refresh               |  |  |   (Pending Razorpay)   |
 |  | - Email / Password & Google OAuth           |  |  +------------------------+
 |  +---------------------------------------------+  |
 |  | PostgreSQL 15 Engine + PostgREST            |  |
 |  | - Row Level Security (RLS) on all tables    |  |
 |  | - SECURITY DEFINER RPC Boundary             |  |
 |  |   * get_public_published_jobs()             |  |
 |  |   * apply_to_job()                          |  |
 |  |   * submit_job()                            |  |
 |  |   * review_job()                            |  |
 |  |   * is_admin()                              |  |
 |  | - Supabase Storage (Private KYC Buckets)    |  |
 |  +---------------------------------------------+  |
 +---------------------------------------------------+
```

### Trust Boundary Analysis
1. **Client Browser Boundary:**
   - Client-side code is entirely untrusted. Role-based rendering in React (e.g. hiding admin panels or disabling buttons) is purely an ergonomic UI guard.
   - All actual business rules, daily quotas, profile access controls, and job publishing privileges are strictly enforced inside PostgreSQL via RLS policies and `SECURITY DEFINER` RPC functions.
2. **PostgREST / API Layer:**
   - Direct DML and table-level `SELECT` on sensitive tables (`jobs`, `employers`, `workers`, `job_applications`, `support_tickets`) are restricted.
   - Anonymous visitors have direct table-level access revoked (`42501 Insufficient Privileges`) on `public.jobs` and `public.employers`. Discovery of active, published job listings occurs exclusively via the hardened `public.get_public_published_jobs()` RPC, preventing exposure of unapproved drafts or employer internal IDs.
3. **Database Core Boundary:**
   - PostgreSQL RLS guarantees tenant isolation. An employer organization can never read, update, or delete another organization's jobs, applicants, or billing credits.
   - Worker phone numbers are masked by default to prevent harvesting. Candidate contact details are only unlocked when an employer uses authorized contact unlock quotas.

---

## 2. Component and Data Flow Map

```
 +---------------------------------------------------------------------------------+
 |                               FRONTEND ARCHITECTURE                             |
 |                                                                                 |
 |  [App.tsx] Router                                                               |
 |    |-- / (Redirects based on role)                                              |
 |    |-- /welcome (Public Landing & Hero)                                         |
 |    |-- /jobs, /jobs/:id (Public / Authenticated Job Browsing & Detail)          |
 |    |-- /login, /signup, /verify-email, /forgot-password (Auth Flows)            |
 |    |-- /privacy, /terms, /support, /help (Dedicated Legal & Grievance Routes)   |
 |    |-- <ProtectedWorkerRoute> -> /worker/* (Profile, My Applications, Settings) |
 |    |-- <ProtectedEmployerRoute> -> /employer/* (Dashboard, Jobs, Candidates)   |
 |    |-- <ProtectedAdminRoute> -> /admin/* (Audit, Job Moderation, Approvals)     |
 |                                                                                 |
 |  State Management Layer:                                                        |
 |    |-- AuthContext: User, Session, Role Status, Atomic Logout                   |
 |    |-- TanStack Query: Caching, Auto-retry, TTLs, Keyed Invalidation            |
 |    |-- UI Store: Ephemeral toasts, modal states, clean non-mock defaults        |
 +----------------------------------------+----------------------------------------+
                                          |
                      Supabase Client RPC & PostgREST Calls
                                          |
                                          v
 +---------------------------------------------------------------------------------+
 |                              BACKEND & DATABASE RPCs                            |
 |                                                                                 |
 |  Authentication:                                                                |
 |    - auth.users (Managed GoTrue identities)                                     |
 |    - auth.uid() mapped in RLS policies                                          |
 |                                                                                 |
 |  Security Definer RPCs:                                                         |
 |    - get_public_published_jobs(): Returns only approved published jobs         |
 |    - apply_to_job(p_job_id): Enforces 20/IST-day cap, checks worker status      |
 |    - submit_job(p_job_id): Validates employer ownership & transitions to review |
 |    - review_job(p_job_id, p_decision, p_notes): Allowlisted admin moderation    |
 |    - register_employer(p_name, p_city, ...): Creates employer & member record   |
 |    - discover_candidates(p_city, p_role): Anonymized candidate pool             |
 |    - is_admin(): Validates UID against public.admin_principals                  |
 +---------------------------------------------------------------------------------+
```

---

## 3. Role Resolution State Machine

FleetWala implements an explicit role-state machine evaluated dynamically upon authentication:

```
                      +-------------------+
                      |      Visitor      |
                      | (Unauthenticated) |
                      +---------+---------+
                                |
                   Sign In / Google OAuth / Sign Up
                                |
                                v
                     +---------------------+
                     | Authenticated User  |
                     |     (auth.uid)      |
                     +----------+----------+
                                |
             +------------------+------------------+
             |                                     |
             v                                     v
   Check admin_principals            Check public.workers vs employers
             |                                     |
    +--------+--------+               +------------+------------+
    |                 |               |                         |
[Match]            [No]         [Worker Profile]       [Employer Org Member]
    |                 |               |                         |
    v                 v               v                         v
+-------+             |      +-----------------+       +-----------------+
| Admin |             |      | Worker Complete |       | Employer Active |
+-------+             |      +-----------------+       +-----------------+
                      |               ^                         ^
                      |               |                         |
                      |      +-----------------+       +-----------------+
                      +----->|Worker Incomplete|       | Employer No Org |
                             | (Needs Profile) |       | (Needs Org Reg) |
                             +-----------------+       +-----------------+
```

### State Resolution Rules:
1. **Visitor:** Anonymous session. Can browse published jobs via `get_public_published_jobs()`, read `/privacy`, `/terms`, `/support`, `/help`. Cannot apply or post jobs.
2. **Worker (Incomplete):** User authenticated, but `public.workers` row missing. Prompted to complete `/onboarding/worker`.
3. **Worker (Complete):** Profile active in `public.workers`. Can view job details, apply (subject to 20/IST-day cap), track applications, view privacy settings, and initiate account deletion requests.
4. **Employer (No Org):** User authenticated with employer intent, but has no linked row in `public.employer_members`. Prompted to register company on `/onboarding/employer`.
5. **Employer (Active):** Linked to verified organization in `public.employers`. Can create draft jobs, submit jobs for review, view candidate matches, and manage hiring team.
6. **Admin:** UID strictly present in `public.admin_principals`. Granted access to `/admin` dashboard, moderation queues, audit logs, and ticket triaging.

---

## 4. TanStack Query Cache Boundaries & Invalidation Lifecycle

To guarantee zero stale data leaks across user sessions or role transitions, TanStack Query is configured with strict cache boundaries:

### Cache Configuration
- **Global `staleTime`:** `30,000ms` (30 seconds) — balances responsiveness with near-real-time updates.
- **Global `gcTime` (Garbage Collection):** `300,000ms` (5 minutes).
- **Auto-refetch:** Triggered on window focus and network reconnect.

### Key Hierarchy
- `['jobs', 'public']`: Unauthenticated/public published jobs listing.
- `['jobs', 'detail', jobId]`: Specific job details.
- `['jobs', 'employer', orgId]`: Employer's own created jobs (draft, pending_review, published, closed).
- `['applications', 'worker']`: Authenticated worker's active and historical applications.
- `['applications', 'job', jobId]`: Employer's applicants for a specific job listing.
- `['admin', 'jobs', 'pending']`: Moderation queue for allowlisted admins.
- `['auth', 'profile']`: Active user's profile and membership claims.

### Invalidation Triggers
1. **Worker Job Application (`apply_to_job`):**
   - Invalidates: `['applications', 'worker']`, `['jobs', 'detail', jobId]`.
2. **Employer Submits Job (`submit_job`):**
   - Invalidates: `['jobs', 'employer', orgId]`, `['admin', 'jobs', 'pending']`.
3. **Admin Approves/Rejects Job (`review_job`):**
   - Invalidates: `['admin', 'jobs', 'pending']`, `['jobs', 'employer']`, `['jobs', 'public']`.
4. **Sign Out (Atomic Logout):**
   - Direct execution of `queryClient.clear()`.
   - Purges all cached queries, preventing previous user's data from being accessed via browser back-button or subsequent sessions.

---

## 5. Security Definer RPC Catalog

All privileged state transitions bypass direct table permissions and run via security-hardened functions:

| Function Name | Invoker | Purpose | Security Safeguards |
|:---|:---|:---|:---|
| `get_public_published_jobs()` | `anon`, `authenticated` | Public job feed for visitors & workers | Filters strictly by `state = 'published'`, returns sanitized fields only |
| `apply_to_job(p_job_id)` | `authenticated` | Worker submits application | Enforces 20/IST-day cap, ensures job is published, prevents duplicate applications |
| `submit_job(p_job_id)` | `authenticated` | Employer submits draft for review | Verifies employer membership, enforces non-empty fields, transitions state to `pending_review` |
| `review_job(p_job_id, p_decision, p_notes)` | `authenticated` (Admin only) | Moderates pending job | Enforces caller is in `admin_principals`, sets state to `published` or `rejected`, writes audit log |
| `is_admin()` | `authenticated` | Checks admin authorization | Returns boolean strictly based on `admin_principals` membership |
| `register_employer(...)` | `authenticated` | Creates employer org and owner membership | Runs in transaction; creates org, member record, and audit entry atomically |
| `discover_candidates(...)` | `authenticated` (Employer) | Finds candidate matches | Anonymizes candidate names & phone numbers until unlocked |

---

## 6. Data Retention & DPDP Act 2023 Compliance Lifecycle

FleetWala is architected in full alignment with the **Digital Personal Data Protection (DPDP) Act 2023** of India:

1. **Purpose Limitation & Data Minimization:**
   - Worker profiles collect only operational hiring data (work category, driving license type, city, preferred shift).
   - Standard Aadhaar numbers are **never stored**; voluntary identity verification is handled via phone OTP or partner verification APIs.
2. **Contact Privacy by Default:**
   - Worker phone numbers are masked in search listings (`+91 98XXX XXXXX`) until explicitly unlocked by an authorized employer.
3. **Right to Erasure (Account Deletion):**
   - Workers and employers can submit a data deletion request directly from `/worker/settings` or `/support`.
   - Soft-deletion disables login and masks personal identifiers; database retention schedules purge raw logs after the legally mandated audit window.
4. **Intermediary Status & Grievance Redressal:**
   - FleetWala acts as an intermediary under Section 79 of the Information Technology Act, 2000.
   - Dedicated grievance redressal channel (`/support`) with an automated SLA of 24-hour receipt acknowledgment and 15-day resolution under the IT (Intermediary Guidelines and Digital Media Ethics Code) Rules, 2021.
