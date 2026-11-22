-- Migration 018: Admin Workflows, Notifications, Multi-Tenant Auditing & Staging Waiver
-- Target: jigbzsaaowtyaqhreplg
-- Safe, incremental, non-destructive

-- 1. One-time secure admin bootstrap procedure (Phase 14)
create or replace function public.bootstrap_admin(p_secret text default null)
returns boolean
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_uid uuid := auth.uid();
  v_admin_count int;
begin
  if v_uid is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  select count(*) into v_admin_count from public.admin_principals;

  -- Initial bootstrap: allowed only if zero administrators currently exist
  if v_admin_count = 0 then
    insert into public.admin_principals (user_id, provisioned_by, provisioned_at, reason)
    values (v_uid, coalesce(auth.uid()::text, 'bootstrap'), now(), 'Initial admin bootstrap')
    on conflict (user_id) do nothing;

    insert into public.audit_log (actor_id, action, entity_type, entity_id, details)
    values (v_uid, 'admin_bootstrap', 'admin_principal', v_uid::text, jsonb_build_object('method', 'zero_admin_first_claim'));

    return true;
  end if;

  -- If admins already exist, caller must already be an admin
  if public.is_admin() then
    return true;
  end if;

  raise exception 'Bootstrap closed. An administrator already exists.' using errcode = '42501';
end;
$$;

revoke all on function public.bootstrap_admin(text) from public, anon, authenticated;
grant execute on function public.bootstrap_admin(text) to authenticated;

-- 2. Admin assign new administrator (Phase 14)
create or replace function public.admin_assign_admin(p_target_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if not public.is_admin() then
    raise exception 'Administrator access required' using errcode = '42501';
  end if;

  if not exists (select 1 from public.user_accounts where user_id = p_target_user_id and account_state = 'active') then
    raise exception 'Target user not found or inactive';
  end if;

  insert into public.admin_principals (user_id, provisioned_by, provisioned_at, reason)
  values (p_target_user_id, auth.uid()::text, now(), 'Assigned by administrator')
  on conflict (user_id) do nothing;

  insert into public.audit_log (actor_id, action, entity_type, entity_id, details)
  values (auth.uid(), 'admin_assign', 'admin_principal', p_target_user_id::text, jsonb_build_object('assigned_by', auth.uid()));
end;
$$;

revoke all on function public.admin_assign_admin(uuid) from public, anon, authenticated;
grant execute on function public.admin_assign_admin(uuid) to authenticated;

-- 3. Admin review & verify employer organization (Phase 4)
create or replace function public.admin_review_employer(
  p_employer_id uuid,
  p_decision text,
  p_reason text
)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_old_state text;
  v_member_user uuid;
begin
  if not public.is_admin() then
    raise exception 'Administrator access required' using errcode = '42501';
  end if;

  if p_decision not in ('verified', 'rejected', 'suspended') then
    raise exception 'Invalid decision state. Must be verified, rejected, or suspended.';
  end if;

  select verification_state into v_old_state
  from public.employers
  where id = p_employer_id
  for update;

  if not found then
    raise exception 'Employer organization not found';
  end if;

  update public.employers
  set verification_state = p_decision
  where id = p_employer_id;

  insert into public.employer_verification_reviews (employer_id, reviewed_by, decision, reason)
  values (p_employer_id, auth.uid(), p_decision, left(p_reason, 1000));

  insert into public.audit_log (actor_id, action, entity_type, entity_id, details)
  values (
    auth.uid(),
    'employer_verification',
    'employer',
    p_employer_id::text,
    jsonb_build_object('old_state', v_old_state, 'new_state', p_decision, 'reason', left(p_reason, 500))
  );

  -- Send notification to all active employer members
  for v_member_user in
    select user_id from public.employer_memberships
    where employer_id = p_employer_id and state = 'active'
  loop
    insert into public.notifications (user_id, kind, payload)
    values (
      v_member_user,
      'employer_verification_update',
      jsonb_build_object(
        'employer_id', p_employer_id,
        'decision', p_decision,
        'reason', left(p_reason, 500)
      )
    );
  end loop;
end;
$$;

revoke all on function public.admin_review_employer(uuid, text, text) from public, anon, authenticated;
grant execute on function public.admin_review_employer(uuid, text, text) to authenticated;

-- 4. Update conversation access to include 'hired' state (Phase 11)
create or replace function public.can_access_conversation(p_conversation_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select exists(
    select 1 from public.conversations c
    join public.job_applications a on a.id = c.application_id
    join public.jobs j on j.id = a.job_id
    join public.conversation_participants cp on cp.conversation_id = c.id
    join public.user_accounts u on u.user_id = auth.uid()
    where c.id = p_conversation_id
      and cp.user_id = auth.uid()
      and a.status in ('shortlisted', 'hired')
      and u.account_state = 'active'
      and (
        exists (
          select 1 from public.workers w
          where w.id = a.worker_id and w.user_id = auth.uid() and w.account_state = 'active'
        )
        or public.is_active_employer_member(j.employer_id)
        or public.is_admin()
      )
  )
$$;

-- 5. Updated set_application_status with notifications (Phase 8, 9, 10)
create or replace function public.set_application_status(
  p_application_id uuid,
  p_status public.application_state
)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_app public.job_applications%rowtype;
  v_allowed boolean;
  v_worker_uid uuid;
  v_job_title text;
  v_company_name text;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  select a.* into v_app
  from public.job_applications a
  where a.id = p_application_id
  for update;

  if not found then
    raise exception 'Application not found';
  end if;

  if v_app.status in ('withdrawn', 'hired', 'rejected') then
    raise exception 'Terminal application status cannot be altered';
  end if;

  if p_status = 'withdrawn' then
    v_allowed := v_app.worker_id = public.current_worker_id();
  else
    v_allowed := v_app.worker_id is distinct from public.current_worker_id()
      and exists (
        select 1 from public.jobs j
        where j.id = v_app.job_id and public.is_active_employer_member(j.employer_id)
      )
      and (
        (v_app.status = 'applied' and p_status in ('reviewing', 'shortlisted', 'rejected'))
        or (v_app.status = 'reviewing' and p_status in ('shortlisted', 'rejected'))
        or (v_app.status = 'shortlisted' and p_status in ('hired', 'rejected'))
      );
  end if;

  if not v_allowed and not public.is_admin() then
    raise exception 'Not authorized for this status transition' using errcode = '42501';
  end if;

  update public.job_applications
  set status = p_status, updated_at = now()
  where id = p_application_id;

  insert into public.application_status_history (application_id, old_status, new_status, changed_by)
  values (p_application_id, v_app.status, p_status, auth.uid());

  insert into public.audit_log (actor_id, action, entity_type, entity_id, details)
  values (
    auth.uid(),
    'application_status',
    'application',
    p_application_id::text,
    jsonb_build_object('old_status', v_app.status, 'new_status', p_status)
  );

  if p_status = 'shortlisted' then
    perform public.ensure_application_conversation(p_application_id);
  end if;

  -- Notify the worker of application status change
  select w.user_id, j.title, e.legal_name
  into v_worker_uid, v_job_title, v_company_name
  from public.workers w
  join public.jobs j on j.id = v_app.job_id
  join public.employers e on e.id = j.employer_id
  where w.id = v_app.worker_id;

  if v_worker_uid is not null then
    insert into public.notifications (user_id, kind, payload)
    values (
      v_worker_uid,
      'application_status_update',
      jsonb_build_object(
        'application_id', p_application_id,
        'job_id', v_app.job_id,
        'job_title', v_job_title,
        'company', v_company_name,
        'new_status', p_status
      )
    );
  end if;
end;
$$;

revoke all on function public.set_application_status(uuid, public.application_state) from public, anon, authenticated;
grant execute on function public.set_application_status(uuid, public.application_state) to authenticated;

-- 6. Updated apply_to_job with notifications to employer (Phase 7, 10)
create or replace function public.apply_to_job(p_job_id uuid)
returns table(application_id uuid, was_existing boolean)
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_worker_id uuid;
  v_app public.job_applications%rowtype;
  v_today date;
  v_eligible_job uuid;
  v_employer_id uuid;
  v_member_user uuid;
  v_job_title text;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  select w.id into v_worker_id
  from public.workers w
  where w.user_id = auth.uid() and w.account_state = 'active'
  for update;

  if v_worker_id is null then
    raise exception 'Active worker profile required' using errcode = '42501';
  end if;

  -- Idempotent check
  select a.* into v_app
  from public.job_applications a
  where a.worker_id = v_worker_id and a.job_id = p_job_id;

  if found then
    return query select v_app.id, true;
    return;
  end if;

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
    raise exception 'Job is not currently eligible for applications';
  end if;

  v_today := (clock_timestamp() at time zone 'Asia/Kolkata')::date;
  if (
    select count(*)
    from public.job_applications a
    where a.worker_id = v_worker_id
      and (a.created_at at time zone 'Asia/Kolkata')::date = v_today
  ) >= 20 then
    raise exception 'Daily application limit reached (20 per IST calendar day)';
  end if;

  insert into public.job_applications (worker_id, job_id, created_at)
  values (v_worker_id, p_job_id, clock_timestamp())
  returning * into v_app;

  insert into public.application_status_history (application_id, old_status, new_status, changed_by)
  values (v_app.id, null, 'applied', auth.uid());

  insert into public.audit_log (actor_id, action, entity_type, entity_id)
  values (auth.uid(), 'application_create', 'application', v_app.id::text);

  -- Notify active employer members of new incoming application
  for v_member_user in
    select user_id from public.employer_memberships
    where employer_id = v_employer_id and state = 'active'
  loop
    insert into public.notifications (user_id, kind, payload)
    values (
      v_member_user,
      'application_received',
      jsonb_build_object(
        'application_id', v_app.id,
        'job_id', p_job_id,
        'job_title', v_job_title
      )
    );
  end loop;

  return query select v_app.id, false;
exception
  when unique_violation then
    select a.* into v_app
    from public.job_applications a
    where a.worker_id = v_worker_id and a.job_id = p_job_id;
    if v_app.id is not null then
      return query select v_app.id, true;
    else
      raise;
    end if;
end;
$$;

revoke all on function public.apply_to_job(uuid) from public, anon, authenticated;
grant execute on function public.apply_to_job(uuid) to authenticated;

-- 7. Updated review_job with employer notification (Phase 5, 10)
create or replace function public.review_job(
  p_job_id uuid,
  p_approve boolean,
  p_reason text
)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_old public.job_state;
  v_new public.job_state;
  v_creator uuid;
  v_title text;
  v_emp_id uuid;
  v_emp_verified boolean;
begin
  if not public.is_admin() then
    raise exception 'Administrator access required' using errcode = '42501';
  end if;

  select state, created_by, title, employer_id
  into v_old, v_creator, v_title, v_emp_id
  from public.jobs
  where id = p_job_id
  for update;

  if v_old is distinct from 'pending_review' then
    raise exception 'Job is not pending review';
  end if;

  -- Safety check: employer must be verified to approve publishing
  if p_approve then
    select (verification_state = 'verified') into v_emp_verified
    from public.employers
    where id = v_emp_id;

    if not coalesce(v_emp_verified, false) then
      raise exception 'Employer organization must be verified before approving job publication.';
    end if;
  end if;

  v_new := case when p_approve then 'published'::public.job_state else 'rejected'::public.job_state end;

  update public.jobs
  set state = v_new,
      reviewed_by = auth.uid(),
      reviewed_at = now(),
      review_note = p_reason
  where id = p_job_id;

  insert into public.job_status_history (job_id, old_state, new_state, changed_by, reason)
  values (p_job_id, v_old, v_new, auth.uid(), left(p_reason, 1000));

  insert into public.audit_log (actor_id, action, entity_type, entity_id, details)
  values (
    auth.uid(),
    'job_review',
    'job',
    p_job_id::text,
    jsonb_build_object('decision', v_new, 'reason', left(p_reason, 500))
  );

  -- Notify employer job creator
  if v_creator is not null then
    insert into public.notifications (user_id, kind, payload)
    values (
      v_creator,
      'job_moderation_update',
      jsonb_build_object(
        'job_id', p_job_id,
        'job_title', v_title,
        'state', v_new,
        'reason', left(p_reason, 500)
      )
    );
  end if;
end;
$$;

revoke all on function public.review_job(uuid, boolean, text) from public, anon, authenticated;
grant execute on function public.review_job(uuid, boolean, text) to authenticated;

-- 8. Updated send_message with recipient notification (Phase 11)
create or replace function public.send_message(
  p_conversation_id uuid,
  p_body text
)
returns uuid
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_id uuid;
  v_recipient_uid uuid;
begin
  if auth.uid() is null or char_length(trim(p_body)) not between 1 and 4000 then
    raise exception 'Invalid message or unauthenticated' using errcode = '42501';
  end if;

  if not public.can_access_conversation(p_conversation_id) then
    raise exception 'Conversation access denied' using errcode = '42501';
  end if;

  insert into public.messages (conversation_id, sender_id, body)
  values (p_conversation_id, auth.uid(), trim(p_body))
  returning id into v_id;

  -- Notify the other participant
  select cp.user_id into v_recipient_uid
  from public.conversation_participants cp
  where cp.conversation_id = p_conversation_id
    and cp.user_id is distinct from auth.uid()
  limit 1;

  if v_recipient_uid is not null then
    insert into public.notifications (user_id, kind, payload)
    values (
      v_recipient_uid,
      'new_message',
      jsonb_build_object(
        'conversation_id', p_conversation_id,
        'message_id', v_id,
        'preview', left(trim(p_body), 80)
      )
    );
  end if;

  return v_id;
end;
$$;

revoke all on function public.send_message(uuid, text) from public, anon, authenticated;
grant execute on function public.send_message(uuid, text) to authenticated;

-- 9. Employer organization team membership read policy (Phase 1)
drop policy if exists "membership_self_read" on public.employer_memberships;
create policy "membership_self_read" on public.employer_memberships
  for select to authenticated
  using (
    user_id = auth.uid()
    or public.is_active_employer_member(employer_id)
    or public.is_admin()
  );

-- 10. Staging Admin Waiver for Job Posting (Phase 5, 13)
create or replace function public.admin_grant_staging_job_waiver(
  p_job_id uuid,
  p_reason text
)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_emp_id uuid;
begin
  if not public.is_admin() then
    raise exception 'Administrator access required' using errcode = '42501';
  end if;

  select employer_id into v_emp_id
  from public.jobs
  where id = p_job_id;

  if not found then
    raise exception 'Job not found';
  end if;

  insert into public.job_entitlements (employer_id, job_id, payment_order_id, granted_at)
  values (v_emp_id, p_job_id, null, now())
  on conflict (job_id) do nothing;

  insert into public.audit_log (actor_id, action, entity_type, entity_id, details)
  values (
    auth.uid(),
    'admin_staging_job_waiver',
    'job',
    p_job_id::text,
    jsonb_build_object('employer_id', v_emp_id, 'reason', left(p_reason, 500))
  );
end;
$$;

revoke all on function public.admin_grant_staging_job_waiver(uuid, text) from public, anon, authenticated;
grant execute on function public.admin_grant_staging_job_waiver(uuid, text) to authenticated;

-- Ensure authenticated role can read notifications and employer verification reviews
grant select on public.employer_verification_reviews to authenticated;
grant select on public.notifications to authenticated;
