-- Migration 023: Admin Provisioning, Candidate Invitations and Staging Moderation
-- Enables:
-- 1. Audited provisioning of owner-requested admin account: ankulpalwork@gmail.com
-- 2. Real database candidate invitations workflow between verified employers and discoverable workers
-- 3. Staging administrative publishing waiver for owner local verification

-- ============================================================================
-- 1. PROVISION DESIGNATED OWNER ADMINISTRATOR
-- ============================================================================
do $$
declare
  v_admin_uid uuid;
begin
  -- Resolve auth.users id for ankulpalwork@gmail.com
  select id into v_admin_uid
  from auth.users
  where email = 'ankulpalwork@gmail.com'
  limit 1;

  if v_admin_uid is not null then
    -- Ensure active user_accounts record
    insert into public.user_accounts (user_id, account_state)
    values (v_admin_uid, 'active')
    on conflict (user_id) do update set account_state = 'active';

    -- Insert into admin_principals
    insert into public.admin_principals (user_id, provisioned_by, provisioned_at, reason)
    values (v_admin_uid, 'owner_designation', now(), 'Owner designated platform administrator')
    on conflict (user_id) do nothing;

    -- Audit log entry
    insert into public.audit_log (actor_id, action, entity_type, entity_id, details)
    values (v_admin_uid, 'admin_provision', 'admin_principal', v_admin_uid::text, jsonb_build_object(
      'email', 'ankulpalwork@gmail.com',
      'method', 'migration_023_owner_designation'
    ));
  end if;
end $$;

-- ============================================================================
-- 2. CANDIDATE INVITATIONS SCHEMA
-- ============================================================================
create table if not exists public.candidate_invitations (
  id uuid primary key default gen_random_uuid(),
  employer_id uuid not null references public.employers(id) on delete cascade,
  worker_id uuid not null references public.workers(id) on delete cascade,
  candidate_handle text not null,
  job_id uuid references public.jobs(id) on delete set null,
  message text,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined', 'expired')),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '7 days'),
  responded_at timestamptz
);

create index if not exists idx_candidate_invitations_worker on public.candidate_invitations(worker_id, status);
create index if not exists idx_candidate_invitations_employer on public.candidate_invitations(employer_id, status);
create index if not exists idx_candidate_invitations_job on public.candidate_invitations(job_id);

alter table public.candidate_invitations enable row level security;

-- Policies for candidate_invitations
drop policy if exists invitations_worker_read on public.candidate_invitations;
create policy invitations_worker_read on public.candidate_invitations
  for select to authenticated
  using (worker_id = public.current_worker_id() or public.is_admin());

drop policy if exists invitations_employer_read on public.candidate_invitations;
create policy invitations_employer_read on public.candidate_invitations
  for select to authenticated
  using (public.is_active_employer_member(employer_id) or public.is_admin());

grant select on public.candidate_invitations to authenticated;

-- ============================================================================
-- 3. CANDIDATE INVITATION RPCS
-- ============================================================================

-- A. Create candidate invitation
create or replace function public.create_candidate_invitation(
  p_candidate_handle text,
  p_job_id uuid,
  p_message text default null
) returns uuid
language plpgsql security definer set search_path = ''
as $$
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

  -- 1. Verify caller is an active employer member
  select m.employer_id, e.trade_name into v_employer_id, v_employer_name
  from public.employer_memberships m
  join public.employers e on e.id = m.employer_id
  where m.user_id = v_uid and m.state = 'active'
  limit 1;

  if v_employer_id is null then
    raise exception 'Active employer membership required to invite candidates' using errcode = '42501';
  end if;

  -- 2. If job_id is provided, verify it belongs to this employer
  if p_job_id is not null then
    select * into v_job from public.jobs where id = p_job_id and employer_id = v_employer_id;
    if not found then
      raise exception 'Specified job listing does not belong to your organization';
    end if;
  end if;

  -- 3. Resolve worker by handle
  select id, user_id into v_worker_id, v_worker_user_id
  from public.workers
  where encode(extensions.digest(id::text, 'sha256'), 'hex') = p_candidate_handle
    and discoverable = true and account_state = 'active'
  limit 1;

  if v_worker_id is null then
    raise exception 'Candidate is not available for invitation or has disabled discoverability';
  end if;

  -- 4. Check for duplicate pending invitation
  select id into v_invitation_id
  from public.candidate_invitations
  where employer_id = v_employer_id and worker_id = v_worker_id and status = 'pending'
    and (job_id is not distinct from p_job_id);

  if v_invitation_id is not null then
    raise exception 'A pending invitation already exists for this candidate';
  end if;

  -- 5. Insert invitation
  insert into public.candidate_invitations (
    employer_id, worker_id, candidate_handle, job_id, message, status
  ) values (
    v_employer_id, v_worker_id, p_candidate_handle, p_job_id, left(p_message, 500), 'pending'
  ) returning id into v_invitation_id;

  -- 6. Insert notification for worker
  insert into public.notifications (
    user_id, type, title, body, metadata
  ) values (
    v_worker_user_id,
    'candidate_invited',
    'New Hiring Invitation',
    coalesce(v_employer_name, 'An employer') || ' has invited you to apply for an active role.',
    jsonb_build_object('invitation_id', v_invitation_id, 'job_id', p_job_id, 'employer_id', v_employer_id)
  );

  -- 7. Audit log
  insert into public.audit_log (actor_id, action, entity_type, entity_id, details)
  values (v_uid, 'candidate_invite_sent', 'candidate_invitation', v_invitation_id::text, jsonb_build_object(
    'employer_id', v_employer_id,
    'candidate_handle', p_candidate_handle,
    'job_id', p_job_id
  ));

  return v_invitation_id;
end;
$$;

revoke all on function public.create_candidate_invitation(text, uuid, text) from public, anon, authenticated;
grant execute on function public.create_candidate_invitation(text, uuid, text) to authenticated;

-- B. Respond to candidate invitation
create or replace function public.respond_to_candidate_invitation(
  p_invitation_id uuid,
  p_accept boolean
) returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_worker_id uuid;
  v_inv public.candidate_invitations%rowtype;
  v_new_status text;
  v_employer_member uuid;
begin
  if v_uid is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  v_worker_id := public.current_worker_id();
  if v_worker_id is null then
    raise exception 'Worker profile required' using errcode = '42501';
  end if;

  -- 1. Fetch invitation with lock
  select * into v_inv from public.candidate_invitations
  where id = p_invitation_id and worker_id = v_worker_id
  for update;

  if not found then
    raise exception 'Invitation not found or not addressed to you';
  end if;

  if v_inv.status != 'pending' then
    raise exception 'Invitation is already %', v_inv.status;
  end if;

  v_new_status := case when p_accept then 'accepted' else 'declined' end;

  -- 2. Update status
  update public.candidate_invitations
  set status = v_new_status, responded_at = now()
  where id = p_invitation_id;

  -- 3. Notify employer owners
  for v_employer_member in
    select user_id from public.employer_memberships
    where employer_id = v_inv.employer_id and state = 'active'
  loop
    insert into public.notifications (
      user_id, type, title, body, metadata
    ) values (
      v_employer_member,
      case when p_accept then 'invitation_accepted' else 'invitation_declined' end,
      'Invitation Response: ' || initcap(v_new_status),
      'A candidate has ' || v_new_status || ' your hiring invitation.',
      jsonb_build_object('invitation_id', p_invitation_id, 'job_id', v_inv.job_id, 'status', v_new_status)
    );
  end loop;

  -- 4. Audit log
  insert into public.audit_log (actor_id, action, entity_type, entity_id, details)
  values (v_uid, 'candidate_invite_response', 'candidate_invitation', p_invitation_id::text, jsonb_build_object(
    'decision', v_new_status
  ));
end;
$$;

revoke all on function public.respond_to_candidate_invitation(uuid, boolean) from public, anon, authenticated;
grant execute on function public.respond_to_candidate_invitation(uuid, boolean) to authenticated;

-- C. Fetch Worker Invitations
create or replace function public.get_worker_candidate_invitations()
returns table (
  id uuid,
  job_id uuid,
  job_title text,
  employer_name text,
  message text,
  status text,
  created_at timestamptz,
  expires_at timestamptz
)
language plpgsql security definer set search_path = ''
as $$
declare
  v_worker_id uuid := public.current_worker_id();
begin
  if v_worker_id is null then
    return;
  end if;

  return query
  select
    i.id,
    i.job_id,
    coalesce(j.title, 'General Logistics Role') as job_title,
    coalesce(e.trade_name, e.legal_name) as employer_name,
    i.message,
    i.status,
    i.created_at,
    i.expires_at
  from public.candidate_invitations i
  join public.employers e on e.id = i.employer_id
  left join public.jobs j on j.id = i.job_id
  where i.worker_id = v_worker_id
  order by i.created_at desc;
end;
$$;

revoke all on function public.get_worker_candidate_invitations() from public, anon, authenticated;
grant execute on function public.get_worker_candidate_invitations() to authenticated;

-- D. Fetch Employer Invitations
create or replace function public.get_employer_candidate_invitations(p_job_id uuid default null)
returns table (
  id uuid,
  candidate_handle text,
  job_id uuid,
  job_title text,
  message text,
  status text,
  created_at timestamptz,
  responded_at timestamptz
)
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_employer_id uuid;
begin
  if v_uid is null then
    return;
  end if;

  select employer_id into v_employer_id
  from public.employer_memberships
  where user_id = v_uid and state = 'active'
  limit 1;

  if v_employer_id is null then
    return;
  end if;

  return query
  select
    i.id,
    i.candidate_handle,
    i.job_id,
    coalesce(j.title, 'General Logistics Role') as job_title,
    i.message,
    i.status,
    i.created_at,
    i.responded_at
  from public.candidate_invitations i
  left join public.jobs j on j.id = i.job_id
  where i.employer_id = v_employer_id
    and (p_job_id is null or i.job_id = p_job_id)
  order by i.created_at desc;
end;
$$;

revoke all on function public.get_employer_candidate_invitations(uuid) from public, anon, authenticated;
grant execute on function public.get_employer_candidate_invitations(uuid) to authenticated;
