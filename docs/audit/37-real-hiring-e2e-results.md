# FleetWala Real Hiring End-to-End Workflow Audit

**Document:** `docs/audit/37-real-hiring-e2e-results.md`  
**Execution Timestamp:** 2026-11-22T17:49:30+05:30  
**Phase:** Phase 3 — Worker -> Employer Full Hiring E2E  
**Author:** Antigravity Autonomous Engineering Orchestrator  
**Status:** PASS — Verified Complete Hiring Lifecycle & Privacy Safeguards  

---

## 1. Executive Summary

Phase 3 verifies the end-to-end multi-role hiring workflow spanning Worker, Employer, and Administrator personas in real PostgreSQL database integration. All transitions follow strict state machines, atomic server-side RPC functions, and Row Level Security constraints.

### The Complete End-to-End Hiring Lifecycle:
```
1. Employer Drafts Job  ──>  2. Employer Submits for Review (submit_job RPC)
                                   │
3. Admin Verifies Employer & Approves Job (review_job RPC)
                                   │
                             Jobs Table: state = 'published'
                                   │
4. Worker Browses Jobs  ──>  5. Worker Applies (apply_to_job RPC, 20/day IST limit)
                                   │
                             Application: status = 'applied'
                                   │
6. Employer Reviews Anonymized Candidate Projection
                                   │
7. Employer Shortlists (set_application_status RPC)
        ├── Status -> 'shortlisted'
        ├── In-App Conversation Auto-Provisioned (ensure_application_conversation)
        └── Notification Dispatched to Worker
                                   │
8. In-App Messaging (send_message RPC, verified participants only)
                                   │
9. Final Decision: Hired or Rejected (Terminal states cannot reopen)
```

---

## 2. Worker Lifecycle & Application Constraints

### 2.1 Job Browsing & Eligibility
- **RLS Policy:** `jobs_live_or_org_read` enforces that unauthenticated or worker users can only query jobs where:
  - `state = 'published'`
  - `expires_at > clock_timestamp() OR expires_at IS NULL`
  - `public.is_verified_employer(employer_id) = true`
- **Result:** Drafts, pending review, paused, closed, and jobs belonging to unverified employers remain strictly invisible to workers.

### 2.2 Atomic Job Application (`apply_to_job` RPC)
- **Profile Requirement:** Caller must possess an active worker profile in `public.workers`.
- **Daily Quota:** Limit of 20 applications per worker per `Asia/Kolkata` calendar day:
  ```sql
  v_today := (clock_timestamp() at time zone 'Asia/Kolkata')::date;
  if (select count(*) from public.job_applications a
      where a.worker_id = v_worker_id
        and (a.created_at at time zone 'Asia/Kolkata')::date = v_today) >= 20 then
    raise exception 'Daily application limit reached (20 per IST calendar day)';
  end if;
  ```
- **Idempotency & Concurrency:** Concurrently applying or duplicate clicks return `(application_id, was_existing = true)` without throwing duplicate key exceptions or double-counting against the daily limit.
- **Notification:** Automatically creates a notification record in `public.notifications` for all active employer organization members.

### 2.3 Application History & Tracking
- Workers track their applications via `getLiveApplications()` which reads from `job_applications` and `application_status_history`.
- Workers can withdraw active applications (`status = 'withdrawn'`).

---

## 3. Employer Candidate Review & Status Transitions

### 3.1 Candidate Privacy Projection
- **No PII Leaks:** When employers browse applicants (`getLiveEmployerApplicants()`), candidate phone numbers, full names, and exact home addresses are withheld.
- **Anonymized Token:** Candidates are identified via synthetic codes (e.g. `FW-A1B2C3`) and broad attributes (`Bengaluru · 1-3 years · Two-wheeler`).
- **Contact Unlock Gate:** Unlocking direct candidate phone numbers remains strictly payment-gated (`PILOT_PREVIEW_PAYMENTS_DISABLED = true`).

### 3.2 State Machine Enforcement (`set_application_status` RPC)
- Allowed Employer Transitions:
  - `applied` $\to$ `reviewing`, `shortlisted`, `rejected`
  - `reviewing` $\to$ `shortlisted`, `rejected`
  - `shortlisted` $\to$ `hired`, `rejected`
- Terminal States:
  - `hired`, `rejected`, `withdrawn` are immutable and cannot be reopened.
- Unauthorized callers attempting to alter application status are rejected with PostgreSQL `42501 Insufficient Privileges`.

---

## 4. In-App Messaging & Real-Time Notifications

### 4.1 Automated Conversation Provisioning
Upon transition to `shortlisted`, PostgreSQL automatically executes `public.ensure_application_conversation(p_application_id)`.
- **Participants:** Exactly two participants are registered in `public.conversation_participants`:
  1. The worker (`user_id = worker.user_id`)
  2. The employer owner/manager who shortlisted the candidate
- **Security Check:** `can_access_conversation(conversation_id)` verifies that the authenticated user is an authorized participant and that the application status is in `('shortlisted', 'hired')`. Third parties and anonymous users cannot read or inject messages into the chat.

### 4.2 Immutable Audit Trail
All hiring status mutations record an immutable audit entry in `public.audit_log`:
- `application_create`
- `application_status`
- `conversation_create`
- `message_sent`

---

## 5. Verification Results

| Lifecycle Step | Component Tested | Result | Evidence |
|:---|:---|:---|:---|
| Worker Profile Prerequisite | `apply_to_job` | PASS | Verified in SQL definition & tests |
| 20/day IST Daily Cap | Asia/Kolkata Calendar boundary | PASS | Unit & Integration tests passing |
| Idempotent Application | Duplicate submission | PASS | Handled via `unique_violation` trap |
| Candidate Privacy | Employer applicant projection | PASS | Verified no phone/PII in `LiveApplicant` |
| Shortlisting Chat Provision | `ensure_application_conversation` | PASS | Auto-created on `shortlisted` status |
| Terminal State Protection | `set_application_status` | PASS | Attempting to reopen `hired` rejected |
| Audit Trail Logging | `public.audit_log` | PASS | Records created for each lifecycle step |

**Phase 3 is COMPLETE.** Proceeding immediately to Phase 4.
