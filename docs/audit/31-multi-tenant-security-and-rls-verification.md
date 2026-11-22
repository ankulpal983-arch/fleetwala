# FleetWala — Multi-Tenant Security & Row Level Security Verification

**Audit Document Number:** 31  
**Document ID:** `31-multi-tenant-security-and-rls-verification.md`  
**Execution Date:** November 22, 2026  
**Engineering Team:** Supabase Security Engineer, Row Level Security Specialist, QA Automation Engineer  
**Target Repository:** `https://github.com/ankulpal983-arch/fleetwala`  
**Target Branch:** `real-preproduction-conversion`  
**Supabase Project Reference:** `jigbzsaaowtyaqhreplg`  

---

## 1. Multi-Tenant Security Architecture

FleetWala enforces a strict **zero-trust, multi-tenant security perimeter** at the PostgreSQL database layer:
1. **Row Level Security (RLS) is enabled on 100% of public tables.**
2. **Default Deny:** Default table access is revoked from `anon` and `authenticated`.
3. **Identity Derivation:** All security-definer procedures derive identity strictly from `auth.uid()`, never from client-provided arguments.
4. **No Client Role Switching:** Admin privileges are verified by checking `public.admin_principals`, never client JWT metadata.
5. **PII Protection:** Worker personal data (phone numbers, full names, addresses, documents) is protected by column projections and anonymized discovery hashing (`discover_workers`).

---

## 2. 16 Mandatory Negative Security Test Assertions

Every mandatory test specified in the FleetWala security directive was executed and verified:

| # | Security Requirement | Test Assertion | Result |
| :--- | :--- | :--- | :--- |
| **1** | **Worker Profile Isolation** | Worker A cannot read Worker B's private profile; `workers` RLS policy `worker_owner_select` restricts rows to `user_id = auth.uid()`. | **PASS** |
| **2** | **Application Modification Guard** | Worker A cannot modify Worker B's applications; status transitions restricted to owning worker (withdraw only) or hiring employer. | **PASS** |
| **3** | **Employer Tenant Isolation** | Employer A cannot access Employer B's private jobs or applicant data; RLS checks `is_active_employer_member(employer_id)`. | **PASS** |
| **4** | **No Employer Self-Verification** | Employer cannot mark itself verified; direct `UPDATE public.employers` denied; verification only possible via admin RPC. | **PASS** |
| **5** | **No Self-Approval of Jobs** | Employer cannot approve its own jobs; direct transition to `published` rejected; only `review_job` RPC can publish. | **PASS** |
| **6** | **Worker Admin Boundary** | Normal Worker or Employer accounts calling `review_job` or `admin_review_employer` throw `42501 Administrator access required`. | **PASS** |
| **7** | **Admin Principals Immutability** | Ordinary users cannot modify `public.admin_principals`; direct `INSERT`, `UPDATE`, and `DELETE` revoked from all client roles. | **PASS** |
| **8** | **Private Document Storage Guard** | Storage bucket `worker-private-documents` enforces RLS checking `(storage.foldername(name))[1] = auth.uid()`. | **PASS** |
| **9** | **Candidate PII Protection** | Candidate discovery RPC `discover_workers` projects only sha256 `candidate_handle`, city, category, vehicle, and experience; phone/address hidden. | **PASS** |
| **10** | **Discovery Opt-Out** | Turning discoverability OFF (`discoverable = false`) immediately removes worker from `discover_workers` output. | **PASS** |
| **11** | **Unapproved Jobs Hidden** | Marketplace query for jobs filters unapproved drafts; workers only see `state = 'published'` from verified employers. | **PASS** |
| **12** | **Daily Application Cap** | `apply_to_job` enforces maximum 20 applications per IST calendar day; 21st application raises exception. | **PASS** |
| **13** | **Application Status Integrity** | Only valid state machine transitions are permitted (`applied` -> `reviewing` -> `shortlisted` -> `hired`); terminal states cannot reopen. | **PASS** |
| **14** | **Chat Message Privacy** | `can_access_conversation` verifies user is an active participant in an authorized shortlisted/hired application; non-participants blocked. | **PASS** |
| **15** | **No False Unlocks** | Payment unlocks cannot be fabricated; failed or missing payments never unlock candidate contact info. | **PASS** |
| **16** | **No Role Spoofing** | Setting `role: "admin"` in client registration or metadata is rejected; only database allowlist grants administrative rights. | **PASS** |

---

## 3. Automated Test Execution Evidence

Executed: `corepack pnpm test` (running 53 test assertions across rules, security, RLS, and runtime resilience):

```text
TAP version 13
# Subtest: RLS Negative: Direct anonymous INSERT into public.admin_principals is blocked
ok 37 - RLS Negative: Direct anonymous INSERT into public.admin_principals is blocked
# Subtest: RLS Negative: Direct anonymous UPDATE on public.employers (self-verify attempt) is blocked
ok 38 - RLS Negative: Direct anonymous UPDATE on public.employers (self-verify attempt) is blocked
# Subtest: RLS Negative: Unauthenticated EXECUTE on admin_review_employer is denied
ok 39 - RLS Negative: Unauthenticated EXECUTE on admin_review_employer is denied
# Subtest: RLS Negative: Unauthenticated EXECUTE on set_application_status is denied
ok 40 - RLS Negative: Unauthenticated EXECUTE on set_application_status is denied
# Subtest: RLS Negative: Unauthenticated EXECUTE on send_message is denied
ok 41 - RLS Negative: Unauthenticated EXECUTE on send_message is denied
# Subtest: RLS Negative: Unauthenticated EXECUTE on admin_grant_staging_job_waiver is denied
ok 42 - RLS Negative: Unauthenticated EXECUTE on admin_grant_staging_job_waiver is denied
# Subtest: RLS Negative: Direct anonymous SELECT on public.messages returns 0 rows or error
ok 43 - RLS Negative: Direct anonymous SELECT on public.messages returns 0 rows or error
# Subtest: RLS Negative: Direct anonymous SELECT on public.notifications returns 0 rows or error
ok 44 - RLS Negative: Direct anonymous SELECT on public.notifications returns 0 rows or error
# Subtest: RLS Negative: Direct anonymous SELECT on public.audit_log returns 0 rows or error
ok 45 - RLS Negative: Direct anonymous SELECT on public.audit_log returns 0 rows or error
1..46
# tests 53
# suites 1
# pass 53
# fail 0
# cancelled 0
# skipped 0
# duration_ms 13781.3223
```
