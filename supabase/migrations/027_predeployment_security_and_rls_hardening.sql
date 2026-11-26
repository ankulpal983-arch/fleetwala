-- Migration 027: Pre-Deployment Security, Least-Privilege ACL & Hiring RPC Hardening
-- Target Supabase Project: jigbzsaaowtyaqhreplg
-- Safety: Strictly non-destructive (ACL tightening, RPC security hardening, read helpers).
--         Does NOT drop data, disable RLS, reset tables, or delete existing accounts.

-- ---------------------------------------------------------------------------
-- 1. Least-privilege table & function ACL tightening
-- ---------------------------------------------------------------------------

-- Remove excessive table-level grants on candidate_invitations (all writes use SECURITY DEFINER RPCs)
revoke all on table public.candidate_invitations from public, anon, authenticated;
grant select on table public.candidate_invitations to authenticated;

-- Allow authenticated users to create support tickets via existing support_owner_insert RLS policy
-- Column-scoped grant prevents forging non-open status on insert.
revoke insert, update, delete, truncate on table public.support_tickets from public, anon, authenticated;
grant select on table public.support_tickets to authenticated;
grant insert (opened_by, employer_id, subject, details) on table public.support_tickets to authenticated;

-- Prevent authenticated/public callers from invoking zero-admin bootstrap RPC
revoke all on function public.bootstrap_admin(text) from public, anon, authenticated;
grant execute on function public.bootstrap_admin(text) to postgres, service_role;

-- ---------------------------------------------------------------------------
-- 2. Harden invitation RPCs (verified employer gate + accurate status history)
-- ---------------------------------------------------------------------------

create or replace function public.create_candidate_invitation(
  p_candidate_handle text,
  p_job_id uuid,
  p_message text default null::text
)
returns uuid
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_uid uuid := auth.uid();
  v_worker_id uuid;
  v_employer_id uuid;
  v_job public.jobs%rowtype;
  v_invitation_id uuid;
  v_worker_user_id uuid;
  v_employer_name text;
begin
  if v_uid is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if p_candidate_handle is null or char_length(trim(p_candidate_handle)) = 0 then
    raise exception 'Candidate identifier is required';
  end if;

  -- Verify caller is an active member of a VERIFIED employer with an active user account
  select m.employer_id, e.legal_name
  into v_employer_id, v_employer_name
  from public.employer_memberships m
  join public.employers e on e.id = m.employer_id
  join public.user_accounts u on u.user_id = m.user_id
  where m.user_id = v_uid
    and m.state = 'active'
    and e.verification_state = 'verified'
    and u.account_state = 'active'
  order by m.created_at asc
  limit 1;

  if v_employer_id is null then
    raise exception 'Active membership in a verified employer organization is required to invite candidates' using errcode = '42501';
  end if;

  -- If job_id is provided, verify it belongs to this employer
  if p_job_id is not null then
    select * into v_job from public.jobs where id = p_job_id and employer_id = v_employer_id;
    if not found then
      raise exception 'Specified job listing does not belong to your organization';
    end if;
  end if;

  -- Resolve discoverable active worker by handle
  select w.id, w.user_id
  into v_worker_id, v_worker_user_id
  from public.workers w
  where (
    encode(extensions.digest(w.id::text, 'sha256'), 'hex') = p_candidate_handle
    or w.id::text = p_candidate_handle
    or ('cand-' || substr(w.id::text, 1, 8)) = p_candidate_handle
  )
    and w.discoverable = true
    and w.account_state = 'active'
  limit 1;

  if v_worker_id is null then
    raise exception 'Candidate is not available for invitation or has disabled discoverability';
  end if;

  -- Prevent duplicate pending invitations
  select id into v_invitation_id
  from public.candidate_invitations
  where employer_id = v_employer_id
    and worker_id = v_worker_id
    and status = 'pending'
    and (job_id is not distinct from p_job_id);

  if v_invitation_id is not null then
    raise exception 'A pending invitation already exists for this candidate';
  end if;

  insert into public.candidate_invitations (
    employer_id, worker_id, candidate_handle, job_id, message, status
  ) values (
    v_employer_id, v_worker_id, p_candidate_handle, p_job_id, nullif(left(trim(p_message), 500), ''), 'pending'
  ) returning id into v_invitation_id;

  insert into public.notifications (user_id, kind, payload)
  values (
    v_worker_user_id,
    'candidate_invited',
    jsonb_build_object(
      'invitation_id', v_invitation_id,
      'job_id', p_job_id,
      'job_title', coalesce(v_job.title, 'General Logistics Opportunity'),
      'company', coalesce(v_employer_name, 'Logistics Partner'),
      'message', nullif(left(trim(p_message), 500), '')
    )
  );

  insert into public.audit_log (actor_id, action, entity_type, entity_id, details)
  values (
    v_uid,
    'candidate_invite_sent',
    'candidate_invitation',
    v_invitation_id::text,
    jsonb_build_object('employer_id', v_employer_id, 'candidate_handle', p_candidate_handle, 'job_id', p_job_id)
  );

  return v_invitation_id;
end;
$function$;

create or replace function public.create_application_invitation(
  p_application_id uuid,
  p_message text default null::text
)
returns uuid
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_uid uuid := auth.uid();
  v_app public.job_applications%rowtype;
  v_job public.jobs%rowtype;
  v_worker public.workers%rowtype;
  v_employer_name text;
  v_employer_verif text;
  v_invitation_id uuid;
  v_is_admin boolean := public.is_admin();
begin
  if v_uid is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  select * into v_app from public.job_applications where id = p_application_id for update;
  if not found then
    raise exception 'Application not found';
  end if;

  if v_app.status in ('withdrawn', 'rejected', 'hired') then
    raise exception 'Application is in terminal state (%) and cannot be invited', v_app.status;
  end if;

  select * into v_job from public.jobs where id = v_app.job_id;
  if not found then
    raise exception 'Job not found';
  end if;

  if not (public.is_active_employer_member(v_job.employer_id) or v_is_admin) then
    raise exception 'Not authorized to invite applicants for this organization' using errcode = '42501';
  end if;

  select legal_name, verification_state
  into v_employer_name, v_employer_verif
  from public.employers
  where id = v_job.employer_id;

  if not v_is_admin and v_employer_verif is distinct from 'verified' then
    raise exception 'Employer organization must be verified before sending invitations' using errcode = '42501';
  end if;

  select * into v_worker from public.workers where id = v_app.worker_id;

  if exists (
    select 1 from public.candidate_invitations
    where application_id = p_application_id
      and status in ('pending', 'accepted')
  ) then
    raise exception 'An active invitation already exists for this application';
  end if;

  insert into public.candidate_invitations (
    employer_id,
    worker_id,
    job_id,
    application_id,
    candidate_handle,
    message,
    status
  ) values (
    v_job.employer_id,
    v_app.worker_id,
    v_job.id,
    p_application_id,
    'cand-' || substr(v_app.worker_id::text, 1, 8),
    nullif(left(trim(p_message), 500), ''),
    'pending'
  )
  returning id into v_invitation_id;

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
      'message', nullif(left(trim(p_message), 500), '')
    )
  );

  insert into public.audit_log (actor_id, action, entity_type, entity_id, details)
  values (
    v_uid,
    'application_invitation_created',
    'candidate_invitation',
    v_invitation_id::text,
    jsonb_build_object(
      'application_id', p_application_id,
      'employer_id', v_job.employer_id,
      'worker_id', v_app.worker_id
    )
  );

  return v_invitation_id;
end;
$function$;

create or replace function public.respond_to_candidate_invitation(
  p_invitation_id uuid,
  p_accept boolean
)
returns void
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_uid uuid := auth.uid();
  v_worker_id uuid;
  v_inv public.candidate_invitations%rowtype;
  v_new_status text;
  v_employer_member uuid;
  v_conv_id uuid;
  v_job_title text;
  v_app_id uuid;
  v_old_app_status public.application_state;
begin
  if v_uid is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  v_worker_id := public.current_worker_id();
  if v_worker_id is null then
    raise exception 'Worker profile required' using errcode = '42501';
  end if;

  select * into v_inv
  from public.candidate_invitations
  where id = p_invitation_id and worker_id = v_worker_id
  for update;

  if not found then
    raise exception 'Invitation not found or not addressed to you';
  end if;

  if v_inv.status != 'pending' then
    raise exception 'Invitation is already %', v_inv.status;
  end if;

  v_new_status := case when p_accept then 'accepted' else 'declined' end;

  update public.candidate_invitations
  set status = v_new_status, responded_at = now()
  where id = p_invitation_id;

  select title into v_job_title from public.jobs where id = v_inv.job_id;

  if p_accept then
    if v_inv.application_id is not null then
      select status into v_old_app_status
      from public.job_applications
      where id = v_inv.application_id
      for update;

      if v_old_app_status in ('applied', 'reviewing') then
        update public.job_applications
        set status = 'shortlisted', updated_at = now()
        where id = v_inv.application_id;

        insert into public.application_status_history (application_id, old_status, new_status, changed_by)
        values (v_inv.application_id, v_old_app_status, 'shortlisted', v_uid);
      end if;

      v_conv_id := public.ensure_application_conversation(v_inv.application_id);
    elsif v_inv.job_id is not null then
      select id, status into v_app_id, v_old_app_status
      from public.job_applications
      where job_id = v_inv.job_id and worker_id = v_inv.worker_id
      limit 1
      for update;

      if v_app_id is null then
        insert into public.job_applications (job_id, worker_id, status)
        values (v_inv.job_id, v_inv.worker_id, 'shortlisted')
        returning id into v_app_id;

        insert into public.application_status_history (application_id, old_status, new_status, changed_by)
        values (v_app_id, 'applied', 'shortlisted', v_uid);
      elsif v_old_app_status in ('applied', 'reviewing') then
        update public.job_applications
        set status = 'shortlisted', updated_at = now()
        where id = v_app_id;

        insert into public.application_status_history (application_id, old_status, new_status, changed_by)
        values (v_app_id, v_old_app_status, 'shortlisted', v_uid);
      end if;

      update public.candidate_invitations
      set application_id = v_app_id
      where id = p_invitation_id;

      v_conv_id := public.ensure_application_conversation(v_app_id);
    end if;
  end if;

  for v_employer_member in
    select user_id from public.employer_memberships
    where employer_id = v_inv.employer_id and state = 'active'
  loop
    insert into public.notifications (user_id, kind, payload)
    values (
      v_employer_member,
      case when p_accept then 'invitation_accepted' else 'invitation_declined' end,
      jsonb_build_object(
        'invitation_id', p_invitation_id,
        'application_id', coalesce(v_inv.application_id, v_app_id),
        'job_id', v_inv.job_id,
        'job_title', coalesce(v_job_title, 'Opening'),
        'status', v_new_status
      )
    );
  end loop;

  insert into public.audit_log (actor_id, action, entity_type, entity_id, details)
  values (
    v_uid,
    'candidate_invitation_responded',
    'candidate_invitation',
    p_invitation_id::text,
    jsonb_build_object('response', v_new_status, 'application_id', coalesce(v_inv.application_id, v_app_id))
  );
end;
$function$;

-- ---------------------------------------------------------------------------
-- 3. Privacy-preserving applicant & worker history read helpers + atomic toggle
-- ---------------------------------------------------------------------------

-- Employer applicants reader: preserves anonymity (SHA-256 FW-XXXXXX handle),
-- hides worker PII (name/phone/email), works even when discoverable = false.
create or replace function public.get_employer_applicants(p_employer_id uuid default null)
returns table(
  application_id uuid,
  job_id uuid,
  job_title text,
  company_name text,
  candidate_code text,
  candidate_handle text,
  worker_city text,
  worker_area text,
  experience_band text,
  vehicle_type text,
  has_own_vehicle boolean,
  latest_status public.application_state,
  created_at timestamptz,
  status_history jsonb
)
language plpgsql
stable
security definer
set search_path to ''
as $function$
declare
  v_uid uuid := auth.uid();
  v_target_emp_id uuid := p_employer_id;
  v_is_admin boolean := public.is_admin();
begin
  if v_uid is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if v_target_emp_id is not null then
    if not (public.is_active_employer_member(v_target_emp_id) or v_is_admin) then
      raise exception 'Not authorized for this organization' using errcode = '42501';
    end if;
  elsif not v_is_admin then
    select m.employer_id into v_target_emp_id
    from public.employer_memberships m
    join public.user_accounts u on u.user_id = m.user_id
    where m.user_id = v_uid
      and m.state = 'active'
      and u.account_state = 'active'
    order by m.created_at asc
    limit 1;

    if v_target_emp_id is null then
      return;
    end if;
  end if;

  return query
  select
    a.id as application_id,
    a.job_id,
    j.title as job_title,
    coalesce(e.legal_name, 'Organization') as company_name,
    'FW-' || upper(substr(encode(extensions.digest(w.id::text, 'sha256'), 'hex'), 1, 6)) as candidate_code,
    encode(extensions.digest(w.id::text, 'sha256'), 'hex') as candidate_handle,
    coalesce(w.city, 'India') as worker_city,
    coalesce(nullif(trim(w.address_line), ''), coalesce(w.city, 'Local')) as worker_area,
    coalesce(w.experience_band, 'fresher') as experience_band,
    coalesce(w.vehicle_type, 'none') as vehicle_type,
    coalesce(w.has_own_vehicle, false) as has_own_vehicle,
    a.status as latest_status,
    a.created_at,
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object('status', h.new_status, 'at', h.changed_at)
          order by h.changed_at asc
        )
        from public.application_status_history h
        where h.application_id = a.id
      ),
      jsonb_build_array(jsonb_build_object('status', a.status, 'at', a.created_at))
    ) as status_history
  from public.job_applications a
  join public.jobs j on j.id = a.job_id
  join public.employers e on e.id = j.employer_id
  join public.workers w on w.id = a.worker_id
  where (v_target_emp_id is null or j.employer_id = v_target_emp_id)
  order by a.created_at desc;
end;
$function$;

-- Worker applications reader: returns full company legal_name & job metadata
-- even if the employer later paused or closed the job.
create or replace function public.get_worker_applications()
returns table(
  application_id uuid,
  job_id uuid,
  job_title text,
  company_name text,
  city text,
  area text,
  job_state public.job_state,
  latest_status public.application_state,
  created_at timestamptz,
  status_history jsonb
)
language plpgsql
stable
security definer
set search_path to ''
as $function$
declare
  v_uid uuid := auth.uid();
  v_worker_id uuid := public.current_worker_id();
begin
  if v_uid is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if v_worker_id is null then
    return;
  end if;

  return query
  select
    a.id as application_id,
    a.job_id,
    j.title as job_title,
    coalesce(e.legal_name, 'Verified Logistics Partner') as company_name,
    j.city,
    coalesce(j.area, 'Central') as area,
    j.state as job_state,
    a.status as latest_status,
    a.created_at,
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object('status', h.new_status, 'at', h.changed_at)
          order by h.changed_at asc
        )
        from public.application_status_history h
        where h.application_id = a.id
      ),
      jsonb_build_array(jsonb_build_object('status', a.status, 'at', a.created_at))
    ) as status_history
  from public.job_applications a
  join public.jobs j on j.id = a.job_id
  join public.employers e on e.id = j.employer_id
  where a.worker_id = v_worker_id
  order by a.created_at desc;
end;
$function$;

-- Atomic worker discoverability consent toggle (prevents overwriting profile fields)
create or replace function public.set_worker_discoverability(p_discoverable boolean)
returns boolean
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_uid uuid := auth.uid();
  v_worker_id uuid;
begin
  if v_uid is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  update public.workers
  set discoverable = coalesce(p_discoverable, false),
      updated_at = clock_timestamp()
  where user_id = v_uid
    and account_state = 'active'
  returning id into v_worker_id;

  if v_worker_id is null then
    raise exception 'Please save your worker profile before changing discoverability.';
  end if;

  insert into public.worker_preferences (worker_id, consent_discovery_at, updated_at)
  values (
    v_worker_id,
    case when coalesce(p_discoverable, false) then clock_timestamp() else null end,
    clock_timestamp()
  )
  on conflict (worker_id) do update set
    consent_discovery_at = case
      when coalesce(p_discoverable, false) and worker_preferences.consent_discovery_at is null then clock_timestamp()
      when not coalesce(p_discoverable, false) then null
      else worker_preferences.consent_discovery_at
    end,
    updated_at = clock_timestamp();

  return coalesce(p_discoverable, false);
end;
$function$;

-- Admin support ticket status transition with audit trail & owner notification
create or replace function public.admin_update_support_ticket(
  p_ticket_id uuid,
  p_status public.ticket_state,
  p_note text default null::text
)
returns void
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_ticket public.support_tickets%rowtype;
begin
  if not public.is_admin() then
    raise exception 'Administrator access required' using errcode = '42501';
  end if;

  select * into v_ticket
  from public.support_tickets
  where id = p_ticket_id
  for update;

  if not found then
    raise exception 'Support ticket not found';
  end if;

  update public.support_tickets
  set status = p_status, updated_at = clock_timestamp()
  where id = p_ticket_id;

  insert into public.audit_log (actor_id, action, entity_type, entity_id, details)
  values (
    auth.uid(),
    'support_ticket_status',
    'support_ticket',
    p_ticket_id::text,
    jsonb_build_object(
      'old_status', v_ticket.status,
      'new_status', p_status,
      'note', nullif(left(trim(p_note), 500), '')
    )
  );

  insert into public.notifications (user_id, kind, payload)
  values (
    v_ticket.opened_by,
    'support_ticket_update',
    jsonb_build_object(
      'ticket_id', p_ticket_id,
      'subject', v_ticket.subject,
      'status', p_status
    )
  );
end;
$function$;

-- Least-privilege EXECUTE grants on new & hardened RPCs
revoke all on function public.create_candidate_invitation(text, uuid, text) from public, anon;
grant execute on function public.create_candidate_invitation(text, uuid, text) to authenticated, service_role;

revoke all on function public.create_application_invitation(uuid, text) from public, anon;
grant execute on function public.create_application_invitation(uuid, text) to authenticated, service_role;

revoke all on function public.respond_to_candidate_invitation(uuid, boolean) from public, anon;
grant execute on function public.respond_to_candidate_invitation(uuid, boolean) to authenticated, service_role;

revoke all on function public.get_employer_applicants(uuid) from public, anon;
grant execute on function public.get_employer_applicants(uuid) to authenticated, service_role;

revoke all on function public.get_worker_applications() from public, anon;
grant execute on function public.get_worker_applications() to authenticated, service_role;

revoke all on function public.set_worker_discoverability(boolean) from public, anon;
grant execute on function public.set_worker_discoverability(boolean) to authenticated, service_role;

revoke all on function public.admin_update_support_ticket(uuid, public.ticket_state, text) from public, anon;
grant execute on function public.admin_update_support_ticket(uuid, public.ticket_state, text) to authenticated, service_role;
