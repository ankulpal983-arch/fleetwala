-- Migration 020: Submit Job RPC Hardening, Idempotency and Workflow Polish
-- Resolves P0 issue: Submit for Review failure, state machine clarity, and draft update capability

-- 1. Hardened submit_job RPC with clear errors, idempotency and audit trail
create or replace function public.submit_job(p_job_id uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_job public.jobs%rowtype;
  v_membership public.employer_memberships%rowtype;
  v_user public.user_accounts%rowtype;
begin
  if v_uid is null then
    raise exception 'Authentication required to submit a job draft';
  end if;

  if p_job_id is null then
    raise exception 'Job ID is required';
  end if;

  -- 1. Fetch the target job with row lock
  select * into v_job from public.jobs where id = p_job_id for update;
  if not found then
    raise exception 'Job draft not found (ID: %)', p_job_id;
  end if;

  -- 2. Idempotency: If already in pending_review, return cleanly
  if v_job.state = 'pending_review' then
    return;
  end if;

  if v_job.state != 'draft' then
    raise exception 'Only draft listings can be submitted for review. Current status: %', v_job.state;
  end if;

  -- 3. Verify employer membership
  select * into v_membership
  from public.employer_memberships
  where employer_id = v_job.employer_id and user_id = v_uid and state = 'active'
  limit 1;

  if not found then
    raise exception 'Not authorized: You do not have an active membership in the employer organization for this job';
  end if;

  if v_membership.role not in ('owner', 'manager') then
    raise exception 'Insufficient permissions: Only organization owners and managers can submit listings for review';
  end if;

  -- 4. Verify user account state (auto-activate if record missing)
  select * into v_user from public.user_accounts where user_id = v_uid;
  if not found then
    insert into public.user_accounts (user_id, account_state)
    values (v_uid, 'active')
    returning * into v_user;
  elsif v_user.account_state != 'active' then
    raise exception 'Your user account is currently %', v_user.account_state;
  end if;

  -- 5. Perform atomic state transition
  update public.jobs
  set state = 'pending_review', updated_at = now()
  where id = p_job_id;

  -- 6. Record status history and audit log
  insert into public.job_status_history (job_id, old_state, new_state, changed_by, reason)
  values (p_job_id, 'draft', 'pending_review', v_uid, 'Submitted for review by employer');

  insert into public.audit_log (actor_id, action, entity_type, entity_id, details)
  values (v_uid, 'job_submit', 'job', p_job_id::text, jsonb_build_object(
    'previous_state', 'draft',
    'new_state', 'pending_review',
    'employer_id', v_job.employer_id
  ));
end $$;

-- 2. Explicitly ensure execution privilege for authenticated users
revoke all on function public.submit_job(uuid) from public, anon, authenticated;
grant execute on function public.submit_job(uuid) to authenticated;

-- 3. Ensure employer members can update their own drafts
drop policy if exists jobs_org_draft_update on public.jobs;
create policy jobs_org_draft_update on public.jobs
  for update to authenticated
  using (
    state = 'draft'::public.job_state
    and public.is_active_employer_member(employer_id)
  )
  with check (
    state = 'draft'::public.job_state
    and public.is_active_employer_member(employer_id)
  );

-- 4. Ensure table-level DML grants remain active
grant select, insert, update on public.jobs to authenticated;
grant select on public.job_status_history to authenticated;
grant select on public.employers to authenticated;
grant select on public.employer_memberships to authenticated;
