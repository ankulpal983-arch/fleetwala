-- Migration 027: Pre-Deployment Security, Least-Privilege ACL, Locality Privacy & Hiring RPC Hardening
-- Target Supabase Project: jigbzsaaowtyaqhreplg
-- Safety: Strictly non-destructive (ACL tightening, sanitized locality column/projection,
--         cryptographic candidate handle enforcement, RPC security hardening, read helpers).
--         Does NOT drop data, disable RLS, reset tables, or delete existing accounts.

-- ---------------------------------------------------------------------------
-- 1. Least-privilege table, sequence, column & function ACL tightening
-- ---------------------------------------------------------------------------

-- Remove excessive table-level grants on candidate_invitations (all writes use SECURITY DEFINER RPCs)
revoke all on table public.candidate_invitations from public, anon, authenticated;
grant select on table public.candidate_invitations to authenticated;

-- Revoke residual anon/authenticated privileges on internal identity sequences written only by SECURITY DEFINER RPCs
revoke all on sequence public.application_status_history_id_seq from public, anon, authenticated;
revoke all on sequence public.audit_log_id_seq from public, anon, authenticated;
revoke all on sequence public.employer_verification_reviews_id_seq from public, anon, authenticated;
revoke all on sequence public.job_status_history_id_seq from public, anon, authenticated;

-- Allow authenticated users to create support tickets via existing support_owner_insert RLS policy
-- Column-scoped grant prevents forging non-open status on insert.
revoke insert, update, delete, truncate on table public.support_tickets from public, anon, authenticated;
grant select on table public.support_tickets to authenticated;
grant insert (opened_by, employer_id, subject, details) on table public.support_tickets to authenticated;

-- Prevent authenticated/public callers from invoking zero-admin bootstrap RPC
revoke all on function public.bootstrap_admin(text) from public, anon, authenticated;
grant execute on function public.bootstrap_admin(text) to postgres, service_role;

-- Dedicated sanitized public locality column on workers (separates public neighbourhood from private address_line)
alter table public.workers
  add column if not exists locality text;

-- Restore least-privilege column-scoped grants on workers and jobs
revoke insert, update, delete, truncate on table public.workers from public, anon, authenticated;
grant select on table public.workers to authenticated;
grant insert (
  user_id, full_name, phone_e164, email, photo_path, address_line, locality, city, postal_code,
  category, experience_band, vehicle_type, has_own_vehicle, fuel_support_required,
  discoverable, availability, updated_at
) on table public.workers to authenticated;
grant update (
  full_name, phone_e164, email, photo_path, address_line, locality, city, postal_code,
  category, experience_band, vehicle_type, has_own_vehicle, fuel_support_required,
  discoverable, availability, updated_at
) on table public.workers to authenticated;

revoke insert, update, delete, truncate on table public.jobs from public, anon, authenticated;
grant select on table public.jobs to authenticated;
grant insert (
  employer_id, created_by, title, category, description, city, area, postal_code,
  work_address, salary_min_inr, salary_max_inr, requires_driving_licence, expires_at, state
) on table public.jobs to authenticated;
grant update (
  title, category, description, city, area, postal_code, work_address,
  salary_min_inr, salary_max_inr, requires_driving_licence, expires_at, updated_at
) on table public.jobs to authenticated;

-- ---------------------------------------------------------------------------
-- 1b. Sanitized Candidate Locality Helpers, Backfill & Discovery Hardening
-- ---------------------------------------------------------------------------

-- Strips house/flat/street/pincode/contact patterns so raw residential addresses are never exposed publicly.
create or replace function public.sanitize_locality(
  p_raw text,
  p_city text default null::text
)
returns text
language sql
immutable
set search_path to ''
as $function$
  select case
    when p_raw is null then null
    when char_length(trim(regexp_replace(p_raw, '\s+', ' ', 'g'))) = 0 then null
    when char_length(trim(regexp_replace(p_raw, '\s+', ' ', 'g'))) > 50 then null
    when p_raw ~ '[@#/]' then null
    when p_raw ~ '[0-9]{4,}' then null
    when p_raw ~* '\m(house|h\.?no|flat|apt|apartment|plot|gali|lane|street|st\.?|khasra|floor|wing|tower|bldg|building|room|opp|opposite|near|behind|front|chowk|pin)\M' then null
    else trim(regexp_replace(p_raw, '\s+', ' ', 'g'))
  end;
$function$;

create or replace function public.safe_worker_locality(
  p_city text,
  p_locality text,
  p_address_line text default null::text
)
returns text
language sql
immutable
set search_path to ''
as $function$
  select coalesce(
    public.sanitize_locality(p_locality, p_city),
    public.sanitize_locality(p_address_line, p_city),
    nullif(trim(p_city), ''),
    'Local'
  );
$function$;

-- Non-destructive backfill preserving genuine localities (e.g. 'Dwarka', 'Gurugram Sec 18')
update public.workers w
set locality = public.sanitize_locality(coalesce(w.locality, w.address_line), w.city)
where w.locality is null
  and coalesce(trim(w.address_line), '') <> '';

create or replace function public.save_worker_profile(
  p_full_name text,
  p_city text,
  p_address_line text,
  p_experience_band text,
  p_vehicle_type text,
  p_has_own_vehicle boolean default false,
  p_discoverable boolean default false,
  p_availability text default 'immediate'::text
)
returns uuid
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_uid uuid := auth.uid();
  v_worker_id uuid;
  v_sanitized_locality text;
begin
  if v_uid is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if char_length(trim(coalesce(p_full_name, ''))) < 2 then
    raise exception 'Full name must be at least 2 characters';
  end if;

  v_sanitized_locality := public.sanitize_locality(p_address_line, p_city);

  insert into public.user_accounts (user_id, account_state)
  values (v_uid, 'active')
  on conflict (user_id) do nothing;

  insert into public.workers (
    user_id, full_name, city, address_line, locality, experience_band,
    vehicle_type, has_own_vehicle, discoverable, availability, account_state
  ) values (
    v_uid,
    trim(p_full_name),
    p_city,
    nullif(trim(p_address_line), ''),
    v_sanitized_locality,
    p_experience_band,
    p_vehicle_type,
    coalesce(p_has_own_vehicle, false),
    coalesce(p_discoverable, false),
    coalesce(p_availability, 'immediate'),
    'active'
  )
  on conflict (user_id) do update set
    full_name = excluded.full_name,
    city = excluded.city,
    address_line = excluded.address_line,
    locality = coalesce(excluded.locality, public.sanitize_locality(excluded.address_line, excluded.city)),
    experience_band = excluded.experience_band,
    vehicle_type = excluded.vehicle_type,
    has_own_vehicle = excluded.has_own_vehicle,
    discoverable = excluded.discoverable,
    availability = excluded.availability,
    updated_at = clock_timestamp()
  returning id into v_worker_id;

  return v_worker_id;
end;
$function$;

create or replace function public.discover_workers(
  p_city text default null::text,
  p_area text default null::text,
  p_category text default null::text,
  p_experience text default null::text,
  p_limit integer default 20,
  p_offset integer default 0
)
returns table(
  candidate_handle text,
  city text,
  area text,
  category text,
  experience_band text,
  vehicle_type text,
  has_own_vehicle boolean
)
language plpgsql
stable
security definer
set search_path to ''
as $function$
declare
  v_city_clean text := nullif(trim(regexp_replace(coalesce(p_city, ''), '\s+', ' ', 'g')), '');
  v_area_clean text := nullif(trim(regexp_replace(coalesce(p_area, ''), '\s+', ' ', 'g')), '');
begin
  if auth.uid() is null or not exists (
    select 1
    from public.employer_memberships m
    join public.employers e on e.id = m.employer_id
    join public.user_accounts u on u.user_id = m.user_id
    where m.user_id = auth.uid()
      and m.state = 'active'
      and e.verification_state = 'verified'
      and u.account_state = 'active'
  ) then
    raise exception 'Active verified employer membership required' using errcode = '42501';
  end if;

  if p_limit not between 1 and 50 or p_offset < 0 then
    raise exception 'Invalid pagination';
  end if;

  if lower(coalesce(v_city_clean, '')) in ('all', 'all regions') then
    v_city_clean := null;
  end if;
  if lower(coalesce(v_area_clean, '')) in ('all', 'all localities') then
    v_area_clean := null;
  end if;

  return query
  select
    encode(extensions.digest(w.id::text, 'sha256'), 'hex') as candidate_handle,
    coalesce(nullif(trim(w.city), ''), 'India') as city,
    public.safe_worker_locality(w.city, w.locality, w.address_line) as area,
    w.category,
    w.experience_band,
    w.vehicle_type,
    w.has_own_vehicle
  from public.workers w
  join public.user_accounts u on u.user_id = w.user_id
  where w.discoverable = true
    and w.account_state = 'active'
    and u.account_state = 'active'
    and (
      v_city_clean is null
      or lower(coalesce(w.city, '')) = lower(left(v_city_clean, 100))
      or lower(coalesce(w.city, '')) like '%' || lower(left(v_city_clean, 100)) || '%'
      or lower(public.safe_worker_locality(w.city, w.locality, w.address_line)) like '%' || lower(left(v_city_clean, 100)) || '%'
    )
    and (
      v_area_clean is null
      or lower(public.safe_worker_locality(w.city, w.locality, w.address_line)) like '%' || lower(left(v_area_clean, 100)) || '%'
      or lower(coalesce(w.city, '')) = lower(left(v_area_clean, 100))
    )
    and (p_category is null or p_category = '' or w.category = p_category or w.category is null)
    and (p_experience is null or p_experience = '' or w.experience_band = p_experience)
  order by w.updated_at desc nulls last, w.created_at desc
  limit p_limit offset p_offset;
end;
$function$;

-- Drop redundant legacy 5-arg overloads so PostgREST resolves discover_workers / discover_candidates unambiguously
drop function if exists public.discover_workers(text, text, text, integer, integer);
drop function if exists public.discover_candidates(text, text, text, integer, integer);

create or replace function public.discover_candidates(
  p_city text default null::text,
  p_area text default null::text,
  p_category text default null::text,
  p_experience text default null::text,
  p_limit integer default 20,
  p_offset integer default 0
)
returns table(
  candidate_handle text,
  city text,
  area text,
  category text,
  experience_band text,
  vehicle_type text,
  has_own_vehicle boolean
)
language plpgsql
stable
security definer
set search_path to ''
as $function$
begin
  return query
  select d.candidate_handle, d.city, d.area, d.category, d.experience_band, d.vehicle_type, d.has_own_vehicle
  from public.discover_workers(p_city, p_area, p_category, p_experience, p_limit, p_offset) d;
end;
$function$;

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
  v_normalized_handle text;
begin
  if v_uid is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  v_normalized_handle := lower(trim(coalesce(p_candidate_handle, '')));
  if v_normalized_handle !~ '^[0-9a-f]{64}$' then
    raise exception 'Invalid cryptographic candidate handle';
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

  -- Resolve discoverable active worker exclusively by collision-resistant SHA-256 handle
  select w.id, w.user_id
  into v_worker_id, v_worker_user_id
  from public.workers w
  join public.user_accounts u on u.user_id = w.user_id
  where encode(extensions.digest(w.id::text, 'sha256'), 'hex') = v_normalized_handle
    and w.discoverable = true
    and w.account_state = 'active'
    and u.account_state = 'active'
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
    v_employer_id, v_worker_id, v_normalized_handle, p_job_id, nullif(left(trim(p_message), 500), ''), 'pending'
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
    encode(extensions.digest(v_app.worker_id::text, 'sha256'), 'hex'),
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
    public.safe_worker_locality(w.city, w.locality, w.address_line) as worker_area,
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

revoke all on function public.sanitize_locality(text, text) from public, anon;
grant execute on function public.sanitize_locality(text, text) to authenticated, service_role;

revoke all on function public.safe_worker_locality(text, text, text) from public, anon;
grant execute on function public.safe_worker_locality(text, text, text) to authenticated, service_role;

revoke all on function public.save_worker_profile(text, text, text, text, text, boolean, boolean, text) from public, anon;
grant execute on function public.save_worker_profile(text, text, text, text, text, boolean, boolean, text) to authenticated, service_role;

revoke all on function public.discover_workers(text, text, text, text, integer, integer) from public, anon;
grant execute on function public.discover_workers(text, text, text, text, integer, integer) to authenticated, service_role;

revoke all on function public.discover_candidates(text, text, text, text, integer, integer) from public, anon;
grant execute on function public.discover_candidates(text, text, text, text, integer, integer) to authenticated, service_role;
