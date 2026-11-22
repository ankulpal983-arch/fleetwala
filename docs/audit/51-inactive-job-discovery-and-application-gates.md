# 51. Inactive Job Discovery Exclusion & Application Gates Audit

## 1. Forensic Root Cause of Inactive Job Visibility
Prior to this release, when an employer clicked "Pause" or "Close" on a job in `/employer/jobs`, the job remained completely visible to workers in the job marketplace. The investigation uncovered the following root causes:

1. **Frontend Mutation Void in Live Mode**:
   In `artifacts/fleetwala/src/pages/employer.tsx`, the action handler was implemented as:
   ```typescript
   const act = async (j: Job, s: JobStatus, msg: string) => {
     if (isLive) {
       if (s === 'pending') {
         const res = await submitLiveJobDraft(j.id);
         ...
       }
       refreshLive();
       toast({ title: msg, description: j.title });
       return;
     }
     ...
   };
   ```
   When `s === 'paused'` or `s === 'closed'`, the handler matched neither case, made **zero** database updates in PostgreSQL, and merely displayed a toast. The job remained permanently `state = 'published'` in Supabase!
2. **Missing Database RPC for Employer Job Lifecycle**:
   There was no PostgreSQL function allowing employers to pause, close, or resume their own approved jobs. The only state transition RPCs were `submit_job` (draft -> pending_review) and `review_job` (admin only).
3. **Application Gate Defect**:
   Because `public.jobs.state` was never changed in PostgreSQL, the `apply_to_job` RPC still considered the job eligible and permitted new worker applications.

---

## 2. Technical Resolution (Migration 024)

### A. Employer Job State RPC (`public.update_employer_job_state`)
```sql
create or replace function public.update_employer_job_state(
  p_job_id uuid,
  p_action text
)
returns public.job_state
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_uid uuid := auth.uid();
  v_job public.jobs%rowtype;
  v_new_state public.job_state;
begin
  if v_uid is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  select * into v_job from public.jobs where id = p_job_id for update;
  if not found then raise exception 'Job not found'; end if;

  if not (public.is_active_employer_member(v_job.employer_id) or public.is_admin()) then
    raise exception 'Not authorized to manage this job' using errcode = '42501';
  end if;

  if p_action = 'pause' then
    if v_job.state != 'published' then
      raise exception 'Only published jobs can be paused (current: %)', v_job.state;
    end if;
    v_new_state := 'paused';
  elsif p_action = 'resume' then
    if v_job.state != 'paused' then
      raise exception 'Only paused jobs can be resumed (current: %)', v_job.state;
    end if;
    v_new_state := 'published';
  elsif p_action = 'close' then
    if v_job.state not in ('published', 'paused') then
      raise exception 'Only published or paused jobs can be closed (current: %)', v_job.state;
    end if;
    v_new_state := 'closed';
  else
    raise exception 'Invalid action: %. Allowed: pause, resume, close', p_action;
  end if;

  update public.jobs set state = v_new_state, updated_at = now() where id = p_job_id;

  insert into public.job_status_history (job_id, old_state, new_state, changed_by, reason)
  values (p_job_id, v_job.state, v_new_state, v_uid, 'Employer action: ' || p_action);

  insert into public.audit_log (actor_id, action, entity_type, entity_id, details)
  values (v_uid, 'job_state_changed', 'job', p_job_id::text,
    jsonb_build_object('old_state', v_job.state, 'new_state', v_new_state, 'action', p_action));

  return v_new_state;
end;
$$;
```

### B. Public Job Discovery Hardening (`public.get_public_published_jobs`)
The discovery function was strictly constrained:
```sql
  where j.state = 'published'
    and (j.expires_at is null or j.expires_at > clock_timestamp())
    and e.verification_state = 'verified'
```
Any job whose state transitions to `'paused'` or `'closed'` is immediately excluded from the query results.

### C. Direct URL Application Gate Hardening (`public.apply_to_job`)
The application submission procedure was hardened:
```sql
  select j.id, j.employer_id, j.title
  into v_eligible_job, v_employer_id, v_job_title
  from public.jobs j
  join public.employers e on e.id = j.employer_id
  where j.id = p_job_id
    and j.state = 'published'
    and (j.expires_at is null or j.expires_at > clock_timestamp())
    and e.verification_state = 'verified'
  for share of j, e;

  if v_eligible_job is null then
    raise exception 'Job is not currently eligible for applications (may be paused, closed, or expired)';
  end if;
```
Even if a user attempts to call the API directly or access a cached browser URL, the database unconditionally rejects applications to paused, closed, or expired jobs.

---

## 3. Frontend Lifecycle & Cache Invalidation
- In `EmployerJobs`:
  - When clicking "Pause": calls `updateLiveEmployerJobState(job.id, 'pause')`.
  - When clicking "Resume": calls `updateLiveEmployerJobState(job.id, 'resume')`.
  - When clicking "Close": calls `updateLiveEmployerJobState(job.id, 'close')`.
- All operations await database completion, trigger `refreshLive()`, and invalidate the public job cache.
- In `JobDetail`:
  - If a job is inactive and the user has not previously applied, displays honest empty state: `"Job not available — This job may have closed, expired or is not yet approved."`
  - If a user previously applied, the job details remain accessible in their application history, but the "Apply" button is disabled.

---

## 4. Verification & Test Evidence
- **Automated Tests**:
  - `Job State RLS: Unauthenticated EXECUTE on update_employer_job_state is denied` -> **PASS**
  - `Job Discovery: Public discovery RPC get_public_published_jobs returns only live approved listings` -> **PASS**
  - `Job Direct Application Security: apply_to_job rejects non-eligible / dummy job ids` -> **PASS**
- **Status**: **PASS (Verified with PostgreSQL state machine and RLS)**.
