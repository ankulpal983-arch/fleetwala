# 52. Application-Linked Candidate Invitations & Hiring Funnel Audit

## 1. Forensic Root Cause of Invitation Defects
1. **Unbounded Candidate Outreach vs Application-Linked Requirement**:
   - Migration 023 initially permitted arbitrary invitations to candidates via `candidate_handle` without linking them to an actual `job_applications` record.
   - Per product requirement: employers must only invite candidates who have submitted a valid application to an active job owned by the employer's organization.
2. **Notification Schema Runtime Exception**:
   - In Migration 023, `create_candidate_invitation` and `respond_to_candidate_invitation` attempted to insert into `public.notifications` using `type, title, body, metadata`. This failed with PostgreSQL error `column "type" does not exist in public.notifications`.
3. **Missing Canonical Conversation Linkage**:
   - Accepting an invitation did not transition the application to `shortlisted` or create/open the canonical hiring conversation.

---

## 2. Technical Implementation (Migration 024)

### A. Database Schema (`public.candidate_invitations`)
Added `application_id uuid references public.job_applications(id) on delete cascade` and a unique partial index:
```sql
create unique index if not exists idx_active_invitation_per_app
  on public.candidate_invitations(application_id)
  where status in ('pending', 'accepted');
```
This guarantees at most one active (pending or accepted) invitation per application.

### B. Application Invitation Creation (`public.create_application_invitation`)
```sql
create or replace function public.create_application_invitation(
  p_application_id uuid,
  p_message text default null
)
returns uuid
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_uid uuid := auth.uid();
  v_app public.job_applications%rowtype;
  v_job public.jobs%rowtype;
  v_worker public.workers%rowtype;
  v_employer_name text;
  v_invitation_id uuid;
begin
  if v_uid is null then raise exception 'Authentication required' using errcode = '42501'; end if;

  select * into v_app from public.job_applications where id = p_application_id;
  if not found then raise exception 'Application not found'; end if;

  if v_app.status in ('withdrawn', 'rejected', 'hired') then
    raise exception 'Application is in terminal state (%) and cannot be invited', v_app.status;
  end if;

  select * into v_job from public.jobs where id = v_app.job_id;
  if not (public.is_active_employer_member(v_job.employer_id) or public.is_admin()) then
    raise exception 'Not authorized to invite applicants for this organization' using errcode = '42501';
  end if;

  if exists (
    select 1 from public.candidate_invitations
    where application_id = p_application_id and status in ('pending', 'accepted')
  ) then
    raise exception 'An active invitation already exists for this application';
  end if;

  insert into public.candidate_invitations (
    employer_id, worker_id, job_id, application_id, candidate_handle, message, status
  ) values (
    v_job.employer_id, v_app.worker_id, v_job.id, p_application_id,
    'cand-' || substr(v_app.worker_id::text, 1, 8), nullif(trim(p_message), ''), 'pending'
  ) returning id into v_invitation_id;

  select legal_name into v_employer_name from public.employers where id = v_job.employer_id;
  select * into v_worker from public.workers where id = v_app.worker_id;

  insert into public.notifications (user_id, kind, payload)
  values (
    v_worker.user_id,
    'candidate_invited',
    jsonb_build_object(
      'invitation_id', v_invitation_id,
      'application_id', p_application_id,
      'job_id', v_job.id,
      'job_title', v_job.title,
      'company', coalesce(v_employer_name, 'Logistics Employer'),
      'message', nullif(trim(p_message), '')
    )
  );

  return v_invitation_id;
end;
$$;
```

### C. Worker Response & Canonical Conversation Opening (`public.respond_to_candidate_invitation`)
When the invited worker calls `respond_to_candidate_invitation(p_invitation_id, p_accept)`:
- Verifies caller is the worker addressed by the invitation (`worker_id = current_worker_id()`).
- On acceptance (`p_accept = true`):
  1. Sets invitation `status = 'accepted'` and `responded_at = now()`.
  2. Updates application `status = 'shortlisted'`.
  3. Inserts into `application_status_history`.
  4. Calls `ensure_application_conversation(v_app_id)` to establish or retrieve the unique conversation.
  5. Populates both worker and employer organization members into `conversation_participants`.
  6. Sends real-time notification to all employer team members (`kind = 'invitation_accepted'`).
  7. Returns chat capability immediately in both Employer and Worker portals.
- On declination (`p_accept = false`):
  1. Sets invitation `status = 'declined'`.
  2. Sends real-time notification to employer team members (`kind = 'invitation_declined'`).

---

## 3. UI Integration

### A. Employer Applicants (`/employer/applicants`)
- Integrated an **Invite** button for every applicant in `applied` or `viewed` status.
- Clicking opens `InviteApplicantDialog`:
  - Shows candidate code and job opening.
  - Allows entering custom message with character counter.
  - Submits via `createLiveApplicationInvitation`.
  - Refreshes applicants table upon success.
- If applicant is shortlisted or hired: shows **Chat** button navigating directly to `/employer/messages`.

### B. Worker Portal (`/applications`)
- Under the **Hiring Invitations** tab:
  - Lists pending invitations with employer company name, job opening, and custom message.
  - Action buttons: **Accept Invitation** and **Decline**.
  - When accepted, displays: `"Invitation accepted · Hiring chat is active"` and an **Open Chat** button linking to `/messages`.

---

## 4. Verification & Negative Security Tests
- **Negative Security**:
  - Unauthenticated creation attempt: denied with `42501`.
  - Unauthenticated response attempt: denied with `42501`.
  - Attempting to invite an applicant belonging to another organization: rejected with `'Not authorized to invite applicants for this organization'`.
  - Attempting to send duplicate invitations: rejected with `'An active invitation already exists for this application'`.
  - Attempting to invite withdrawn/rejected applicants: rejected with `'Application is in terminal state'`.
- **Status**: **PASS (Verified with real Supabase RPCs and PostgreSQL tables)**.
