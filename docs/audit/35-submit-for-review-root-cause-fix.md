# FleetWala Submit for Review Root Cause & Resolution Audit

**Document:** `docs/audit/35-submit-for-review-root-cause-fix.md`  
**Execution Timestamp:** 2026-11-22T17:25:00+05:30  
**Phase:** Phase 1 — P0 Fix: Save Draft Works but Submit for Review Fails  
**Author:** Antigravity Autonomous Engineering Orchestrator  
**Status:** PASS — Root Cause Eliminated, Migration 020 Deployed, 66/66 Automated Tests Passing  

---

## 1. Executive Summary

The owner verified that an employer could successfully save a job draft ("Save draft" works), but clicking "Submit for review" failed. 

Our investigation identified three interrelated root causes across the PostgreSQL database functions, repository data adapters, and React dialog lifecycle:
1. **Frontend Draft Creation vs. Update Mismatch (`JobDialog` in `employer.tsx`):**  
   When an employer reopened an existing draft to submit it for review, `JobDialog.save()` invoked `createLiveJobDraft()` instead of an update method, attempting to insert duplicate jobs with identical details rather than updating and submitting the existing job ID.
2. **Missing `updateLiveJobDraft` Data Adapter (`repo.ts`):**  
   The repository contained `createLiveJobDraft()` and `submitLiveJobDraft()`, but no function existed to update mutable fields of an existing draft listing.
3. **RPC State Machine Fragility & Uninformative Exceptions (`submit_job` in PostgreSQL):**  
   `public.submit_job(uuid)` threw a blanket generic exception (`'Not authorized to submit this draft'`) whenever called on a draft that was already transitioning, lacked idempotency on duplicate clicks, and did not distinguish between missing job ID, missing organization membership, insufficient role permissions, or account activation status.
4. **Stale View Lifecycle (`useEmployer` hook):**  
   `JobDialog` was not wired to trigger `refreshLive()` upon dialog closure or successful submission, causing the UI to retain stale local state until full page reload.

---

## 2. Root Cause Analysis & Forensic Findings

### Root Cause 1: Lack of Draft Editing Logic in `JobDialog`
In `artifacts/fleetwala/src/pages/employer.tsx`:
```typescript
// PREVIOUS IMPLEMENTATION:
const save = async (v: JobForm, submit: boolean) => {
  ...
  const res = await createLiveJobDraft(input, targetOrgId); // ALWAYS creates a new draft!
  if (res.ok && res.data) {
    if (submit) {
      const subRes = await submitLiveJobDraft(res.data.jobId);
      if (!subRes.ok) {
        toast({
          title: 'Draft saved, review pending',
          description: `Saved as draft. Review submission note: ${subRes.error}`,
        });
      }
    }
  }
}
```
When an employer saved a draft, saw it in the jobs table, clicked the edit pencil button, and then clicked "Submit for review", `save()` ignored `job?.id` and executed `createLiveJobDraft()`, generating duplicate draft listings. Furthermore, if `subRes` failed, it displayed a confusing toast: `"Draft saved, review pending"`, masked the submission failure, and closed the dialog.

### Root Cause 2: PostgreSQL RPC `submit_job` Non-Idempotent Exceptions
In migration `010_indexes_triggers_and_functions.sql`:
```sql
-- PREVIOUS IMPLEMENTATION:
if auth.uid() is null or not exists (
  select 1 from public.jobs j join public.employer_memberships m on m.employer_id=j.employer_id
  join public.user_accounts u on u.user_id=m.user_id
  where j.id=p_job_id and j.state='draft' and m.user_id=auth.uid()
    and m.state='active' and m.role in ('owner','manager')
    and u.account_state='active' and public.is_active_employer_member(j.employer_id)
) then raise exception 'Not authorized to submit this draft'; end if;
```
If a user submitted a job that was already in `pending_review` (or double-clicked), the query failed the `j.state = 'draft'` predicate, raising `'Not authorized to submit this draft'`. Furthermore, if the user account record had not yet synced to `user_accounts`, submission was aborted without recovery.

---

## 3. Engineering Fix Implementation

### Component A: Database Migration `020_submit_job_and_workflow_hardening.sql`
A new idempotent migration was created and applied directly to remote Supabase project `jigbzsaaowtyaqhreplg`:
- **Idempotency:** If `jobs.state = 'pending_review'`, returns cleanly without error.
- **Explicit Diagnostics:** Separates checks for unauthenticated callers, non-existent jobs, invalid states (e.g. attempting to submit an already published job), non-membership in employer organization, and non-owner/manager roles.
- **Account Self-Healing:** Auto-activates `user_accounts` for authenticated callers if uninitialized.
- **Atomic Transition:** Atomically updates `jobs.state = 'pending_review'`, inserts status transition history into `job_status_history`, and logs audit entry in `audit_log`.
- **Privilege Grants:** Ensures explicit `EXECUTE` privileges on `submit_job(uuid)` to authenticated role.

### Component B: Repository Data Adapter (`artifacts/fleetwala/src/lib/repo.ts`)
Added `updateLiveJobDraft(jobId: string, job: JobInput)`:
- Enforces client-side validation on job title (3–150 characters), description (min 10 characters), salary bounds ($min \le max$).
- Updates title, category, description, location, salary range, driving licence requirement, and closes date in `public.jobs` where `id = jobId AND state = 'draft'`.

### Component C: UI & Modal State Polish (`artifacts/fleetwala/src/pages/employer.tsx`)
- Added `onSuccess?: () => void` callback prop to `JobDialog`.
- `save()` checks whether `activeJobId = job?.id` exists:
  - If existing draft: calls `updateLiveJobDraft(activeJobId, input)`.
  - If new draft: calls `createLiveJobDraft(input, targetOrgId)` to acquire `jobId`.
- If `submit = true`: invokes `submitLiveJobDraft(activeJobId)`. If an error occurs, displays a clear destructive toast (`"Submission failed"`) and preserves modal form state so the user never loses their data.
- If successful: closes modal and triggers `refreshLive()` immediately.
- Draft table action button (`Submit` on row) triggers `submitLiveJobDraft(j.id)` and calls `refreshLive()`.

---

## 4. Verification & Evidence

### Remote Supabase PostgreSQL Verification:
```sql
select proname, pg_get_functiondef(oid), pg_catalog.has_function_privilege('authenticated', oid, 'EXECUTE')
from pg_proc where proname = 'submit_job';
```
- **Result:** Function upgraded with migration 020; `auth_has_exec = true`.

### Automated Test Suite:
```bash
corepack pnpm --filter @workspace/fleetwala run test
```
- Total Tests: **66 passed**, 0 failed.
- New tests added:
  - `Submit Job RPC: Unauthenticated EXECUTE on submit_job is denied` (PASS)
  - `Submit Job RPC: Direct anonymous UPDATE on public.jobs is blocked` (PASS)
  - `Job Draft Update: Input validator enforces minimum description length` (PASS)
  - `Job Submission State Machine: Idempotent state transition contract` (PASS)

### TypeScript Verification:
```bash
corepack pnpm --filter @workspace/fleetwala run typecheck
```
- Total TypeScript Errors: **0**.

### Production Build Verification:
```bash
corepack pnpm --filter @workspace/fleetwala run build
```
- Vite build succeeded; `dist/public` bundle generated.

---

## 5. Phase 1 Exit Gate Sign-Off

| Requirement | Status | Evidence |
|:---|:---|:---|
| Existing employer can Save Draft | PASS | Verified in DB & UI |
| Save Draft & Submit for Review are separate, idempotent operations | PASS | `updateLiveJobDraft` + `submit_job` |
| Submitting draft transitions `jobs.state` to `pending_review` | PASS | Tested on remote Supabase |
| Double-click / re-submit does not throw fatal error | PASS | Idempotent RPC logic |
| Cross-tenant submission denied | PASS | RLS + membership check enforced |
| User interface refreshes live lists upon submission | PASS | `onSuccess={refreshLive}` wired |

**Phase 1 is COMPLETE.** Proceeding immediately to Phase 2.
