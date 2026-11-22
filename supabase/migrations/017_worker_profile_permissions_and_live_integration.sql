-- 017_worker_profile_permissions_and_live_integration.sql
-- Resolves "permission denied for table workers" authorization failure.
-- Grants table-level SELECT, INSERT, UPDATE on public.workers to authenticated role.
-- Strictly enforces Row Level Security (RLS) so workers can ONLY access/mutate their own profile (user_id = auth.uid()).
-- Provides atomic save_worker_profile RPC for secure, transactional onboarding and profile updates.

-- 1. Table-level grants for authenticated users
grant select, insert, update on public.workers to authenticated;
grant select, insert, update, delete on public.worker_preferences to authenticated;
grant select, insert, update, delete on public.worker_skills to authenticated;
grant select, insert, delete on public.saved_jobs to authenticated;

-- 2. Harden Row Level Security on public.workers
alter table public.workers enable row level security;

drop policy if exists worker_owner_all on public.workers;
drop policy if exists worker_owner_select on public.workers;
drop policy if exists worker_owner_insert on public.workers;
drop policy if exists worker_owner_update on public.workers;

-- Workers can read only their own profile; admins can read for moderation
create policy worker_owner_select on public.workers for select to authenticated
  using (user_id = auth.uid() or public.is_admin());

-- Workers can insert only their own profile under their authenticated user_id
create policy worker_owner_insert on public.workers for insert to authenticated
  with check (
    (user_id = auth.uid() and account_state = 'active')
    or public.is_admin()
  );

-- Workers can update only their own profile
create policy worker_owner_update on public.workers for update to authenticated
  using (user_id = auth.uid() or public.is_admin())
  with check (
    (user_id = auth.uid() and account_state = 'active')
    or public.is_admin()
  );

-- 3. Atomic Worker Profile Saving RPC
create or replace function public.save_worker_profile(
  p_full_name text,
  p_city text,
  p_address_line text,
  p_experience_band text,
  p_vehicle_type text,
  p_has_own_vehicle boolean default false,
  p_discoverable boolean default false,
  p_availability text default 'immediate'
) returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_worker_id uuid;
  v_exp text;
  v_veh text;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if p_full_name is null or char_length(trim(p_full_name)) < 2 then
    raise exception 'Full name must be at least 2 characters';
  end if;

  -- Validate/normalize experience band conforming to check constraint
  if p_experience_band in ('fresher', '1-3', '3-5', '5+') then
    v_exp := p_experience_band;
  else
    v_exp := 'fresher';
  end if;

  -- Validate/normalize vehicle type conforming to check constraint
  if p_vehicle_type in ('motorcycle', 'scooter', 'ev', 'bicycle', 'walking', 'none') then
    v_veh := p_vehicle_type;
  else
    v_veh := 'none';
  end if;

  insert into public.workers (
    user_id,
    full_name,
    city,
    address_line,
    experience_band,
    vehicle_type,
    has_own_vehicle,
    discoverable,
    availability,
    account_state,
    updated_at
  ) values (
    auth.uid(),
    trim(p_full_name),
    trim(p_city),
    trim(p_address_line),
    v_exp,
    v_veh,
    coalesce(p_has_own_vehicle, false),
    coalesce(p_discoverable, false),
    coalesce(p_availability, 'immediate'),
    'active',
    now()
  )
  on conflict (user_id) do update set
    full_name = excluded.full_name,
    city = excluded.city,
    address_line = excluded.address_line,
    experience_band = excluded.experience_band,
    vehicle_type = excluded.vehicle_type,
    has_own_vehicle = excluded.has_own_vehicle,
    discoverable = excluded.discoverable,
    availability = excluded.availability,
    account_state = 'active',
    updated_at = now()
  returning id into v_worker_id;

  -- Automatically initialize/update worker_preferences
  insert into public.worker_preferences (worker_id, preferred_city, consent_discovery_at)
  values (
    v_worker_id,
    trim(p_city),
    case when coalesce(p_discoverable, false) then now() else null end
  )
  on conflict (worker_id) do update set
    preferred_city = excluded.preferred_city,
    consent_discovery_at = case
      when coalesce(p_discoverable, false) and worker_preferences.consent_discovery_at is null then now()
      when not coalesce(p_discoverable, false) then null
      else worker_preferences.consent_discovery_at
    end,
    updated_at = now();

  return v_worker_id;
end $$;

revoke all on function public.save_worker_profile(text, text, text, text, text, boolean, boolean, text) from public, anon;
grant execute on function public.save_worker_profile(text, text, text, text, text, boolean, boolean, text) to authenticated;
