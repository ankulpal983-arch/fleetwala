-- FleetWala Clean-Room Production Schema Initialization (Portable Baseline)
-- Version: 001 (Equivalent to hardened staging migrations 001..027 minus staging data,
--                hardcoded UUIDs/emails, test pre-checks, and staging waivers)
-- Target: Fresh Production Supabase PostgreSQL Database (zero existing FleetWala schema)
-- Safety: Strictly non-staging. Seeds ZERO users, ZERO admins, ZERO organizations,
--         ZERO test jobs, and ZERO PII. Billing remains disabled (enabled = false).

begin;

-- ---------------------------------------------------------------------------
-- 1. Extensions & Domain Enums
-- ---------------------------------------------------------------------------
create extension if not exists pgcrypto with schema extensions;

do $$ begin
  create type public.account_state as enum ('active', 'suspended', 'deleted');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.employer_type as enum ('company', 'vendor_dsp', 'recruitment_agency');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.membership_role as enum ('owner', 'manager', 'recruiter');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.membership_state as enum ('invited', 'active', 'suspended', 'removed');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.job_state as enum ('draft', 'pending_review', 'published', 'rejected', 'paused', 'closed');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.application_state as enum ('applied', 'reviewing', 'shortlisted', 'rejected', 'hired', 'withdrawn');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.document_kind as enum ('driving_licence', 'identity_document', 'other');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.payment_state as enum ('created', 'pending', 'succeeded', 'failed', 'refunded');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.ticket_state as enum ('open', 'in_progress', 'resolved', 'closed');
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------------
-- 2. Tables (28 Public Tables + Private Storage Bucket)
-- ---------------------------------------------------------------------------

create table public.user_accounts (
  user_id uuid primary key references auth.users(id) on delete restrict,
  account_state public.account_state not null default 'active',
  display_label text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint user_accounts_label_length check (display_label is null or char_length(display_label) between 1 and 100)
);

create table public.employers (
  id uuid primary key default gen_random_uuid(),
  legal_name text not null,
  employer_type public.employer_type not null,
  verification_state text not null default 'pending' check (verification_state in ('pending','verified','rejected','suspended')),
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint employers_name_length check (char_length(legal_name) between 2 and 200)
);

create table public.employer_memberships (
  id uuid primary key default gen_random_uuid(),
  employer_id uuid not null references public.employers(id) on delete restrict,
  user_id uuid not null references auth.users(id) on delete restrict,
  role public.membership_role not null,
  state public.membership_state not null default 'invited',
  created_at timestamptz not null default now(),
  unique (employer_id, user_id)
);

create table public.admin_principals (
  user_id uuid primary key references auth.users(id) on delete restrict,
  provisioned_by text not null,
  provisioned_at timestamptz not null default now(),
  reason text not null
);

create table public.workers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete restrict,
  full_name text,
  phone_e164 text,
  email text,
  photo_path text,
  address_line text,
  locality text,
  city text,
  postal_code text,
  category text,
  experience_band text check (experience_band is null or experience_band in ('fresher','1-3','3-5','5+')),
  vehicle_type text check (vehicle_type is null or vehicle_type in ('motorcycle','scooter','ev','bicycle','walking','none')),
  has_own_vehicle boolean not null default false,
  fuel_support_required boolean not null default false,
  discoverable boolean not null default false,
  availability text,
  account_state public.account_state not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.worker_preferences (
  worker_id uuid primary key references public.workers(id) on delete cascade,
  preferred_radius_km integer not null default 15 check (preferred_radius_km between 1 and 100),
  preferred_city text,
  preferred_categories text[] not null default '{}',
  preferred_shifts text[] not null default '{}',
  consent_discovery_at timestamptz,
  updated_at timestamptz not null default now()
);

create table public.worker_skills (
  id uuid primary key default gen_random_uuid(),
  worker_id uuid not null references public.workers(id) on delete cascade,
  skill text not null check (char_length(skill) between 1 and 80),
  created_at timestamptz not null default now(),
  unique (worker_id, skill)
);

create table public.jobs (
  id uuid primary key default gen_random_uuid(),
  employer_id uuid not null references public.employers(id) on delete restrict,
  created_by uuid not null references auth.users(id) on delete restrict,
  title text not null,
  category text not null,
  description text not null,
  city text not null,
  area text,
  postal_code text,
  work_address text,
  salary_min_inr integer,
  salary_max_inr integer,
  requires_driving_licence boolean not null default false,
  state public.job_state not null default 'draft',
  review_note text,
  reviewed_by uuid references auth.users(id),
  reviewed_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint jobs_title_length check (char_length(title) between 3 and 150),
  constraint jobs_description_length check (char_length(description) between 10 and 10000),
  constraint jobs_salary_range check (salary_min_inr is null or salary_max_inr is null or salary_min_inr <= salary_max_inr)
);

create table public.job_status_history (
  id bigint generated always as identity primary key,
  job_id uuid not null references public.jobs(id) on delete restrict,
  old_state public.job_state,
  new_state public.job_state not null,
  changed_by uuid references auth.users(id),
  reason text,
  changed_at timestamptz not null default now()
);

create table public.employer_verification_reviews (
  id bigint generated always as identity primary key,
  employer_id uuid not null references public.employers(id) on delete restrict,
  reviewed_by uuid not null references auth.users(id),
  decision text not null check (decision in ('verified','rejected','suspended')),
  reason text not null,
  created_at timestamptz not null default now()
);

create table public.job_applications (
  id uuid primary key default gen_random_uuid(),
  worker_id uuid not null references public.workers(id) on delete restrict,
  job_id uuid not null references public.jobs(id) on delete restrict,
  status public.application_state not null default 'applied',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (worker_id, job_id)
);

create table public.application_status_history (
  id bigint generated always as identity primary key,
  application_id uuid not null references public.job_applications(id) on delete restrict,
  old_status public.application_state,
  new_status public.application_state not null,
  changed_by uuid not null references auth.users(id),
  reason text,
  changed_at timestamptz not null default now()
);

create table public.saved_jobs (
  worker_id uuid not null references public.workers(id) on delete cascade,
  job_id uuid not null references public.jobs(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (worker_id, job_id)
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null,
  payload jsonb not null default '{}',
  read_at timestamptz,
  created_at timestamptz not null default now(),
  constraint notification_payload_object check (jsonb_typeof(payload) = 'object')
);

create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null unique references public.job_applications(id) on delete restrict,
  created_at timestamptz not null default now()
);

create table public.conversation_participants (
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete restrict,
  joined_at timestamptz not null default now(),
  primary key (conversation_id, user_id)
);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete restrict,
  sender_id uuid not null references auth.users(id) on delete restrict,
  body text not null check (char_length(body) between 1 and 4000),
  created_at timestamptz not null default now()
);

create table public.candidate_invitations (
  id uuid primary key default gen_random_uuid(),
  employer_id uuid not null references public.employers(id) on delete restrict,
  worker_id uuid not null references public.workers(id) on delete restrict,
  job_id uuid references public.jobs(id) on delete set null,
  application_id uuid references public.job_applications(id) on delete set null,
  candidate_handle text not null check (candidate_handle ~ '^[0-9a-f]{64}$'),
  message text,
  status text not null default 'pending' check (status in ('pending','accepted','declined','expired')),
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  expires_at timestamptz not null default (now() + interval '14 days')
);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('worker-private-documents', 'worker-private-documents', false, 10485760,
        array['application/pdf','image/jpeg','image/png'])
on conflict (id) do nothing;

create table public.worker_documents (
  id uuid primary key default gen_random_uuid(),
  worker_id uuid not null references public.workers(id) on delete restrict,
  storage_path text not null unique,
  document_kind public.document_kind not null,
  original_filename text not null check (char_length(original_filename) between 1 and 200),
  mime_type text not null check (mime_type in ('application/pdf','image/jpeg','image/png')),
  byte_size bigint not null check (byte_size between 1 and 10485760),
  created_at timestamptz not null default now()
);

create table public.billing_settings (
  singleton boolean primary key default true check (singleton),
  enabled boolean not null default false,
  job_posting_price_inr integer not null default 99 check (job_posting_price_inr > 0),
  candidate_unlock_price_inr integer not null default 10 check (candidate_unlock_price_inr > 0),
  updated_at timestamptz not null default now()
);
insert into public.billing_settings(singleton) values (true) on conflict (singleton) do nothing;

create table public.payment_orders (
  id uuid primary key default gen_random_uuid(),
  employer_id uuid not null references public.employers(id) on delete restrict,
  purpose text not null check (purpose in ('job_posting','contact_unlock')),
  amount_inr integer not null check (amount_inr > 0),
  state public.payment_state not null default 'created',
  provider_reference text unique,
  created_at timestamptz not null default now()
);

create table public.payment_events (
  id uuid primary key default gen_random_uuid(),
  provider_event_id text not null unique,
  order_id uuid references public.payment_orders(id) on delete restrict,
  verified boolean not null default false,
  event_payload jsonb not null default '{}',
  received_at timestamptz not null default now()
);

create table public.job_entitlements (
  id uuid primary key default gen_random_uuid(),
  employer_id uuid not null references public.employers(id) on delete restrict,
  job_id uuid not null unique references public.jobs(id) on delete restrict,
  payment_order_id uuid unique references public.payment_orders(id) on delete restrict,
  granted_at timestamptz not null default now()
);

create table public.contact_unlocks (
  id uuid primary key default gen_random_uuid(),
  employer_id uuid not null references public.employers(id) on delete restrict,
  worker_id uuid not null references public.workers(id) on delete restrict,
  payment_order_id uuid unique references public.payment_orders(id) on delete restrict,
  granted_at timestamptz not null default now(),
  unique (employer_id, worker_id)
);

create table public.payment_disputes (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.payment_orders(id) on delete restrict,
  raised_by uuid not null references auth.users(id),
  status public.ticket_state not null default 'open',
  details text not null,
  created_at timestamptz not null default now()
);

create table public.audit_log (
  id bigint generated always as identity primary key,
  actor_id uuid references auth.users(id),
  action text not null,
  entity_type text not null,
  entity_id text,
  details jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create table public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  opened_by uuid not null references auth.users(id) on delete restrict,
  employer_id uuid references public.employers(id) on delete restrict,
  subject text not null check (char_length(subject) between 3 and 200),
  details text not null check (char_length(details) between 5 and 10000),
  status public.ticket_state not null default 'open',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.user_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references auth.users(id) on delete restrict,
  reported_user_id uuid references auth.users(id) on delete restrict,
  job_id uuid references public.jobs(id) on delete restrict,
  details text not null check (char_length(details) between 5 and 5000),
  status public.ticket_state not null default 'open',
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 3. Indexes
-- ---------------------------------------------------------------------------
create index jobs_live_idx on public.jobs(state, expires_at, city) where state = 'published';
create index jobs_employer_idx on public.jobs(employer_id, created_at desc);
create index applications_worker_day_idx on public.job_applications(worker_id, created_at);
create index applications_job_idx on public.job_applications(job_id, created_at desc);
create index notifications_user_idx on public.notifications(user_id, created_at desc);
create index messages_conversation_idx on public.messages(conversation_id, created_at);
create index audit_log_created_idx on public.audit_log(created_at desc);
create index workers_discovery_idx on public.workers(city, category, experience_band) where discoverable and account_state = 'active';
create index idx_candidate_invitations_app on public.candidate_invitations(application_id);
create index idx_candidate_invitations_employer on public.candidate_invitations(employer_id, status);
create index idx_candidate_invitations_job on public.candidate_invitations(job_id);
create index idx_candidate_invitations_worker on public.candidate_invitations(worker_id, status);
create unique index idx_active_invitation_per_app on public.candidate_invitations(application_id) where status in ('pending', 'accepted');

-- ---------------------------------------------------------------------------
-- 4. Triggers & Helper Functions (Strictly SET search_path = '')
-- ---------------------------------------------------------------------------
create or replace function public.touch_updated_at() returns trigger
language plpgsql set search_path = ''
as $$ begin new.updated_at := now(); return new; end $$;

create trigger workers_touch before update on public.workers for each row execute function public.touch_updated_at();
create trigger jobs_touch before update on public.jobs for each row execute function public.touch_updated_at();
create trigger accounts_touch before update on public.user_accounts for each row execute function public.touch_updated_at();

create or replace function public.on_auth_user_created() returns trigger
language plpgsql security definer set search_path = ''
as $$ begin
  insert into public.user_accounts(user_id) values(new.id) on conflict (user_id) do nothing;
  return new;
end $$;

drop trigger if exists fleetwala_auth_user_created on auth.users;
create trigger fleetwala_auth_user_created after insert on auth.users
for each row execute function public.on_auth_user_created();

create function public.current_worker_id() returns uuid
language sql stable security definer set search_path = ''
as $$ select w.id from public.workers w where w.user_id = auth.uid() and w.account_state = 'active' $$;

create function public.is_admin() returns boolean
language sql stable security definer set search_path = ''
as $$ select exists (
  select 1 from public.admin_principals a
  join public.user_accounts u on u.user_id = a.user_id
  where a.user_id = auth.uid() and u.account_state = 'active'
) $$;

create function public.is_active_employer_member(p_employer_id uuid) returns boolean
language sql stable security definer set search_path = ''
as $$ select exists (
  select 1 from public.employer_memberships m
  join public.employers e on e.id = m.employer_id
  join public.user_accounts u on u.user_id = m.user_id
  where m.employer_id = p_employer_id
    and m.user_id = auth.uid()
    and m.state = 'active'
    and u.account_state = 'active'
) $$;

create function public.is_verified_employer(p_employer_id uuid) returns boolean
language sql stable security definer set search_path = ''
as $$ select exists (
  select 1 from public.employers e
  where e.id = p_employer_id and e.verification_state = 'verified'
) $$;

create function public.sanitize_locality(
  p_raw text,
  p_city text default null::text
) returns text
language sql immutable set search_path = ''
as $$
  select case
    when p_raw is null then null
    when char_length(trim(regexp_replace(p_raw, '\s+', ' ', 'g'))) = 0 then null
    when char_length(trim(regexp_replace(p_raw, '\s+', ' ', 'g'))) > 50 then null
    when p_raw ~ '[@#/]' then null
    when p_raw ~ '[0-9]{4,}' then null
    when p_raw ~* '\m(house|h\.?no|flat|apt|apartment|plot|gali|lane|street|st\.?|khasra|floor|wing|tower|bldg|building|room|opp|opposite|near|behind|front|chowk|pin)\M' then null
    else trim(regexp_replace(p_raw, '\s+', ' ', 'g'))
  end;
$$;

create function public.safe_worker_locality(
  p_city text,
  p_locality text,
  p_address_line text default null::text
) returns text
language sql immutable set search_path = ''
as $$
  select coalesce(
    public.sanitize_locality(p_locality, p_city),
    public.sanitize_locality(p_address_line, p_city),
    nullif(trim(p_city), ''),
    'Local'
  );
$$;

-- ---------------------------------------------------------------------------
-- 5. Organization, Worker, Public Job & Admin RPCs
-- ---------------------------------------------------------------------------

create function public.get_current_employer_org()
returns table(id uuid, legal_name text, employer_type public.employer_type, verification_state text, role public.membership_role)
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    return;
  end if;

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

create function public.register_employer(
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
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  v_trimmed := trim(p_legal_name);
  if char_length(v_trimmed) not between 2 and 200 then
    raise exception 'Organization name must be between 2 and 200 characters';
  end if;

  insert into public.user_accounts (user_id, account_state)
  values (auth.uid(), 'active')
  on conflict (user_id) do update set account_state = 'active';

  select m.employer_id into v_emp_id
  from public.employer_memberships m
  where m.user_id = auth.uid() and m.state = 'active'
  order by m.created_at asc
  limit 1;

  if v_emp_id is not null then
    return v_emp_id;
  end if;

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

  insert into public.employers (legal_name, employer_type, verification_state, created_by)
  values (v_trimmed, p_employer_type, 'pending', auth.uid())
  returning id into v_emp_id;

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

create function public.save_worker_profile(
  p_full_name text,
  p_city text,
  p_address_line text,
  p_experience_band text,
  p_vehicle_type text,
  p_has_own_vehicle boolean default false,
  p_discoverable boolean default false,
  p_availability text default 'immediate'::text
) returns uuid
language plpgsql security definer set search_path = ''
as $$
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
$$;

create function public.set_worker_discoverability(p_discoverable boolean)
returns boolean
language plpgsql security definer set search_path = ''
as $$
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
$$;

create function public.get_public_published_jobs()
returns table(
  id uuid, employer_id uuid, title text, company text, city text, area text,
  category text, description text, salary_min_inr integer, salary_max_inr integer,
  requires_driving_licence boolean, expires_at timestamptz, created_at timestamptz
)
language plpgsql stable security definer set search_path = ''
as $$
begin
  return query
  select
    j.id, j.employer_id, j.title,
    coalesce(e.legal_name, 'Verified Logistics Partner')::text as company,
    j.city,
    coalesce(j.area, 'Central')::text as area,
    j.category, j.description,
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

create function public.discover_workers(
  p_city text default null::text,
  p_area text default null::text,
  p_category text default null::text,
  p_experience text default null::text,
  p_limit integer default 20,
  p_offset integer default 0
)
returns table(
  candidate_handle text, city text, area text, category text,
  experience_band text, vehicle_type text, has_own_vehicle boolean
)
language plpgsql stable security definer set search_path = ''
as $$
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
    w.category, w.experience_band, w.vehicle_type, w.has_own_vehicle
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
$$;

create function public.discover_candidates(
  p_city text default null::text,
  p_area text default null::text,
  p_category text default null::text,
  p_experience text default null::text,
  p_limit integer default 20,
  p_offset integer default 0
)
returns table(
  candidate_handle text, city text, area text, category text,
  experience_band text, vehicle_type text, has_own_vehicle boolean
)
language plpgsql stable security definer set search_path = ''
as $$
begin
  return query
  select d.candidate_handle, d.city, d.area, d.category, d.experience_band, d.vehicle_type, d.has_own_vehicle
  from public.discover_workers(p_city, p_area, p_category, p_experience, p_limit, p_offset) d;
end;
$$;

create function public.submit_job(p_job_id uuid) returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_job public.jobs%rowtype;
  v_membership public.employer_memberships%rowtype;
  v_user public.user_accounts%rowtype;
begin
  if v_uid is null then
    raise exception 'Authentication required to submit a job draft' using errcode = '42501';
  end if;
  if p_job_id is null then
    raise exception 'Job ID is required';
  end if;

  select * into v_job from public.jobs where id = p_job_id for update;
  if not found then
    raise exception 'Job draft not found';
  end if;

  if v_job.state = 'pending_review' then
    return;
  end if;

  if v_job.state != 'draft' then
    raise exception 'Only draft listings can be submitted for review. Current status: %', v_job.state;
  end if;

  select * into v_membership
  from public.employer_memberships
  where employer_id = v_job.employer_id and user_id = v_uid and state = 'active'
  limit 1;

  if not found then
    raise exception 'Not authorized: active employer membership required' using errcode = '42501';
  end if;
  if v_membership.role not in ('owner', 'manager') then
    raise exception 'Insufficient permissions: owner or manager role required' using errcode = '42501';
  end if;

  select * into v_user from public.user_accounts where user_id = v_uid;
  if not found then
    insert into public.user_accounts (user_id, account_state) values (v_uid, 'active') returning * into v_user;
  elsif v_user.account_state != 'active' then
    raise exception 'User account is currently %', v_user.account_state using errcode = '42501';
  end if;

  update public.jobs set state = 'pending_review', updated_at = now() where id = p_job_id;
  insert into public.job_status_history (job_id, old_state, new_state, changed_by, reason)
  values (p_job_id, 'draft', 'pending_review', v_uid, 'Submitted for review by employer');
  insert into public.audit_log (actor_id, action, entity_type, entity_id, details)
  values (v_uid, 'job_submit', 'job', p_job_id::text, jsonb_build_object('previous_state', 'draft', 'new_state', 'pending_review', 'employer_id', v_job.employer_id));
end $$;

create function public.admin_review_employer(
  p_employer_id uuid, p_decision text, p_reason text
) returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_old_state text;
  v_member_user uuid;
begin
  if not public.is_admin() then
    raise exception 'Administrator access required' using errcode = '42501';
  end if;
  if p_decision not in ('verified', 'rejected', 'suspended') then
    raise exception 'Invalid decision state';
  end if;

  select verification_state into v_old_state from public.employers where id = p_employer_id for update;
  if not found then raise exception 'Employer organization not found'; end if;

  update public.employers set verification_state = p_decision where id = p_employer_id;
  insert into public.employer_verification_reviews (employer_id, reviewed_by, decision, reason)
  values (p_employer_id, auth.uid(), p_decision, left(p_reason, 1000));
  insert into public.audit_log (actor_id, action, entity_type, entity_id, details)
  values (auth.uid(), 'employer_verification', 'employer', p_employer_id::text,
    jsonb_build_object('old_state', v_old_state, 'new_state', p_decision, 'reason', left(p_reason, 500)));

  for v_member_user in
    select user_id from public.employer_memberships where employer_id = p_employer_id and state = 'active'
  loop
    insert into public.notifications (user_id, kind, payload)
    values (v_member_user, 'employer_verification_update',
      jsonb_build_object('employer_id', p_employer_id, 'decision', p_decision, 'reason', left(p_reason, 500)));
  end loop;
end;
$$;

create function public.review_job(
  p_job_id uuid, p_approve boolean, p_reason text
) returns void
language plpgsql security definer set search_path = ''
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

  select state, created_by, title, employer_id into v_old, v_creator, v_title, v_emp_id
  from public.jobs where id = p_job_id for update;

  if v_old is distinct from 'pending_review' then
    raise exception 'Job is not pending review';
  end if;

  if p_approve then
    select (verification_state = 'verified') into v_emp_verified from public.employers where id = v_emp_id;
    if not coalesce(v_emp_verified, false) then
      raise exception 'Employer organization must be verified before approving job publication.';
    end if;
  end if;

  v_new := case when p_approve then 'published'::public.job_state else 'rejected'::public.job_state end;

  update public.jobs
  set state = v_new, reviewed_by = auth.uid(), reviewed_at = now(), review_note = p_reason
  where id = p_job_id;

  insert into public.job_status_history (job_id, old_state, new_state, changed_by, reason)
  values (p_job_id, v_old, v_new, auth.uid(), left(p_reason, 1000));
  insert into public.audit_log (actor_id, action, entity_type, entity_id, details)
  values (auth.uid(), 'job_review', 'job', p_job_id::text, jsonb_build_object('decision', v_new, 'reason', left(p_reason, 500)));

  if v_creator is not null then
    insert into public.notifications (user_id, kind, payload)
    values (v_creator, 'job_moderation_update',
      jsonb_build_object('job_id', p_job_id, 'job_title', v_title, 'state', v_new, 'reason', left(p_reason, 500)));
  end if;
end;
$$;

create function public.admin_set_job_state(
  p_job_id uuid, p_state public.job_state, p_reason text
) returns void
language plpgsql security definer set search_path = ''
as $$
declare v_old public.job_state;
begin
  if not public.is_admin() or p_state not in ('paused','closed','published') then
    raise exception 'Administrator access required or invalid state' using errcode = '42501';
  end if;
  select state into v_old from public.jobs where id = p_job_id for update;
  if not found or not (
    (v_old = 'published' and p_state in ('paused','closed'))
    or (v_old = 'paused' and p_state in ('published','closed'))
  ) then raise exception 'Invalid job state transition'; end if;

  if p_state = 'published' and not public.is_verified_employer((select employer_id from public.jobs where id = p_job_id)) then
    raise exception 'Employer is not verified';
  end if;
  if p_state = 'published' and exists(select 1 from public.jobs where id = p_job_id and expires_at is not null and expires_at <= clock_timestamp()) then
    raise exception 'Expired jobs cannot be reopened';
  end if;

  update public.jobs set state = p_state, review_note = left(p_reason, 1000), reviewed_by = auth.uid(), reviewed_at = clock_timestamp() where id = p_job_id;
  insert into public.job_status_history(job_id, old_state, new_state, changed_by, reason) values (p_job_id, v_old, p_state, auth.uid(), left(p_reason, 1000));
  insert into public.audit_log(actor_id, action, entity_type, entity_id, details)
  values (auth.uid(), 'job_state', 'job', p_job_id::text, jsonb_build_object('old_state', v_old, 'new_state', p_state, 'reason', left(p_reason, 500)));
end $$;

create function public.update_employer_job_state(p_job_id uuid, p_action text)
returns public.job_state
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_job public.jobs%rowtype;
  v_new_state public.job_state;
begin
  if v_uid is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  select * into v_job from public.jobs where id = p_job_id for update;
  if not found then raise exception 'Job not found'; end if;
  if not (public.is_active_employer_member(v_job.employer_id) or public.is_admin()) then
    raise exception 'Not authorized to manage this job' using errcode = '42501';
  end if;

  if p_action = 'pause' then
    if v_job.state != 'published' then raise exception 'Only published jobs can be paused'; end if;
    v_new_state := 'paused';
  elsif p_action = 'resume' then
    if v_job.state != 'paused' then raise exception 'Only paused jobs can be resumed'; end if;
    v_new_state := 'published';
  elsif p_action = 'close' then
    if v_job.state not in ('published', 'paused') then raise exception 'Only published or paused jobs can be closed'; end if;
    v_new_state := 'closed';
  else
    raise exception 'Invalid action';
  end if;

  update public.jobs set state = v_new_state, updated_at = now() where id = p_job_id;
  insert into public.job_status_history (job_id, old_state, new_state, changed_by, reason)
  values (p_job_id, v_job.state, v_new_state, v_uid, 'Employer action: ' || p_action);
  insert into public.audit_log (actor_id, action, entity_type, entity_id, details)
  values (v_uid, 'job_state_changed', 'job', p_job_id::text, jsonb_build_object('old_state', v_job.state, 'new_state', v_new_state, 'action', p_action));
  return v_new_state;
end;
$$;

create function public.admin_set_account_state(
  p_user_id uuid, p_state public.account_state, p_reason text
) returns void
language plpgsql security definer set search_path = ''
as $$ begin
  if not public.is_admin() or p_state not in ('active','suspended') then
    raise exception 'Administrator access required or invalid state' using errcode = '42501';
  end if;
  update public.user_accounts set account_state = p_state where user_id = p_user_id;
  update public.workers set account_state = p_state where user_id = p_user_id;
  insert into public.audit_log(actor_id, action, entity_type, entity_id, details)
  values (auth.uid(), 'account_state', 'user', p_user_id::text, jsonb_build_object('state', p_state, 'reason', left(p_reason, 500)));
end $$;

create function public.admin_assign_admin(p_target_user_id uuid) returns void
language plpgsql security definer set search_path = ''
as $$ begin
  if not public.is_admin() then raise exception 'Administrator access required' using errcode = '42501'; end if;
  if not exists (select 1 from public.user_accounts where user_id = p_target_user_id and account_state = 'active') then
    raise exception 'Target user not found or inactive';
  end if;
  insert into public.admin_principals (user_id, provisioned_by, provisioned_at, reason)
  values (p_target_user_id, auth.uid()::text, now(), 'Assigned by administrator')
  on conflict (user_id) do nothing;
  insert into public.audit_log (actor_id, action, entity_type, entity_id, details)
  values (auth.uid(), 'admin_assign', 'admin_principal', p_target_user_id::text, jsonb_build_object('assigned_by', auth.uid()));
end $$;

create function public.admin_update_support_ticket(
  p_ticket_id uuid, p_status public.ticket_state, p_note text default null::text
) returns void
language plpgsql security definer set search_path = ''
as $$
declare v_ticket public.support_tickets%rowtype;
begin
  if not public.is_admin() then raise exception 'Administrator access required' using errcode = '42501'; end if;
  select * into v_ticket from public.support_tickets where id = p_ticket_id for update;
  if not found then raise exception 'Support ticket not found'; end if;
  update public.support_tickets set status = p_status, updated_at = clock_timestamp() where id = p_ticket_id;
  insert into public.audit_log (actor_id, action, entity_type, entity_id, details)
  values (auth.uid(), 'support_ticket_status', 'support_ticket', p_ticket_id::text,
    jsonb_build_object('old_status', v_ticket.status, 'new_status', p_status, 'note', nullif(left(trim(p_note), 500), '')));
  insert into public.notifications (user_id, kind, payload)
  values (v_ticket.opened_by, 'support_ticket_update',
    jsonb_build_object('ticket_id', p_ticket_id, 'subject', v_ticket.subject, 'status', p_status));
end;
$$;

create function public.mark_notification_read(p_notification_id uuid) returns void
language plpgsql security definer set search_path = ''
as $$ begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  update public.notifications set read_at = coalesce(read_at, clock_timestamp())
  where id = p_notification_id and user_id = auth.uid();
  if not found then raise exception 'Notification not found'; end if;
end $$;

-- ---------------------------------------------------------------------------
-- 6. Applications, Conversations & Invitations RPCs
-- ---------------------------------------------------------------------------

create function public.can_access_conversation(p_conversation_id uuid) returns boolean
language sql stable security definer set search_path = ''
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
        or exists (select 1 from public.candidate_invitations ci where ci.application_id = a.id and ci.status = 'accepted')
      )
      and (
        exists (select 1 from public.workers w where w.id = a.worker_id and w.user_id = auth.uid() and w.account_state = 'active')
        or public.is_active_employer_member(j.employer_id)
        or public.is_admin()
      )
  )
$$;

create function public.ensure_application_conversation(p_application_id uuid) returns uuid
language plpgsql security definer set search_path = ''
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
  select id into v_id from public.conversations where application_id = p_application_id;
  if v_id is not null then return v_id; end if;

  select a.worker_id, a.job_id, a.status, w.user_id, j.employer_id
  into v_id, v_job_id, v_app_status, v_worker_uid, v_employer_id
  from public.job_applications a
  join public.workers w on w.id = a.worker_id
  join public.jobs j on j.id = a.job_id
  where a.id = p_application_id;

  if v_worker_uid is null then raise exception 'Application not found'; end if;

  select exists(
    select 1 from public.candidate_invitations ci where ci.application_id = p_application_id and ci.status = 'accepted'
  ) into v_has_accepted_invite;

  if v_app_status not in ('shortlisted', 'hired') and not v_has_accepted_invite and not public.is_admin() then
    raise exception 'Conversation requires shortlisted/hired state or an accepted hiring invitation';
  end if;

  if not (v_worker_uid = auth.uid() or public.is_active_employer_member(v_employer_id) or public.is_admin()) then
    raise exception 'Not authorized for this application conversation' using errcode = '42501';
  end if;

  insert into public.conversations (application_id)
  values (p_application_id)
  on conflict (application_id) do update set created_at = public.conversations.created_at
  returning id into v_id;

  insert into public.conversation_participants (conversation_id, user_id) values (v_id, v_worker_uid) on conflict do nothing;

  for v_employer_member in
    select user_id from public.employer_memberships where employer_id = v_employer_id and state = 'active'
  loop
    insert into public.conversation_participants (conversation_id, user_id) values (v_id, v_employer_member) on conflict do nothing;
  end loop;

  return v_id;
end;
$$;

create function public.apply_to_job(p_job_id uuid)
returns table(application_id uuid, was_existing boolean)
language plpgsql security definer set search_path = ''
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
  if auth.uid() is null then raise exception 'Authentication required' using errcode = '42501'; end if;

  select w.id into v_worker_id from public.workers w
  where w.user_id = auth.uid() and w.account_state = 'active' for update;
  if v_worker_id is null then raise exception 'Active worker profile required' using errcode = '42501'; end if;

  select a.* into v_app from public.job_applications a where a.worker_id = v_worker_id and a.job_id = p_job_id;
  if found then return query select v_app.id, true; return; end if;

  select j.id, j.employer_id, j.title into v_eligible_job, v_employer_id, v_job_title
  from public.jobs j join public.employers e on e.id = j.employer_id
  where j.id = p_job_id and j.state = 'published'
    and (j.expires_at is null or j.expires_at > clock_timestamp())
    and e.verification_state = 'verified'
  for share of j, e;

  if v_eligible_job is null then
    raise exception 'Job is not currently eligible for applications (may be paused, closed, or expired)';
  end if;

  v_today := (clock_timestamp() at time zone 'Asia/Kolkata')::date;
  if (select count(*) from public.job_applications a
      where a.worker_id = v_worker_id and (a.created_at at time zone 'Asia/Kolkata')::date = v_today) >= 20 then
    raise exception 'Daily application limit reached for today (IST)';
  end if;

  insert into public.job_applications (job_id, worker_id, status)
  values (p_job_id, v_worker_id, 'applied') returning * into v_app;

  insert into public.application_status_history (application_id, new_status, changed_by)
  values (v_app.id, 'applied', auth.uid());

  insert into public.audit_log (actor_id, action, entity_type, entity_id, details)
  values (auth.uid(), 'application_submitted', 'application', v_app.id::text, jsonb_build_object('job_id', p_job_id, 'worker_id', v_worker_id));

  for v_member_user in
    select m.user_id from public.employer_memberships m where m.employer_id = v_employer_id and m.state = 'active'
  loop
    insert into public.notifications (user_id, kind, payload)
    values (v_member_user, 'new_application', jsonb_build_object('application_id', v_app.id, 'job_id', p_job_id, 'job_title', v_job_title));
  end loop;

  return query select v_app.id, false;
exception when unique_violation then
  select a.* into v_app from public.job_applications a where a.worker_id = v_worker_id and a.job_id = p_job_id;
  if v_app.id is not null then return query select v_app.id, true; else raise; end if;
end;
$$;

create function public.set_application_status(
  p_application_id uuid, p_status public.application_state
) returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_app public.job_applications%rowtype;
  v_allowed boolean;
  v_worker_uid uuid;
  v_job_title text;
  v_company_name text;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  select a.* into v_app from public.job_applications a where a.id = p_application_id for update;
  if not found then raise exception 'Application not found'; end if;
  if v_app.status in ('withdrawn', 'hired', 'rejected') then raise exception 'Terminal application status cannot be altered'; end if;

  if p_status = 'withdrawn' then
    v_allowed := v_app.worker_id = public.current_worker_id();
  else
    v_allowed := v_app.worker_id is distinct from public.current_worker_id()
      and exists (select 1 from public.jobs j where j.id = v_app.job_id and public.is_active_employer_member(j.employer_id))
      and (
        (v_app.status = 'applied' and p_status in ('reviewing', 'shortlisted', 'rejected'))
        or (v_app.status = 'reviewing' and p_status in ('shortlisted', 'rejected'))
        or (v_app.status = 'shortlisted' and p_status in ('hired', 'rejected'))
      );
  end if;

  if not v_allowed and not public.is_admin() then
    raise exception 'Not authorized for this status transition' using errcode = '42501';
  end if;

  update public.job_applications set status = p_status, updated_at = now() where id = p_application_id;
  insert into public.application_status_history (application_id, old_status, new_status, changed_by)
  values (p_application_id, v_app.status, p_status, auth.uid());
  insert into public.audit_log (actor_id, action, entity_type, entity_id, details)
  values (auth.uid(), 'application_status', 'application', p_application_id::text, jsonb_build_object('old_status', v_app.status, 'new_status', p_status));

  if p_status = 'shortlisted' then
    perform public.ensure_application_conversation(p_application_id);
  end if;

  select w.user_id, j.title, e.legal_name into v_worker_uid, v_job_title, v_company_name
  from public.workers w join public.jobs j on j.id = v_app.job_id join public.employers e on e.id = j.employer_id
  where w.id = v_app.worker_id;

  if v_worker_uid is not null then
    insert into public.notifications (user_id, kind, payload)
    values (v_worker_uid, 'application_status_update',
      jsonb_build_object('application_id', p_application_id, 'job_id', v_app.job_id, 'job_title', v_job_title, 'company', v_company_name, 'new_status', p_status));
  end if;
end;
$$;

create function public.send_message(p_conversation_id uuid, p_body text) returns uuid
language plpgsql security definer set search_path = ''
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
  v_member_user uuid;
begin
  if v_uid is null or char_length(trim(p_body)) not between 1 and 4000 then
    raise exception 'Invalid message or unauthenticated' using errcode = '42501';
  end if;
  if not public.can_access_conversation(p_conversation_id) then
    raise exception 'Conversation access denied' using errcode = '42501';
  end if;

  select c.application_id, a.job_id, j.title, j.employer_id, e.legal_name, w.user_id
  into v_app_id, v_job_id, v_job_title, v_employer_id, v_employer_name, v_worker_uid
  from public.conversations c
  join public.job_applications a on a.id = c.application_id
  join public.jobs j on j.id = a.job_id
  join public.employers e on e.id = j.employer_id
  join public.workers w on w.id = a.worker_id
  where c.id = p_conversation_id;

  insert into public.messages (conversation_id, sender_id, body)
  values (p_conversation_id, v_uid, trim(p_body)) returning id into v_msg_id;

  insert into public.conversation_participants (conversation_id, user_id) values (p_conversation_id, v_uid) on conflict do nothing;

  if v_uid = v_worker_uid then
    for v_member_user in select user_id from public.employer_memberships where employer_id = v_employer_id and state = 'active'
    loop
      insert into public.notifications (user_id, kind, payload)
      values (v_member_user, 'new_message',
        jsonb_build_object('conversation_id', p_conversation_id, 'message_id', v_msg_id, 'sender_role', 'candidate', 'job_title', v_job_title, 'preview', left(trim(p_body), 80)));
    end loop;
  else
    insert into public.notifications (user_id, kind, payload)
    values (v_worker_uid, 'new_message',
      jsonb_build_object('conversation_id', p_conversation_id, 'message_id', v_msg_id, 'sender_role', 'employer', 'company', v_employer_name, 'job_title', v_job_title, 'preview', left(trim(p_body), 80)));
  end if;

  return v_msg_id;
end;
$$;

create function public.get_user_conversations()
returns table(
  conversation_id uuid, application_id uuid, job_id uuid, job_title text,
  participant_name text, participant_role text, last_message_text text,
  last_message_at timestamptz, messages_json jsonb
)
language plpgsql security definer set search_path = ''
as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'Authentication required' using errcode = '42501'; end if;

  return query
  select
    c.id as conversation_id, c.application_id, j.id as job_id, j.title as job_title,
    case when w.user_id = v_uid then coalesce(e.legal_name, 'Hiring Team') else coalesce(w.full_name, 'Candidate') end as participant_name,
    case when w.user_id = v_uid then 'Employer' else 'Candidate' end as participant_role,
    lm.body as last_message_text, lm.created_at as last_message_at,
    coalesce(
      (select jsonb_agg(jsonb_build_object('id', m.id, 'from', case when m.sender_id = v_uid then 'me' else 'them' end, 'text', m.body, 'at', m.created_at) order by m.created_at asc)
       from public.messages m where m.conversation_id = c.id),
      '[]'::jsonb
    ) as messages_json
  from public.conversations c
  join public.job_applications a on a.id = c.application_id
  join public.jobs j on j.id = a.job_id
  join public.employers e on e.id = j.employer_id
  join public.workers w on w.id = a.worker_id
  left join lateral (
    select m.body, m.created_at from public.messages m where m.conversation_id = c.id order by m.created_at desc limit 1
  ) lm on true
  where public.can_access_conversation(c.id)
  order by coalesce(lm.created_at, c.created_at) desc;
end;
$$;

create function public.get_employer_applicants(p_employer_id uuid default null)
returns table(
  application_id uuid, job_id uuid, job_title text, company_name text,
  candidate_code text, candidate_handle text, worker_city text, worker_area text,
  experience_band text, vehicle_type text, has_own_vehicle boolean,
  latest_status public.application_state, created_at timestamptz, status_history jsonb
)
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_target_emp_id uuid := p_employer_id;
  v_is_admin boolean := public.is_admin();
begin
  if v_uid is null then raise exception 'Authentication required' using errcode = '42501'; end if;

  if v_target_emp_id is not null then
    if not (public.is_active_employer_member(v_target_emp_id) or v_is_admin) then
      raise exception 'Not authorized for this organization' using errcode = '42501';
    end if;
  elsif not v_is_admin then
    select m.employer_id into v_target_emp_id
    from public.employer_memberships m
    join public.user_accounts u on u.user_id = m.user_id
    where m.user_id = v_uid and m.state = 'active' and u.account_state = 'active'
    order by m.created_at asc limit 1;
    if v_target_emp_id is null then return; end if;
  end if;

  return query
  select
    a.id as application_id, a.job_id, j.title as job_title,
    coalesce(e.legal_name, 'Organization') as company_name,
    'FW-' || upper(substr(encode(extensions.digest(w.id::text, 'sha256'), 'hex'), 1, 6)) as candidate_code,
    encode(extensions.digest(w.id::text, 'sha256'), 'hex') as candidate_handle,
    coalesce(w.city, 'India') as worker_city,
    public.safe_worker_locality(w.city, w.locality, w.address_line) as worker_area,
    coalesce(w.experience_band, 'fresher') as experience_band,
    coalesce(w.vehicle_type, 'none') as vehicle_type,
    coalesce(w.has_own_vehicle, false) as has_own_vehicle,
    a.status as latest_status, a.created_at,
    coalesce(
      (select jsonb_agg(jsonb_build_object('status', h.new_status, 'at', h.changed_at) order by h.changed_at asc)
       from public.application_status_history h where h.application_id = a.id),
      jsonb_build_array(jsonb_build_object('status', a.status, 'at', a.created_at))
    ) as status_history
  from public.job_applications a
  join public.jobs j on j.id = a.job_id
  join public.employers e on e.id = j.employer_id
  join public.workers w on w.id = a.worker_id
  where (v_target_emp_id is null or j.employer_id = v_target_emp_id)
  order by a.created_at desc;
end;
$$;

create function public.get_worker_applications()
returns table(
  application_id uuid, job_id uuid, job_title text, company_name text,
  city text, area text, job_state public.job_state,
  latest_status public.application_state, created_at timestamptz, status_history jsonb
)
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_worker_id uuid := public.current_worker_id();
begin
  if v_uid is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  if v_worker_id is null then return; end if;

  return query
  select
    a.id as application_id, a.job_id, j.title as job_title,
    coalesce(e.legal_name, 'Verified Logistics Partner') as company_name,
    j.city, coalesce(j.area, 'Central') as area,
    j.state as job_state, a.status as latest_status, a.created_at,
    coalesce(
      (select jsonb_agg(jsonb_build_object('status', h.new_status, 'at', h.changed_at) order by h.changed_at asc)
       from public.application_status_history h where h.application_id = a.id),
      jsonb_build_array(jsonb_build_object('status', a.status, 'at', a.created_at))
    ) as status_history
  from public.job_applications a
  join public.jobs j on j.id = a.job_id
  join public.employers e on e.id = j.employer_id
  where a.worker_id = v_worker_id
  order by a.created_at desc;
end;
$$;

create function public.create_candidate_invitation(
  p_candidate_handle text, p_job_id uuid, p_message text default null::text
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
  v_normalized_handle text;
begin
  if v_uid is null then raise exception 'Authentication required' using errcode = '42501'; end if;

  v_normalized_handle := lower(trim(coalesce(p_candidate_handle, '')));
  if v_normalized_handle !~ '^[0-9a-f]{64}$' then
    raise exception 'Invalid cryptographic candidate handle';
  end if;

  select m.employer_id, e.legal_name into v_employer_id, v_employer_name
  from public.employer_memberships m
  join public.employers e on e.id = m.employer_id
  join public.user_accounts u on u.user_id = m.user_id
  where m.user_id = v_uid and m.state = 'active' and e.verification_state = 'verified' and u.account_state = 'active'
  order by m.created_at asc limit 1;

  if v_employer_id is null then
    raise exception 'Active membership in a verified employer organization is required to invite candidates' using errcode = '42501';
  end if;

  if p_job_id is not null then
    select * into v_job from public.jobs where id = p_job_id and employer_id = v_employer_id;
    if not found then raise exception 'Specified job listing does not belong to your organization'; end if;
  end if;

  select w.id, w.user_id into v_worker_id, v_worker_user_id
  from public.workers w
  join public.user_accounts u on u.user_id = w.user_id
  where encode(extensions.digest(w.id::text, 'sha256'), 'hex') = v_normalized_handle
    and w.discoverable = true and w.account_state = 'active' and u.account_state = 'active'
  limit 1;

  if v_worker_id is null then
    raise exception 'Candidate is not available for invitation or has disabled discoverability';
  end if;

  select id into v_invitation_id from public.candidate_invitations
  where employer_id = v_employer_id and worker_id = v_worker_id and status = 'pending' and (job_id is not distinct from p_job_id);
  if v_invitation_id is not null then
    raise exception 'A pending invitation already exists for this candidate';
  end if;

  insert into public.candidate_invitations (employer_id, worker_id, candidate_handle, job_id, message, status)
  values (v_employer_id, v_worker_id, v_normalized_handle, p_job_id, nullif(left(trim(p_message), 500), ''), 'pending')
  returning id into v_invitation_id;

  insert into public.notifications (user_id, kind, payload)
  values (v_worker_user_id, 'candidate_invited',
    jsonb_build_object('invitation_id', v_invitation_id, 'job_id', p_job_id, 'job_title', coalesce(v_job.title, 'General Logistics Opportunity'), 'company', coalesce(v_employer_name, 'Logistics Partner'), 'message', nullif(left(trim(p_message), 500), '')));

  insert into public.audit_log (actor_id, action, entity_type, entity_id, details)
  values (v_uid, 'candidate_invite_sent', 'candidate_invitation', v_invitation_id::text, jsonb_build_object('employer_id', v_employer_id, 'candidate_handle', v_normalized_handle, 'job_id', p_job_id));

  return v_invitation_id;
end;
$$;

create function public.create_application_invitation(
  p_application_id uuid, p_message text default null::text
) returns uuid
language plpgsql security definer set search_path = ''
as $$
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
  if v_uid is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  select * into v_app from public.job_applications where id = p_application_id for update;
  if not found then raise exception 'Application not found'; end if;
  if v_app.status in ('withdrawn', 'rejected', 'hired') then raise exception 'Application is in terminal state'; end if;

  select * into v_job from public.jobs where id = v_app.job_id;
  if not found then raise exception 'Job not found'; end if;
  if not (public.is_active_employer_member(v_job.employer_id) or v_is_admin) then
    raise exception 'Not authorized for this organization' using errcode = '42501';
  end if;

  select legal_name, verification_state into v_employer_name, v_employer_verif from public.employers where id = v_job.employer_id;
  if not v_is_admin and v_employer_verif is distinct from 'verified' then
    raise exception 'Employer organization must be verified before sending invitations' using errcode = '42501';
  end if;

  select * into v_worker from public.workers where id = v_app.worker_id;
  if exists (select 1 from public.candidate_invitations where application_id = p_application_id and status in ('pending', 'accepted')) then
    raise exception 'An active invitation already exists for this application';
  end if;

  insert into public.candidate_invitations (employer_id, worker_id, job_id, application_id, candidate_handle, message, status)
  values (v_job.employer_id, v_app.worker_id, v_job.id, p_application_id, encode(extensions.digest(v_app.worker_id::text, 'sha256'), 'hex'), nullif(left(trim(p_message), 500), ''), 'pending')
  returning id into v_invitation_id;

  insert into public.notifications (user_id, kind, payload)
  values (v_worker.user_id, 'candidate_invited',
    jsonb_build_object('invitation_id', v_invitation_id, 'application_id', p_application_id, 'job_id', v_job.id, 'job_title', v_job.title, 'company', coalesce(v_employer_name, 'Logistics Employer'), 'message', nullif(left(trim(p_message), 500), '')));

  insert into public.audit_log (actor_id, action, entity_type, entity_id, details)
  values (v_uid, 'application_invitation_created', 'candidate_invitation', v_invitation_id::text, jsonb_build_object('application_id', p_application_id, 'employer_id', v_job.employer_id, 'worker_id', v_app.worker_id));

  return v_invitation_id;
end;
$$;

create function public.respond_to_candidate_invitation(
  p_invitation_id uuid, p_accept boolean
) returns void
language plpgsql security definer set search_path = ''
as $$
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
  if v_uid is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  v_worker_id := public.current_worker_id();
  if v_worker_id is null then raise exception 'Worker profile required' using errcode = '42501'; end if;

  select * into v_inv from public.candidate_invitations where id = p_invitation_id and worker_id = v_worker_id for update;
  if not found then raise exception 'Invitation not found or not addressed to you'; end if;
  if v_inv.status != 'pending' then raise exception 'Invitation is already %', v_inv.status; end if;

  v_new_status := case when p_accept then 'accepted' else 'declined' end;
  update public.candidate_invitations set status = v_new_status, responded_at = now() where id = p_invitation_id;
  select title into v_job_title from public.jobs where id = v_inv.job_id;

  if p_accept then
    if v_inv.application_id is not null then
      select status into v_old_app_status from public.job_applications where id = v_inv.application_id for update;
      if v_old_app_status in ('applied', 'reviewing') then
        update public.job_applications set status = 'shortlisted', updated_at = now() where id = v_inv.application_id;
        insert into public.application_status_history (application_id, old_status, new_status, changed_by)
        values (v_inv.application_id, v_old_app_status, 'shortlisted', v_uid);
      end if;
      v_conv_id := public.ensure_application_conversation(v_inv.application_id);
    elsif v_inv.job_id is not null then
      select id, status into v_app_id, v_old_app_status from public.job_applications where job_id = v_inv.job_id and worker_id = v_inv.worker_id limit 1 for update;
      if v_app_id is null then
        insert into public.job_applications (job_id, worker_id, status) values (v_inv.job_id, v_inv.worker_id, 'shortlisted') returning id into v_app_id;
        insert into public.application_status_history (application_id, old_status, new_status, changed_by) values (v_app_id, 'applied', 'shortlisted', v_uid);
      elsif v_old_app_status in ('applied', 'reviewing') then
        update public.job_applications set status = 'shortlisted', updated_at = now() where id = v_app_id;
        insert into public.application_status_history (application_id, old_status, new_status, changed_by) values (v_app_id, v_old_app_status, 'shortlisted', v_uid);
      end if;
      update public.candidate_invitations set application_id = v_app_id where id = p_invitation_id;
      v_conv_id := public.ensure_application_conversation(v_app_id);
    end if;
  end if;

  for v_employer_member in select user_id from public.employer_memberships where employer_id = v_inv.employer_id and state = 'active'
  loop
    insert into public.notifications (user_id, kind, payload)
    values (v_employer_member, case when p_accept then 'invitation_accepted' else 'invitation_declined' end,
      jsonb_build_object('invitation_id', p_invitation_id, 'application_id', coalesce(v_inv.application_id, v_app_id), 'job_id', v_inv.job_id, 'job_title', coalesce(v_job_title, 'Opening'), 'status', v_new_status));
  end loop;

  insert into public.audit_log (actor_id, action, entity_type, entity_id, details)
  values (v_uid, 'candidate_invitation_responded', 'candidate_invitation', p_invitation_id::text,
    jsonb_build_object('response', v_new_status, 'application_id', coalesce(v_inv.application_id, v_app_id)));
end;
$$;

create function public.get_worker_candidate_invitations()
returns table(
  id uuid, job_id uuid, job_title text, employer_name text,
  message text, status text, created_at timestamptz, expires_at timestamptz
)
language plpgsql security definer set search_path = ''
as $$
declare v_worker_id uuid := public.current_worker_id();
begin
  if v_worker_id is null then return; end if;
  return query
  select i.id, i.job_id, coalesce(j.title, 'General Logistics Opportunity')::text as job_title,
    e.legal_name::text as employer_name, i.message, i.status, i.created_at, i.expires_at
  from public.candidate_invitations i
  join public.employers e on e.id = i.employer_id
  left join public.jobs j on j.id = i.job_id
  where i.worker_id = v_worker_id
  order by i.created_at desc;
end;
$$;

create function public.get_employer_candidate_invitations(p_job_id uuid default null::uuid)
returns table(
  id uuid, candidate_handle text, job_id uuid, job_title text,
  message text, status text, created_at timestamptz, responded_at timestamptz
)
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_employer_id uuid;
begin
  if v_uid is null then return; end if;
  select m.employer_id into v_employer_id
  from public.employer_memberships m
  join public.user_accounts u on u.user_id = m.user_id
  where m.user_id = v_uid and m.state = 'active' and u.account_state = 'active'
  limit 1;
  if v_employer_id is null then return; end if;

  return query
  select i.id, i.candidate_handle, i.job_id, coalesce(j.title, 'General Logistics Opportunity')::text as job_title,
    i.message, i.status, i.created_at, i.responded_at
  from public.candidate_invitations i
  left join public.jobs j on j.id = i.job_id
  where i.employer_id = v_employer_id and (p_job_id is null or i.job_id = p_job_id)
  order by i.created_at desc;
end;
$$;

-- ---------------------------------------------------------------------------
-- 7. Row Level Security & Policies (28/28 Public Tables + Private Storage)
-- ---------------------------------------------------------------------------
alter table public.user_accounts enable row level security;
alter table public.employers enable row level security;
alter table public.employer_memberships enable row level security;
alter table public.admin_principals enable row level security;
alter table public.workers enable row level security;
alter table public.worker_preferences enable row level security;
alter table public.worker_skills enable row level security;
alter table public.jobs enable row level security;
alter table public.job_status_history enable row level security;
alter table public.employer_verification_reviews enable row level security;
alter table public.job_applications enable row level security;
alter table public.application_status_history enable row level security;
alter table public.saved_jobs enable row level security;
alter table public.notifications enable row level security;
alter table public.conversations enable row level security;
alter table public.conversation_participants enable row level security;
alter table public.messages enable row level security;
alter table public.candidate_invitations enable row level security;
alter table public.worker_documents enable row level security;
alter table public.billing_settings enable row level security;
alter table public.payment_orders enable row level security;
alter table public.payment_events enable row level security;
alter table public.job_entitlements enable row level security;
alter table public.contact_unlocks enable row level security;
alter table public.payment_disputes enable row level security;
alter table public.audit_log enable row level security;
alter table public.support_tickets enable row level security;
alter table public.user_reports enable row level security;

create policy accounts_owner_read on public.user_accounts for select to authenticated using (user_id = auth.uid() or public.is_admin());
create policy accounts_owner_update on public.user_accounts for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid() and account_state = 'active');
create policy employer_member_read on public.employers for select to authenticated using (public.is_active_employer_member(id) or created_by = auth.uid() or public.is_admin());
create policy membership_self_read on public.employer_memberships for select to authenticated using (user_id = auth.uid() or public.is_active_employer_member(employer_id) or public.is_admin());

create policy worker_owner_select on public.workers for select to authenticated using (user_id = auth.uid() or public.is_admin());
create policy worker_owner_insert on public.workers for insert to authenticated with check ((user_id = auth.uid() and account_state = 'active') or public.is_admin());
create policy worker_owner_update on public.workers for update to authenticated using (user_id = auth.uid() or public.is_admin()) with check ((user_id = auth.uid() and account_state = 'active') or public.is_admin());

create policy worker_preferences_owner_all on public.worker_preferences for all to authenticated using (worker_id = public.current_worker_id() or public.is_admin()) with check (worker_id = public.current_worker_id() or public.is_admin());
create policy worker_skills_owner_all on public.worker_skills for all to authenticated using (worker_id = public.current_worker_id() or public.is_admin()) with check (worker_id = public.current_worker_id() or public.is_admin());

create policy jobs_live_or_org_read on public.jobs for select to authenticated using (
  (state = 'published' and (expires_at is null or expires_at > now()) and public.is_verified_employer(employer_id))
  or public.is_active_employer_member(employer_id) or public.is_admin()
);
create policy jobs_org_draft_insert on public.jobs for insert to authenticated with check (
  state = 'draft' and created_by = auth.uid() and public.is_active_employer_member(employer_id)
  and exists(select 1 from public.employer_memberships m where m.employer_id = jobs.employer_id and m.user_id = auth.uid() and m.role in ('owner','manager') and m.state = 'active')
);
create policy jobs_org_draft_update on public.jobs for update to authenticated
  using (state = 'draft' and public.is_active_employer_member(employer_id))
  with check (state = 'draft' and public.is_active_employer_member(employer_id));

create policy job_history_admin_or_org_read on public.job_status_history for select to authenticated
  using (public.is_admin() or exists(select 1 from public.jobs j where j.id = job_id and public.is_active_employer_member(j.employer_id)));
create policy verification_admin_read on public.employer_verification_reviews for select to authenticated using (public.is_admin());
create policy applications_worker_or_employer_read on public.job_applications for select to authenticated
  using (worker_id = public.current_worker_id() or public.is_admin() or exists(select 1 from public.jobs j where j.id = job_id and public.is_active_employer_member(j.employer_id)));
create policy application_history_authorized_read on public.application_status_history for select to authenticated
  using (public.is_admin() or exists(select 1 from public.job_applications a where a.id = application_id and (a.worker_id = public.current_worker_id() or exists(select 1 from public.jobs j where j.id = a.job_id and public.is_active_employer_member(j.employer_id)))));
create policy saved_jobs_owner_all on public.saved_jobs for all to authenticated
  using (worker_id = public.current_worker_id())
  with check (worker_id = public.current_worker_id() and exists(select 1 from public.jobs j where j.id = job_id and j.state = 'published' and (j.expires_at is null or j.expires_at > now())));

create policy notifications_owner_read on public.notifications for select to authenticated using (user_id = auth.uid() or public.is_admin());
create policy conversation_participant_read on public.conversations for select to authenticated using (public.can_access_conversation(id) or public.is_admin());
create policy participants_self_read on public.conversation_participants for select to authenticated using ((user_id = auth.uid() and public.can_access_conversation(conversation_id)) or public.is_admin());
create policy messages_participant_read on public.messages for select to authenticated using (public.can_access_conversation(conversation_id) or public.is_admin());

create policy invitations_employer_read on public.candidate_invitations for select to authenticated using (public.is_active_employer_member(employer_id) or public.is_admin());
create policy invitations_worker_read on public.candidate_invitations for select to authenticated using (worker_id = public.current_worker_id() or public.is_admin());

create policy documents_owner_read on public.worker_documents for select to authenticated using (worker_id = public.current_worker_id() or public.is_admin());
create policy documents_owner_insert on public.worker_documents for insert to authenticated with check (worker_id = public.current_worker_id() and (storage_path like auth.uid()::text || '/%'));

create policy billing_settings_admin_read on public.billing_settings for select to authenticated using (public.is_admin());
create policy payment_orders_owner_read on public.payment_orders for select to authenticated using (public.is_admin() or public.is_active_employer_member(employer_id));
create policy payment_events_admin_read on public.payment_events for select to authenticated using (public.is_admin());
create policy entitlements_admin_read on public.job_entitlements for select to authenticated using (public.is_admin());
create policy unlocks_admin_read on public.contact_unlocks for select to authenticated using (public.is_admin());
create policy disputes_owner_admin_read on public.payment_disputes for select to authenticated using (public.is_admin() or raised_by = auth.uid());
create policy audit_admin_read on public.audit_log for select to authenticated using (public.is_admin());
create policy support_owner_admin_read on public.support_tickets for select to authenticated using (opened_by = auth.uid() or public.is_admin());
create policy reports_owner_admin_read on public.user_reports for select to authenticated using (reporter_id = auth.uid() or public.is_admin());
create policy support_owner_insert on public.support_tickets for insert to authenticated with check (opened_by = auth.uid() and (employer_id is null or public.is_active_employer_member(employer_id)));
create policy reports_owner_insert on public.user_reports for insert to authenticated with check (reporter_id = auth.uid());

create policy worker_documents_object_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'worker-private-documents' and (storage.foldername(name))[1] = auth.uid()::text);
create policy worker_documents_object_read on storage.objects for select to authenticated
  using (bucket_id = 'worker-private-documents' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin()));
create policy worker_documents_object_delete on storage.objects for delete to authenticated
  using (bucket_id = 'worker-private-documents' and (storage.foldername(name))[1] = auth.uid()::text);

-- ---------------------------------------------------------------------------
-- 8. Least-Privilege Grants (Tables, Columns, Sequences, Routines)
-- ---------------------------------------------------------------------------
revoke all on all tables in schema public from public, anon, authenticated;
revoke all on all sequences in schema public from public, anon, authenticated;
revoke all on all routines in schema public from public, anon, authenticated;

grant select on public.user_accounts to authenticated;
grant update (display_label) on public.user_accounts to authenticated;
grant select on public.employers, public.employer_memberships, public.candidate_invitations to authenticated;
grant select on public.workers to authenticated;
grant insert (
  user_id, full_name, phone_e164, email, photo_path, address_line, locality, city, postal_code,
  category, experience_band, vehicle_type, has_own_vehicle, fuel_support_required,
  discoverable, availability, updated_at
) on public.workers to authenticated;
grant update (
  full_name, phone_e164, email, photo_path, address_line, locality, city, postal_code,
  category, experience_band, vehicle_type, has_own_vehicle, fuel_support_required,
  discoverable, availability, updated_at
) on public.workers to authenticated;
grant select, insert, update, delete on public.worker_preferences, public.worker_skills to authenticated;
grant select on public.jobs to authenticated;
grant insert (
  employer_id, created_by, title, category, description, city, area, postal_code,
  work_address, salary_min_inr, salary_max_inr, requires_driving_licence, expires_at, state
) on public.jobs to authenticated;
grant update (
  title, category, description, city, area, postal_code, work_address,
  salary_min_inr, salary_max_inr, requires_driving_licence, expires_at, updated_at
) on public.jobs to authenticated;
grant select on public.job_status_history, public.employer_verification_reviews,
  public.job_applications, public.application_status_history, public.conversations,
  public.conversation_participants, public.messages, public.worker_documents,
  public.billing_settings, public.payment_orders, public.payment_events,
  public.job_entitlements, public.contact_unlocks, public.payment_disputes,
  public.audit_log, public.support_tickets, public.user_reports, public.notifications to authenticated;
grant select, insert, delete on public.saved_jobs to authenticated;
grant select, insert on public.worker_documents to authenticated;
grant insert (opened_by, employer_id, subject, details) on public.support_tickets to authenticated;
grant insert (reporter_id, reported_user_id, job_id, details) on public.user_reports to authenticated;

grant execute on function public.get_public_published_jobs() to anon, authenticated, service_role;

grant execute on function
  public.current_worker_id(),
  public.is_admin(),
  public.is_active_employer_member(uuid),
  public.is_verified_employer(uuid),
  public.can_access_conversation(uuid),
  public.sanitize_locality(text, text),
  public.safe_worker_locality(text, text, text),
  public.get_current_employer_org(),
  public.register_employer(text, public.employer_type),
  public.save_worker_profile(text, text, text, text, text, boolean, boolean, text),
  public.set_worker_discoverability(boolean),
  public.discover_workers(text, text, text, text, integer, integer),
  public.discover_candidates(text, text, text, text, integer, integer),
  public.submit_job(uuid),
  public.review_job(uuid, boolean, text),
  public.admin_review_employer(uuid, text, text),
  public.admin_set_job_state(uuid, public.job_state, text),
  public.admin_set_account_state(uuid, public.account_state, text),
  public.admin_assign_admin(uuid),
  public.admin_update_support_ticket(uuid, public.ticket_state, text),
  public.update_employer_job_state(uuid, text),
  public.apply_to_job(uuid),
  public.set_application_status(uuid, public.application_state),
  public.get_employer_applicants(uuid),
  public.get_worker_applications(),
  public.create_candidate_invitation(text, uuid, text),
  public.create_application_invitation(uuid, text),
  public.respond_to_candidate_invitation(uuid, boolean),
  public.get_worker_candidate_invitations(),
  public.get_employer_candidate_invitations(uuid),
  public.ensure_application_conversation(uuid),
  public.send_message(uuid, text),
  public.get_user_conversations(),
  public.mark_notification_read(uuid)
to authenticated, service_role;

commit;
