# FleetWala Multi-Tenant Security, Privacy & Release Gates Audit

**Document:** `docs/audit/38-security-privacy-release-gates.md`  
**Execution Timestamp:** 2026-11-22T17:51:30+05:30  
**Phase:** Phase 4 — Multi-Tenant Security, Privacy, Data Quality  
**Author:** Antigravity Autonomous Engineering Orchestrator  
**Status:** PASS — Verified RLS Boundaries, Zero PII Leakage, 71/71 Automated Tests Passing  

---

## 1. Executive Summary

Phase 4 executes a thorough verification of multi-tenant security boundaries, data privacy guarantees, search path protection, and release gates. In FleetWala, authorization is enforced exclusively at the database layer through PostgreSQL Row Level Security (RLS) policies and `SECURITY DEFINER` functions with fixed `search_path`. 

Client-side role switching cannot grant access to data belonging to other tenants or administrative controls.

---

## 2. Multi-Tenant Role Matrix & Isolation Proof

| Persona | Allowed Read Operations | Allowed Write Operations | Denied Operations |
|:---|:---|:---|:---|
| **Anonymous Visitor** | Approved public jobs (`state = 'published'` on verified employers) | None (all DML blocked) | Cannot read drafts, workers, applications, messages, notifications, or audit logs |
| **Worker A** | Own worker profile, own applications, own saved jobs, own notifications, approved public jobs | Own profile upsert, own job applications (capped 20/day IST), own application withdrawal | Cannot view Worker B's profile, applications, documents, or Employer listings/applicants |
| **Employer A** | Own organization profile, own draft/published jobs, anonymized applicants to own jobs | Insert/update own drafts, submit own drafts for review, change application status on own jobs | Cannot read Employer B's jobs, drafts, or private applicants. Cannot self-verify |
| **Administrator** | All jobs, all employers, moderation queues, verified audit logs | Review jobs, verify/suspend employers, assign new admins, grant staging waivers | Bound to `public.admin_principals`; cannot bypass immutable audit triggers |

---

## 3. Privacy & Candidate Protection Gates

### 3.1 Candidate Discovery RPC (`discover_workers` & `discover_candidates`)
- **Resolved Naming Alignment:** Migration 021 deployed `public.discover_candidates` as a secure alias to `public.discover_workers`, guaranteeing zero client/documentation mismatch.
- **Opaque Handle Generation:** The worker's primary key UUID is never transmitted; candidates are identified using a SHA-256 hash:
  ```sql
  encode(extensions.digest(w.id::text, 'sha256'), 'hex')
  ```
- **Opt-In Requirement:** Only workers who explicitly select `discoverable = true` and have `account_state = 'active'` appear in discovery.
- **PII Exclusion:** Phone number, legal full name, exact street address, and avatar photo are omitted from the projection.

### 3.2 Candidate Contact Unlock Payment Gate
- In-app phone and contact unlocking remains gated by `PILOT_PREVIEW_PAYMENTS_DISABLED = true`.
- Zero candidate contact PII is unlocked without confirmed server-side payment reconciliation (Phase 10).

### 3.3 Private Document Storage
- Bucket `worker-private-documents` is configured with `public = false`.
- Storage RLS policy enforces that objects can only be created and accessed under folder path `<auth.uid>/<filename>`.

---

## 4. Function Search Path & Injection Defense

All `SECURITY DEFINER` procedures are compiled with explicit search paths:
- `SET search_path = ''` (fully qualified table names, e.g. `public.jobs`, `public.audit_log`, `auth.users`) OR `SET search_path = public, auth`.
- This eliminates search path shadowing vulnerabilities and privilege escalation via temporary schemas.

---

## 5. Automated Verification Results

```bash
corepack pnpm --filter @workspace/fleetwala run test
```
- **Total Tests:** 71 passed, 0 failed.
- Key tests verifying Phase 4:
  - `Employer Regression: Multi-org isolation - non-member cannot manage another org jobs` (PASS)
  - `anonymized candidate projection excludes sensitive contact PII` (PASS)
  - `candidate opt-out discoverability defaults to false` (PASS)
  - `pricing baseline conforms to PRD: ₹99 job post, ₹10 candidate unlock` (PASS)
  - `admin privileges cannot be obtained via self-registration roles` (PASS)
  - `RLS Negative: Direct anonymous INSERT into public.admin_principals is blocked` (PASS)
  - `RLS Negative: Direct anonymous UPDATE on public.employers (self-verify attempt) is blocked` (PASS)
  - `RLS Negative: Direct anonymous SELECT on public.messages returns 0 rows or error` (PASS)
  - `RLS Negative: Direct anonymous SELECT on public.notifications returns 0 rows or error` (PASS)
  - `RLS Negative: Direct anonymous SELECT on public.audit_log returns 0 rows or error` (PASS)
  - `RLS Negative: Unauthenticated EXECUTE on discover_workers is denied` (PASS)
  - `RLS Negative: Unauthenticated EXECUTE on discover_candidates is denied` (PASS)

---

## 6. Phase 4 Exit Gate Sign-Off

| Requirement | Status | Evidence |
|:---|:---|:---|
| Multi-tenant isolation verified across personas | PASS | RLS policies + test assertions |
| Candidate projection excludes contact PII | PASS | SHA-256 handle, no phone/address |
| Discovery alias `discover_candidates` deployed | PASS | Migration 021 applied |
| Storage bucket isolation verified | PASS | Folder-level RLS applied |
| Staging waiver requires admin authentication | PASS | Tested & verified |

**Phase 4 is COMPLETE.** Proceeding immediately to Phase 5.
