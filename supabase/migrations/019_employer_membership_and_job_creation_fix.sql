-- 019_employer_membership_and_job_creation_fix.sql
-- Enables robust employer identity resolution, idempotent onboarding, membership repair, and draft job creation.

-- 1. Link owner's real Google account to the staging organization as owner
do $$
declare
  v_owner_uid uuid := '5733aa5f-ee59-4ed1-bc9d-9b6deb6b07b3';
  v_staging_org_id uuid := '6e7c9a06-b7ba-4a76-bb3c-25e9b410639f';
begin
  -- Ensure user_accounts row exists and is active
  insert into public.user_accounts (user_id, account_state)
  values (v_owner_uid, 'active')
  on conflict (user_id) do update set account_state = 'active';

  -- Update created_by on staging organization if it was previously set to test fixture
  update public.employers
  set created_by = v_owner_uid
  where id = v_staging_org_id;

  -- Ensure active owner membership
  insert into public.employer_memberships (employer_id, user_id, role, state)
  values (v_staging_org_id, v_owner_uid, 'owner', 'active')
  on conflict (employer_id, user_id) do update set role = 'owner', state = 'active';
end $$;

-- 2. Server-side authorized employer organization resolver
create or replace function public.get_current_employer_org()
returns table (
  id uuid,
  legal_name text,
  employer_type public.employer_type,
  verification_state text,
  role public.membership_role
)
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    return;
  end if;

  -- A. Try active employer membership first
  return query
  select e.id, e.legal_name, e.employer_type, e.verification_state, m.role
  from public.employer_memberships m
  join public.employers e on e.id = m.employer_id
  join public.user_accounts u on u.user_id = m.user_id
  where m.user_id = v_uid and m.state = 'active' and u.account_state = 'active'
  order by m.created_at asc
  limit 1;

  if found then
    return;
  end if;

  -- B. Self-healing fallback: If user created an employer but membership row was missed, auto-repair
  return query
  with repaired as (
    insert into public.employer_memberships (employer_id, user_id, role, state)
    select e.id, v_uid, 'owner'::public.membership_role, 'active'::public.membership_state
    from public.employers e
    where e.created_by = v_uid
    order by e.created_at desc
    limit 1
    on conflict (employer_id, user_id) do update set role = 'owner', state = 'active'
    returning employer_id, role
  )
  select e.id, e.legal_name, e.employer_type, e.verification_state, r.role
  from repaired r
  join public.employers e on e.id = r.employer_id
  limit 1;
end $$;

revoke all on function public.get_current_employer_org() from public, anon, authenticated;
grant execute on function public.get_current_employer_org() to authenticated;

-- 3. Idempotent employer organization registration
create or replace function public.register_employer(
  p_legal_name text,
  p_employer_type public.employer_type
) returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_emp_id uuid;
  v_trimmed text;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  v_trimmed := trim(p_legal_name);
  if char_length(v_trimmed) not between 2 and 200 then
    raise exception 'Organization name must be between 2 and 200 characters';
  end if;

  -- Ensure user account is active
  insert into public.user_accounts (user_id, account_state)
  values (auth.uid(), 'active')
  on conflict (user_id) do update set account_state = 'active';

  -- A. If user already has an active employer membership, return that organization ID (idempotency)
  select m.employer_id into v_emp_id
  from public.employer_memberships m
  where m.user_id = auth.uid() and m.state = 'active'
  order by m.created_at asc
  limit 1;

  if v_emp_id is not null then
    return v_emp_id;
  end if;

  -- B. If user already created an employer organization, repair membership and return it
  select e.id into v_emp_id
  from public.employers e
  where e.created_by = auth.uid()
  order by e.created_at desc
  limit 1;

  if v_emp_id is not null then
    insert into public.employer_memberships (employer_id, user_id, role, state)
    values (v_emp_id, auth.uid(), 'owner', 'active')
    on conflict (employer_id, user_id) do update set role = 'owner', state = 'active';
    return v_emp_id;
  end if;

  -- C. Create new organization with pending verification state
  insert into public.employers (legal_name, employer_type, verification_state, created_by)
  values (v_trimmed, p_employer_type, 'pending', auth.uid())
  returning id into v_emp_id;

  -- Register creator as owner
  insert into public.employer_memberships (employer_id, user_id, role, state)
  values (v_emp_id, auth.uid(), 'owner', 'active')
  on conflict (employer_id, user_id) do update set role = 'owner', state = 'active';

  insert into public.audit_log (actor_id, action, entity_type, entity_id, details)
  values (
    auth.uid(),
    'employer_register',
    'employer',
    v_emp_id::text,
    jsonb_build_object('legal_name', v_trimmed, 'type', p_employer_type)
  );

  return v_emp_id;
end $$;

revoke all on function public.register_employer(text, public.employer_type) from public, anon, authenticated;
grant execute on function public.register_employer(text, public.employer_type) to authenticated;

-- 4. Update is_active_employer_member so active members can read and manage drafts
create or replace function public.is_active_employer_member(p_employer_id uuid) returns boolean
language sql stable security definer set search_path = ''
as $$ select exists (
  select 1 from public.employer_memberships m
  join public.employers e on e.id = m.employer_id
  join public.user_accounts u on u.user_id = m.user_id
  where m.employer_id = p_employer_id and m.user_id = auth.uid()
    and m.state = 'active' and u.account_state = 'active'
) $$;

-- 5. RLS policies on employers
drop policy if exists employer_member_read on public.employers;
create policy employer_member_read on public.employers
  for select to authenticated
  using (
    public.is_active_employer_member(id)
    or created_by = auth.uid()
    or public.is_admin()
  );

-- 6. RLS policies on employer_memberships
drop policy if exists membership_self_read on public.employer_memberships;
create policy membership_self_read on public.employer_memberships
  for select to authenticated
  using (
    user_id = auth.uid()
    or public.is_active_employer_member(employer_id)
    or public.is_admin()
  );

-- 7. RLS policies on jobs
drop policy if exists jobs_org_draft_insert on public.jobs;
create policy jobs_org_draft_insert on public.jobs
  for insert to authenticated
  with check (
    state = 'draft'::public.job_state
    and created_by = auth.uid()
    and public.is_active_employer_member(employer_id)
    and exists (
      select 1 from public.employer_memberships m
      where m.employer_id = jobs.employer_id
        and m.user_id = auth.uid()
        and m.role in ('owner', 'manager')
        and m.state = 'active'
    )
  );

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

drop policy if exists jobs_live_or_org_read on public.jobs;
create policy jobs_live_or_org_read on public.jobs
  for select to authenticated
  using (
    (state = 'published'::public.job_state and (expires_at is null or expires_at > now()) and public.is_verified_employer(employer_id))
    or public.is_active_employer_member(employer_id)
    or public.is_admin()
  );

-- 8. Table-level DML privileges for authenticated role (strictly controlled by RLS policies above)
grant insert, update on public.jobs to authenticated;

