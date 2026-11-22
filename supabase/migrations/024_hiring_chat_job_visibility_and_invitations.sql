-- Migration 024: Real Hiring Chat, Job Visibility Lifecycle & Application-Linked Invitations
-- Addresses:
-- 1. Two-way employer ↔ worker chat persistence, participant authorization, and notifications
-- 2. Employer-controlled job state transitions (pause, resume, close) and exclusion from public discovery
-- 3. Application-linked candidate invitations with automatic canonical conversation creation on accept

-- ============================================================================
-- 1. EXTEND CANDIDATE INVITATIONS SCHEMA FOR APPLICATION LINKAGE
-- ============================================================================
alter table public.candidate_invitations
  add column if not exists application_id uuid references public.job_applications(id) on delete cascade;

-- Ensure candidate_handle column allows null if application_id is provided, or populate default
alter table public.candidate_invitations
  alter column candidate_handle drop not null;

create index if not exists idx_candidate_invitations_app on public.candidate_invitations(application_id);

-- Enforce at most one active (pending or accepted) invitation per application
create unique index if not exists idx_active_invitation_per_app
  on public.candidate_invitations(application_id)
  where status in ('pending', 'accepted');

-- ============================================================================
-- 2. EMPLOYER JOB STATE MANAGEMENT RPC (PAUSE, RESUME, CLOSE)
-- ============================================================================
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

  select * into v_job
  from public.jobs
  where id = p_job_id
  for update;

  if not found then
    raise exception 'Job not found';
  end if;

  -- Verify caller is active employer member or admin
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

  update public.jobs
  set state = v_new_state, updated_at = now()
  where id = p_job_id;

  insert into public.job_status_history (job_id, old_state, new_state, changed_by, reason)
  values (p_job_id, v_job.state, v_new_state, v_uid, 'Employer action: ' || p_action);

  insert into public.audit_log (actor_id, action, entity_type, entity_id, details)
  values (
    v_uid,
    'job_state_changed',
    'job',
    p_job_id::text,
    jsonb_build_object('old_state', v_job.state, 'new_state', v_new_state, 'action', p_action)
  );

  return v_new_state;
end;
$$;

revoke all on function public.update_employer_job_state(uuid, text) from public, anon, authenticated;
grant execute on function public.update_employer_job_state(uuid, text) to authenticated;

-- ============================================================================
-- 3. HARDENED PUBLIC JOB DISCOVERY (EXCLUDES PAUSED, CLOSED, EXPIRED)
-- ============================================================================
create or replace function public.get_public_published_jobs()
returns table (
  id uuid,
  employer_id uuid,
  title text,
  company text,
  city text,
  area text,
  category text,
  description text,
  salary_min_inr integer,
  salary_max_inr integer,
  requires_driving_licence boolean,
  expires_at timestamptz,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  return query
  select
    j.id,
    j.employer_id,
    j.title,
    coalesce(e.legal_name, 'Verified Logistics Partner')::text as company,
    j.city,
    coalesce(j.area, 'Central')::text as area,
    j.category,
    j.description,
    coalesce(j.salary_min_inr, 18000),
    coalesce(j.salary_max_inr, 24000),
    coalesce(j.requires_driving_licence, false),
    coalesce(j.expires_at, now() + interval '30 days'),
    j.created_at
  from public.jobs j
  join public.employers e on e.id = j.employer_id
  where j.state = 'published'
    and (j.expires_at is null or j.expires_at > clock_timestamp())
    and e.verification_state = 'verified'
  order by j.created_at desc;
end;
$$;

revoke all on function public.get_public_published_jobs() from public;
grant execute on function public.get_public_published_jobs() to anon, authenticated;

-- ============================================================================
-- 4. HARDENED APPLY TO JOB (REJECTS PAUSED, CLOSED, EXPIRED)
-- ============================================================================
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

  -- Must be published, unexpired, and owned by a verified employer
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

  v_today := (clock_timestamp() at time zone 'Asia/Kolkata')::date;
  if (
    select count(*)
    from public.job_applications a
    where a.worker_id = v_worker_id
      and (a.created_at at time zone 'Asia/Kolkata')::date = v_today
  ) >= 20 then
    raise exception 'Daily application limit reached for today (IST)';
  end if;

  insert into public.job_applications (job_id, worker_id, status)
  values (p_job_id, v_worker_id, 'applied')
  returning * into v_app;

  insert into public.application_status_history (application_id, new_status, changed_by)
  values (v_app.id, 'applied', auth.uid());

  insert into public.audit_log (actor_id, action, entity_type, entity_id, details)
  values (
    auth.uid(),
    'application_submitted',
    'application',
    v_app.id::text,
    jsonb_build_object('job_id', p_job_id, 'worker_id', v_worker_id)
  );

  -- Notify employer team members
  for v_member_user in
    select m.user_id
    from public.employer_memberships m
    where m.employer_id = v_employer_id and m.state = 'active'
  loop
    insert into public.notifications (user_id, kind, payload)
    values (
      v_member_user,
      'new_application',
      jsonb_build_object(
        'application_id', v_app.id,
        'job_id', p_job_id,
        'job_title', v_job_title
      )
    );
  end loop;

  return query select v_app.id, false;
end;
$$;

revoke all on function public.apply_to_job(uuid) from public, anon, authenticated;
grant execute on function public.apply_to_job(uuid) to authenticated;

-- ============================================================================
-- 5. CANONICAL CONVERSATION ACCESS & PARTICIPANT RESOLUTION
-- ============================================================================
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
    join public.user_accounts u on u.user_id = auth.uid()
    where c.id = p_conversation_id
      and u.account_state = 'active'
      and (
        a.status in ('shortlisted', 'hired')
        or exists (
          select 1 from public.candidate_invitations ci
          where ci.application_id = a.id and ci.status = 'accepted'
        )
      )
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

revoke all on function public.can_access_conversation(uuid) from public, anon, authenticated;
grant execute on function public.can_access_conversation(uuid) to authenticated;

-- Ensure application conversation helper
create or replace function public.ensure_application_conversation(p_application_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_id uuid;
  v_worker_uid uuid;
  v_job_id uuid;
  v_employer_id uuid;
  v_app_status public.application_state;
  v_has_accepted_invite boolean;
  v_employer_member uuid;
begin
  -- Check existing conversation
  select id into v_id from public.conversations where application_id = p_application_id;
  if v_id is not null then
    return v_id;
  end if;

  -- Validate application
  select a.worker_id, a.job_id, a.status, w.user_id, j.employer_id
  into v_id, v_job_id, v_app_status, v_worker_uid, v_employer_id
  from public.job_applications a
  join public.workers w on w.id = a.worker_id
  join public.jobs j on j.id = a.job_id
  where a.id = p_application_id;

  if v_worker_uid is null then
    raise exception 'Application not found';
  end if;

  select exists(
    select 1 from public.candidate_invitations ci
    where ci.application_id = p_application_id and ci.status = 'accepted'
  ) into v_has_accepted_invite;

  if v_app_status not in ('shortlisted', 'hired') and not v_has_accepted_invite and not public.is_admin() then
    raise exception 'Conversation requires shortlisted/hired state or an accepted hiring invitation';
  end if;

  if not (
    v_worker_uid = auth.uid()
    or public.is_active_employer_member(v_employer_id)
    or public.is_admin()
  ) then
    raise exception 'Not authorized for this application conversation' using errcode = '42501';
  end if;

  -- Create conversation
  insert into public.conversations (application_id)
  values (p_application_id)
  on conflict (application_id) do update set created_at = conversations.created_at
  returning id into v_id;

  -- Ensure worker is participant
  insert into public.conversation_participants (conversation_id, user_id)
  values (v_id, v_worker_uid)
  on conflict do nothing;

  -- Ensure active employer members are participants
  for v_employer_member in
    select user_id from public.employer_memberships
    where employer_id = v_employer_id and state = 'active'
  loop
    insert into public.conversation_participants (conversation_id, user_id)
    values (v_id, v_employer_member)
    on conflict do nothing;
  end loop;

  return v_id;
end;
$$;

revoke all on function public.ensure_application_conversation(uuid) from public, anon, authenticated;
grant execute on function public.ensure_application_conversation(uuid) to authenticated;

-- ============================================================================
-- 6. SEND MESSAGE RPC (ACCURATE RECIPIENT NOTIFICATIONS & PARTICIPANT SYNC)
-- ============================================================================
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
  v_uid uuid := auth.uid();
  v_msg_id uuid;
  v_app_id uuid;
  v_job_id uuid;
  v_job_title text;
  v_employer_id uuid;
  v_worker_uid uuid;
  v_employer_name text;
  v_recipient_uid uuid;
  v_member_user uuid;
  v_sender_name text;
begin
  if v_uid is null or char_length(trim(p_body)) not between 1 and 4000 then
    raise exception 'Invalid message or unauthenticated' using errcode = '42501';
  end if;

  if not public.can_access_conversation(p_conversation_id) then
    raise exception 'Conversation access denied' using errcode = '42501';
  end if;

  -- Resolve application details
  select c.application_id, a.job_id, j.title, j.employer_id, e.legal_name, w.user_id, coalesce(w.full_name, 'Candidate')
  into v_app_id, v_job_id, v_job_title, v_employer_id, v_employer_name, v_worker_uid, v_sender_name
  from public.conversations c
  join public.job_applications a on a.id = c.application_id
  join public.jobs j on j.id = a.job_id
  join public.employers e on e.id = j.employer_id
  join public.workers w on w.id = a.worker_id
  where c.id = p_conversation_id;

  -- Insert message
  insert into public.messages (conversation_id, sender_id, body)
  values (p_conversation_id, v_uid, trim(p_body))
  returning id into v_msg_id;

  -- Ensure sender is in participants
  insert into public.conversation_participants (conversation_id, user_id)
  values (p_conversation_id, v_uid)
  on conflict do nothing;

  -- If sender is worker -> notify employer team members
  if v_uid = v_worker_uid then
    for v_member_user in
      select user_id from public.employer_memberships
      where employer_id = v_employer_id and state = 'active'
    loop
      insert into public.notifications (user_id, kind, payload)
      values (
        v_member_user,
        'new_message',
        jsonb_build_object(
          'conversation_id', p_conversation_id,
          'message_id', v_msg_id,
          'sender_role', 'candidate',
          'job_title', v_job_title,
          'preview', left(trim(p_body), 80)
        )
      );
    end loop;
  else
    -- Sender is employer -> notify worker
    insert into public.notifications (user_id, kind, payload)
    values (
      v_worker_uid,
      'new_message',
      jsonb_build_object(
        'conversation_id', p_conversation_id,
        'message_id', v_msg_id,
        'sender_role', 'employer',
        'company', v_employer_name,
        'job_title', v_job_title,
        'preview', left(trim(p_body), 80)
      )
    );
  end if;

  return v_msg_id;
end;
$$;

revoke all on function public.send_message(uuid, text) from public, anon, authenticated;
grant execute on function public.send_message(uuid, text) to authenticated;

-- ============================================================================
-- 7. APPLICATION-LINKED CANDIDATE INVITATION RPCS
-- ============================================================================
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
  if v_uid is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  -- 1. Fetch application and job
  select * into v_app from public.job_applications where id = p_application_id;
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

  -- 2. Verify caller is active employer member
  if not (public.is_active_employer_member(v_job.employer_id) or public.is_admin()) then
    raise exception 'Not authorized to invite applicants for this organization' using errcode = '42501';
  end if;

  select legal_name into v_employer_name from public.employers where id = v_job.employer_id;
  select * into v_worker from public.workers where id = v_app.worker_id;

  -- 3. Check for existing active invitation
  if exists (
    select 1 from public.candidate_invitations
    where application_id = p_application_id
      and status in ('pending', 'accepted')
  ) then
    raise exception 'An active invitation already exists for this application';
  end if;

  -- 4. Insert invitation
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
    nullif(trim(p_message), ''),
    'pending'
  )
  returning id into v_invitation_id;

  -- 5. Notify worker with valid notification schema (kind, payload)
  insert into public.notifications (
    user_id, kind, payload
  ) values (
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

  -- 6. Audit log
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
$$;

revoke all on function public.create_application_invitation(uuid, text) from public, anon, authenticated;
grant execute on function public.create_application_invitation(uuid, text) to authenticated;

-- Respond to invitation with canonical conversation creation on accept
create or replace function public.respond_to_candidate_invitation(
  p_invitation_id uuid,
  p_accept boolean
)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_uid uuid := auth.uid();
  v_worker_id uuid;
  v_inv public.candidate_invitations%rowtype;
  v_new_status text;
  v_employer_member uuid;
  v_conv_id uuid;
  v_job_title text;
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

  -- If accepted, update application to 'shortlisted' and open conversation
  if p_accept and v_inv.application_id is not null then
    update public.job_applications
    set status = 'shortlisted', updated_at = now()
    where id = v_inv.application_id and status in ('applied', 'reviewing');

    insert into public.application_status_history (application_id, old_status, new_status, changed_by)
    values (v_inv.application_id, 'applied', 'shortlisted', v_uid);

    -- Ensure canonical conversation exists
    v_conv_id := public.ensure_application_conversation(v_inv.application_id);
  end if;

  -- Notify employer team members using valid columns (user_id, kind, payload)
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
        'application_id', v_inv.application_id,
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
    jsonb_build_object('response', v_new_status, 'application_id', v_inv.application_id)
  );
end;
$$;

revoke all on function public.respond_to_candidate_invitation(uuid, boolean) from public, anon, authenticated;
grant execute on function public.respond_to_candidate_invitation(uuid, boolean) to authenticated;

-- ============================================================================
-- 8. SECURE RPC TO GET CONVERSATIONS FOR BOTH EMPLOYER AND WORKER
-- ============================================================================
create or replace function public.get_user_conversations()
returns table (
  conversation_id uuid,
  application_id uuid,
  job_id uuid,
  job_title text,
  participant_name text,
  participant_role text,
  last_message_text text,
  last_message_at timestamptz,
  messages_json jsonb
)
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_uid uuid := auth.uid();
  v_is_worker boolean;
begin
  if v_uid is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  return query
  select
    c.id as conversation_id,
    c.application_id,
    j.id as job_id,
    j.title as job_title,
    case
      when w.user_id = v_uid then coalesce(e.legal_name, 'Hiring Team')
      else coalesce(w.full_name, 'Candidate')
    end as participant_name,
    case
      when w.user_id = v_uid then 'Employer'
      else 'Candidate'
    end as participant_role,
    lm.body as last_message_text,
    lm.created_at as last_message_at,
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'id', m.id,
            'from', case when m.sender_id = v_uid then 'me' else 'them' end,
            'text', m.body,
            'at', m.created_at
          ) order by m.created_at asc
        )
        from public.messages m
        where m.conversation_id = c.id
      ),
      '[]'::jsonb
    ) as messages_json
  from public.conversations c
  join public.job_applications a on a.id = c.application_id
  join public.jobs j on j.id = a.job_id
  join public.employers e on e.id = j.employer_id
  join public.workers w on w.id = a.worker_id
  left join lateral (
    select m.body, m.created_at
    from public.messages m
    where m.conversation_id = c.id
    order by m.created_at desc
    limit 1
  ) lm on true
  where public.can_access_conversation(c.id)
  order by coalesce(lm.created_at, c.created_at) desc;
end;
$$;

revoke all on function public.get_user_conversations() from public, anon, authenticated;
grant execute on function public.get_user_conversations() to authenticated;
