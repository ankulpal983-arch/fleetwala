-- ============================================================================
-- FLEETWALA PRE-PRODUCTION CONSOLIDATED STAGING MIGRATION
-- Generated: 22 November 2026
-- Scope: All 15 migrations consolidated into a single, transactional, idempotent script
-- Target: Supabase Staging PostgreSQL Database
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1. EXTENSIONS & ENUMS (001)
-- ============================================================================
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

-- ============================================================================
-- 2. ACCOUNTS, EMPLOYERS, ADMINS (002)
-- ============================================================================
create table if not exists public.user_accounts (
  user_id uuid primary key references auth.users(id) on delete restrict,
  account_state public.account_state not null default 'active',
  display_label text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint user_accounts_label_length check (display_label is null or char_length(display_label) between 1 and 100)
);

create table if not exists public.employers (
  id uuid primary key default gen_random_uuid(),
  legal_name text not null,
  employer_type public.employer_type not null,
  verification_state text not null default 'pending' check (verification_state in ('pending','verified','rejected','suspended')),
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint employers_name_length check (char_length(legal_name) between 2 and 200)
);

create table if not exists public.employer_memberships (
  id uuid primary key default gen_random_uuid(),
  employer_id uuid not null references public.employers(id) on delete restrict,
  user_id uuid not null references auth.users(id) on delete restrict,
  role public.membership_role not null,
  state public.membership_state not null default 'invited',
  created_at timestamptz not null default now(),
  unique (employer_id, user_id)
);

-- Admin allowlist: Strictly not client-writable. Provisioned out-of-band by project owner.
create table if not exists public.admin_principals (
  user_id uuid primary key references auth.users(id) on delete restrict,
  provisioned_by text not null,
  provisioned_at timestamptz not null default now(),
  reason text not null
);
revoke all on public.admin_principals from anon, authenticated;

-- ============================================================================
-- 3. WORKER PROFILES & PREFERENCES (003)
-- ============================================================================
create table if not exists public.workers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete restrict,
  full_name text,
  phone_e164 text,
  email text,
  photo_path text,
  address_line text,
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

create table if not exists public.worker_preferences (
  worker_id uuid primary key references public.workers(id) on delete cascade,
  preferred_radius_km integer not null default 15 check (preferred_radius_km between 1 and 100),
  preferred_city text,
  preferred_categories text[] not null default '{}',
  preferred_shifts text[] not null default '{}',
  consent_discovery_at timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists public.worker_skills (
  id uuid primary key default gen_random_uuid(),
  worker_id uuid not null references public.workers(id) on delete cascade,
  skill text not null check (char_length(skill) between 1 and 80),
  created_at timestamptz not null default now(),
  unique (worker_id, skill)
);

-- ============================================================================
-- 4. JOBS & MODERATION (004)
-- ============================================================================
create table if not exists public.jobs (
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

create table if not exists public.job_status_history (
  id bigint generated always as identity primary key,
  job_id uuid not null references public.jobs(id) on delete restrict,
  old_state public.job_state,
  new_state public.job_state not null,
  changed_by uuid references auth.users(id),
  reason text,
  changed_at timestamptz not null default now()
);

create table if not exists public.employer_verification_reviews (
  id bigint generated always as identity primary key,
  employer_id uuid not null references public.employers(id) on delete restrict,
  reviewed_by uuid not null references auth.users(id),
  decision text not null check (decision in ('verified','rejected','suspended')),
  reason text not null,
  created_at timestamptz not null default now()
);

-- ============================================================================
-- 5. APPLICATIONS & SAVED JOBS (005)
-- ============================================================================
create table if not exists public.job_applications (
  id uuid primary key default gen_random_uuid(),
  worker_id uuid not null references public.workers(id) on delete restrict,
  job_id uuid not null references public.jobs(id) on delete restrict,
  status public.application_state not null default 'applied',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (worker_id, job_id)
);

create table if not exists public.application_status_history (
  id bigint generated always as identity primary key,
  application_id uuid not null references public.job_applications(id) on delete restrict,
  old_status public.application_state,
  new_status public.application_state not null,
  changed_by uuid not null references auth.users(id),
  reason text,
  changed_at timestamptz not null default now()
);

create table if not exists public.saved_jobs (
  worker_id uuid not null references public.workers(id) on delete cascade,
  job_id uuid not null references public.jobs(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (worker_id, job_id)
);

-- ============================================================================
-- 6. NOTIFICATIONS & CHAT (006)
-- ============================================================================
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null,
  payload jsonb not null default '{}',
  read_at timestamptz,
  created_at timestamptz not null default now(),
  constraint notification_payload_object check (jsonb_typeof(payload) = 'object')
);

create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null unique references public.job_applications(id) on delete restrict,
  created_at timestamptz not null default now()
);

create table if not exists public.conversation_participants (
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete restrict,
  joined_at timestamptz not null default now(),
  primary key (conversation_id, user_id)
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete restrict,
  sender_id uuid not null references auth.users(id) on delete restrict,
  body text not null check (char_length(body) between 1 and 4000),
  created_at timestamptz not null default now()
);

-- ============================================================================
-- 7. STORAGE METADATA (007)
-- ============================================================================
do $$ begin
  insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values ('worker-private-documents', 'worker-private-documents', false, 10485760,
          array['application/pdf','image/jpeg','image/png'])
  on conflict (id) do nothing;
exception when others then null; end $$;

create table if not exists public.worker_documents (
  id uuid primary key default gen_random_uuid(),
  worker_id uuid not null references public.workers(id) on delete restrict,
  storage_path text not null unique,
  document_kind public.document_kind not null,
  original_filename text not null check (char_length(original_filename) between 1 and 200),
  mime_type text not null check (mime_type in ('application/pdf','image/jpeg','image/png')),
  byte_size bigint not null check (byte_size between 1 and 10485760),
  created_at timestamptz not null default now()
);

-- ============================================================================
-- 8. BILLING & CONTACT UNLOCKS (008)
-- ============================================================================
create table if not exists public.billing_settings (
  singleton boolean primary key default true check (singleton),
  enabled boolean not null default false,
  job_posting_price_inr integer not null default 99 check (job_posting_price_inr > 0),
  candidate_unlock_price_inr integer not null default 10 check (candidate_unlock_price_inr > 0),
  updated_at timestamptz not null default now()
);
insert into public.billing_settings(singleton) values (true) on conflict (singleton) do nothing;

create table if not exists public.payment_orders (
  id uuid primary key default gen_random_uuid(),
  employer_id uuid not null references public.employers(id) on delete restrict,
  purpose text not null check (purpose in ('job_posting','contact_unlock')),
  amount_inr integer not null check (amount_inr > 0),
  state public.payment_state not null default 'created',
  provider_reference text unique,
  created_at timestamptz not null default now()
);

create table if not exists public.payment_events (
  id uuid primary key default gen_random_uuid(),
  provider_event_id text not null unique,
  order_id uuid references public.payment_orders(id) on delete restrict,
  verified boolean not null default false,
  event_payload jsonb not null default '{}',
  received_at timestamptz not null default now()
);

create table if not exists public.job_entitlements (
  id uuid primary key default gen_random_uuid(),
  employer_id uuid not null references public.employers(id) on delete restrict,
  job_id uuid not null unique references public.jobs(id) on delete restrict,
  payment_order_id uuid unique references public.payment_orders(id) on delete restrict,
  granted_at timestamptz not null default now()
);

create table if not exists public.contact_unlocks (
  id uuid primary key default gen_random_uuid(),
  employer_id uuid not null references public.employers(id) on delete restrict,
  worker_id uuid not null references public.workers(id) on delete restrict,
  payment_order_id uuid unique references public.payment_orders(id) on delete restrict,
  granted_at timestamptz not null default now(),
  unique (employer_id, worker_id)
);

create table if not exists public.payment_disputes (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.payment_orders(id) on delete restrict,
  raised_by uuid not null references auth.users(id),
  status public.ticket_state not null default 'open',
  details text not null,
  created_at timestamptz not null default now()
);

-- ============================================================================
-- 9. AUDIT & SUPPORT (009)
-- ============================================================================
create table if not exists public.audit_log (
  id bigint generated always as identity primary key,
  actor_id uuid references auth.users(id),
  action text not null,
  entity_type text not null,
  entity_id text,
  details jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create table if not exists public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  opened_by uuid not null references auth.users(id) on delete restrict,
  employer_id uuid references public.employers(id) on delete restrict,
  subject text not null check (char_length(subject) between 3 and 200),
  details text not null check (char_length(details) between 5 and 10000),
  status public.ticket_state not null default 'open',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.user_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references auth.users(id) on delete restrict,
  reported_user_id uuid references auth.users(id) on delete restrict,
  job_id uuid references public.jobs(id) on delete restrict,
  details text not null check (char_length(details) between 5 and 5000),
  status public.ticket_state not null default 'open',
  created_at timestamptz not null default now()
);

-- ============================================================================
-- 10. INDEXES, TRIGGERS & RPC FUNCTIONS (010)
-- ============================================================================
create index if not exists jobs_live_idx on public.jobs(state, expires_at, city) where state = 'published';
create index if not exists jobs_employer_idx on public.jobs(employer_id, created_at desc);
create index if not exists applications_worker_day_idx on public.job_applications(worker_id, created_at);
create index if not exists applications_job_idx on public.job_applications(job_id, created_at desc);
create index if not exists notifications_user_idx on public.notifications(user_id, created_at desc);
create index if not exists messages_conversation_idx on public.messages(conversation_id, created_at);
create index if not exists audit_log_created_idx on public.audit_log(created_at desc);
create index if not exists workers_discovery_idx on public.workers(city, category, experience_band) where discoverable and account_state = 'active';

create or replace function public.touch_updated_at() returns trigger
language plpgsql set search_path = ''
as $$ begin new.updated_at := now(); return new; end $$;

drop trigger if exists workers_touch on public.workers;
create trigger workers_touch before update on public.workers for each row execute function public.touch_updated_at();

drop trigger if exists jobs_touch on public.jobs;
create trigger jobs_touch before update on public.jobs for each row execute function public.touch_updated_at();

drop trigger if exists accounts_touch on public.user_accounts;
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

create or replace function public.current_worker_id() returns uuid
language sql stable security definer set search_path = ''
as $$ select w.id from public.workers w where w.user_id = auth.uid() and w.account_state = 'active' $$;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = ''
as $$ select exists (select 1 from public.admin_principals a
  join public.user_accounts u on u.user_id=a.user_id
  where a.user_id=auth.uid() and u.account_state='active') $$;

create or replace function public.is_active_employer_member(p_employer_id uuid) returns boolean
language sql stable security definer set search_path = ''
as $$ select exists (
  select 1 from public.employer_memberships m
  join public.employers e on e.id = m.employer_id
  join public.user_accounts u on u.user_id = m.user_id
  where m.employer_id = p_employer_id and m.user_id = auth.uid()
    and m.state = 'active' and e.verification_state = 'verified'
    and u.account_state = 'active'
) $$;

create or replace function public.is_verified_employer(p_employer_id uuid) returns boolean
language sql stable security definer set search_path = ''
as $$ select exists (select 1 from public.employers e where e.id=p_employer_id and e.verification_state='verified') $$;

-- Atomic 20 applies / IST calendar day function
create or replace function public.apply_to_job(p_job_id uuid)
returns table(application_id uuid, was_existing boolean)
language plpgsql security definer set search_path = ''
as $$
declare v_worker_id uuid; v_app public.job_applications%rowtype; v_today date; v_eligible_job uuid;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  select w.id into v_worker_id from public.workers w
    where w.user_id = auth.uid() and w.account_state = 'active' for update;
  if v_worker_id is null then raise exception 'Active worker profile required'; end if;
  
  -- Idempotency check
  select a.* into v_app from public.job_applications a
    where a.worker_id = v_worker_id and a.job_id = p_job_id;
  if found then return query select v_app.id, true; return; end if;

  select j.id into v_eligible_job
    from public.jobs j join public.employers e on e.id=j.employer_id
    where j.id=p_job_id and j.state='published'
      and (j.expires_at is null or j.expires_at>clock_timestamp())
      and e.verification_state='verified'
    for share of j,e;
  if v_eligible_job is null then
    raise exception 'Job is not currently eligible for applications';
  end if;

  v_today := (clock_timestamp() at time zone 'Asia/Kolkata')::date;
  if (select count(*) from public.job_applications a
      where a.worker_id = v_worker_id
        and (a.created_at at time zone 'Asia/Kolkata')::date = v_today) >= 20 then
    raise exception 'Daily application limit reached (20 per IST calendar day)';
  end if;

  insert into public.job_applications(worker_id, job_id, created_at) values (v_worker_id, p_job_id, clock_timestamp())
    returning * into v_app;
  insert into public.application_status_history(application_id, old_status, new_status, changed_by)
    values (v_app.id, null, 'applied', auth.uid());
  insert into public.audit_log(actor_id,action,entity_type,entity_id)
    values(auth.uid(),'application_create','application',v_app.id::text);
  return query select v_app.id, false;
exception when unique_violation then
  select a.* into v_app from public.job_applications a
   where a.worker_id = v_worker_id and a.job_id = p_job_id;
  if v_app.id is not null then return query select v_app.id, true; else raise; end if;
end $$;

create or replace function public.submit_job(p_job_id uuid) returns void
language plpgsql security definer set search_path = ''
as $$ begin
  if auth.uid() is null or not exists (
    select 1 from public.jobs j join public.employer_memberships m on m.employer_id=j.employer_id
    join public.user_accounts u on u.user_id=m.user_id
    where j.id=p_job_id and j.state='draft' and m.user_id=auth.uid()
      and m.state='active' and m.role in ('owner','manager')
      and u.account_state='active' and public.is_active_employer_member(j.employer_id)
  ) then raise exception 'Not authorized to submit this draft'; end if;
  update public.jobs set state='pending_review' where id=p_job_id;
  insert into public.job_status_history(job_id, old_state, new_state, changed_by)
    values(p_job_id,'draft','pending_review',auth.uid());
  insert into public.audit_log(actor_id,action,entity_type,entity_id)
    values(auth.uid(),'job_submit','job',p_job_id::text);
end $$;

create or replace function public.review_job(p_job_id uuid, p_approve boolean, p_reason text) returns void
language plpgsql security definer set search_path = ''
as $$ declare v_old public.job_state; v_new public.job_state;
begin
  if not public.is_admin() then raise exception 'Administrator access required'; end if;
  select state into v_old from public.jobs where id=p_job_id for update;
  if v_old is distinct from 'pending_review' then raise exception 'Job is not pending review'; end if;
  v_new := case when p_approve then 'published'::public.job_state else 'rejected'::public.job_state end;
  update public.jobs set state=v_new, reviewed_by=auth.uid(), reviewed_at=now(), review_note=p_reason where id=p_job_id;
  insert into public.job_status_history(job_id,old_state,new_state,changed_by,reason)
    values(p_job_id,v_old,v_new,auth.uid(),left(p_reason,1000));
  insert into public.audit_log(actor_id,action,entity_type,entity_id,details)
    values(auth.uid(),'job_review','job',p_job_id::text,jsonb_build_object('decision',v_new));
end $$;

create or replace function public.admin_set_job_state(p_job_id uuid, p_state public.job_state, p_reason text)
returns void language plpgsql security definer set search_path = ''
as $$ declare v_old public.job_state;
begin
  if not public.is_admin() or p_state not in ('paused','closed','published') then
    raise exception 'Administrator access required or invalid state';
  end if;
  select state into v_old from public.jobs where id=p_job_id for update;
  if not found or not (
    (v_old='published' and p_state in ('paused','closed'))
    or (v_old='paused' and p_state in ('published','closed'))
  ) then raise exception 'Invalid job state transition'; end if;
  if p_state='published' and not public.is_verified_employer(
    (select employer_id from public.jobs where id=p_job_id)
  ) then raise exception 'Employer is not verified'; end if;
  if p_state='published' and exists(select 1 from public.jobs
      where id=p_job_id and expires_at is not null and expires_at<=clock_timestamp()) then
    raise exception 'Expired jobs cannot be reopened';
  end if;
  update public.jobs set state=p_state, review_note=left(p_reason,1000),
    reviewed_by=auth.uid(), reviewed_at=clock_timestamp() where id=p_job_id;
  insert into public.job_status_history(job_id,old_state,new_state,changed_by,reason)
    values(p_job_id,v_old,p_state,auth.uid(),left(p_reason,1000));
  insert into public.audit_log(actor_id,action,entity_type,entity_id,details)
    values(auth.uid(),'job_state','job',p_job_id::text,
      jsonb_build_object('old_state',v_old,'new_state',p_state,'reason',left(p_reason,500)));
end $$;

create or replace function public.set_application_status(p_application_id uuid, p_status public.application_state)
returns void language plpgsql security definer set search_path = ''
as $$ declare v_app public.job_applications%rowtype; v_allowed boolean;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  select a.* into v_app from public.job_applications a where a.id=p_application_id for update;
  if not found then raise exception 'Application not found'; end if;
  if v_app.status in ('withdrawn','hired','rejected') then raise exception 'Terminal application status'; end if;
  if p_status='withdrawn' then
    v_allowed := v_app.worker_id=public.current_worker_id();
  else
    v_allowed := v_app.worker_id is distinct from public.current_worker_id()
      and exists(select 1 from public.jobs j where j.id=v_app.job_id and public.is_active_employer_member(j.employer_id))
      and ((v_app.status='applied' and p_status in ('reviewing','rejected'))
        or (v_app.status='reviewing' and p_status in ('shortlisted','rejected'))
        or (v_app.status='shortlisted' and p_status in ('hired','rejected')));
  end if;
  if not v_allowed then raise exception 'Not authorized for this status transition'; end if;
  update public.job_applications set status=p_status,updated_at=now() where id=p_application_id;
  insert into public.application_status_history(application_id,old_status,new_status,changed_by)
    values(p_application_id,v_app.status,p_status,auth.uid());
  insert into public.audit_log(actor_id,action,entity_type,entity_id,details)
    values(auth.uid(),'application_status','application',p_application_id::text,jsonb_build_object('status',p_status));
  if p_status='shortlisted' then
    perform public.ensure_application_conversation(p_application_id);
  end if;
end $$;

create or replace function public.ensure_application_conversation(p_application_id uuid) returns uuid
language plpgsql security definer set search_path = ''
as $$ declare v_id uuid; v_worker_user uuid;
begin
  select c.id into v_id from public.conversations c where c.application_id=p_application_id;
  if v_id is not null then return v_id; end if;
  if not exists(select 1 from public.job_applications a join public.jobs j on j.id=a.job_id
    where a.id=p_application_id and (a.status='shortlisted' or public.is_admin())
      and (public.is_active_employer_member(j.employer_id) or exists(select 1 from public.workers w where w.id=a.worker_id and w.user_id=auth.uid()))) then
    raise exception 'Conversation requires an authorized shortlisted application';
  end if;
  select w.user_id into v_worker_user
    from public.job_applications a join public.workers w on w.id=a.worker_id where a.id=p_application_id;
  insert into public.conversations(application_id) values(p_application_id) returning id into v_id;
  insert into public.conversation_participants values(v_id,v_worker_user,now()),(v_id,auth.uid(),now())
    on conflict do nothing;
  return v_id;
end $$;

create or replace function public.can_access_conversation(p_conversation_id uuid) returns boolean
language sql stable security definer set search_path = ''
as $$ select exists(
  select 1 from public.conversations c
  join public.job_applications a on a.id=c.application_id
  join public.jobs j on j.id=a.job_id
  join public.conversation_participants cp on cp.conversation_id=c.id
  join public.user_accounts u on u.user_id=auth.uid()
  where c.id=p_conversation_id and cp.user_id=auth.uid()
    and a.status='shortlisted' and u.account_state='active'
    and (exists(select 1 from public.workers w where w.id=a.worker_id
          and w.user_id=auth.uid() and w.account_state='active')
      or public.is_active_employer_member(j.employer_id))
) $$;

create or replace function public.send_message(p_conversation_id uuid,p_body text) returns uuid
language plpgsql security definer set search_path = ''
as $$ declare v_id uuid;
begin
  if auth.uid() is null or char_length(trim(p_body)) not between 1 and 4000 then raise exception 'Invalid message'; end if;
  if not public.can_access_conversation(p_conversation_id) then raise exception 'Conversation access denied'; end if;
  insert into public.messages(conversation_id,sender_id,body) values(p_conversation_id,auth.uid(),trim(p_body)) returning id into v_id;
  return v_id;
end $$;

create or replace function public.mark_notification_read(p_notification_id uuid) returns void
language plpgsql security definer set search_path = ''
as $$ begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  update public.notifications set read_at=coalesce(read_at,clock_timestamp())
    where id=p_notification_id and user_id=auth.uid();
  if not found then raise exception 'Notification not found'; end if;
end $$;

create or replace function public.admin_set_account_state(p_user_id uuid, p_state public.account_state, p_reason text)
returns void language plpgsql security definer set search_path = ''
as $$ begin
  if not public.is_admin() or p_state not in ('active','suspended') then raise exception 'Administrator access required or invalid state'; end if;
  update public.user_accounts set account_state=p_state where user_id=p_user_id;
  update public.workers set account_state=p_state where user_id=p_user_id;
  insert into public.audit_log(actor_id,action,entity_type,entity_id,details)
    values(auth.uid(),'account_state','user',p_user_id::text,jsonb_build_object('state',p_state,'reason',left(p_reason,500)));
end $$;

-- Revoke default function privileges
revoke all on function public.touch_updated_at() from public, anon, authenticated;
revoke all on function public.apply_to_job(uuid) from public, anon, authenticated;
revoke all on function public.submit_job(uuid) from public, anon, authenticated;
revoke all on function public.review_job(uuid,boolean,text) from public, anon, authenticated;
revoke all on function public.admin_set_job_state(uuid,public.job_state,text) from public, anon, authenticated;
revoke all on function public.set_application_status(uuid,public.application_state) from public, anon, authenticated;
revoke all on function public.ensure_application_conversation(uuid) from public, anon, authenticated;
revoke all on function public.send_message(uuid,text) from public, anon, authenticated;
revoke all on function public.mark_notification_read(uuid) from public, anon, authenticated;
revoke all on function public.current_worker_id() from public, anon, authenticated;
revoke all on function public.is_admin() from public, anon, authenticated;
revoke all on function public.is_active_employer_member(uuid) from public, anon, authenticated;
revoke all on function public.is_verified_employer(uuid) from public, anon, authenticated;
revoke all on function public.can_access_conversation(uuid) from public, anon, authenticated;
revoke all on function public.admin_set_account_state(uuid,public.account_state,text) from public, anon, authenticated;
revoke all on function public.on_auth_user_created() from public, anon, authenticated;

-- ============================================================================
-- 11. ROW LEVEL SECURITY (RLS) POLICIES & GRANTS (011)
-- ============================================================================
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

-- Policies (Drop existing to ensure idempotent execution)
drop policy if exists accounts_owner_read on public.user_accounts;
create policy accounts_owner_read on public.user_accounts for select to authenticated using (user_id=auth.uid() or public.is_admin());

drop policy if exists accounts_owner_update on public.user_accounts;
create policy accounts_owner_update on public.user_accounts for update to authenticated using (user_id=auth.uid()) with check (user_id=auth.uid() and account_state='active');

drop policy if exists employer_member_read on public.employers;
create policy employer_member_read on public.employers for select to authenticated using (public.is_active_employer_member(id) or public.is_admin());

drop policy if exists membership_self_read on public.employer_memberships;
create policy membership_self_read on public.employer_memberships for select to authenticated using (user_id=auth.uid() or public.is_admin());

drop policy if exists worker_owner_all on public.workers;
create policy worker_owner_all on public.workers for all to authenticated
  using (user_id=auth.uid() or public.is_admin())
  with check (user_id=auth.uid() or public.is_admin());

drop policy if exists worker_preferences_owner_all on public.worker_preferences;
create policy worker_preferences_owner_all on public.worker_preferences for all to authenticated
  using (worker_id=public.current_worker_id() or public.is_admin())
  with check (worker_id=public.current_worker_id() or public.is_admin());

drop policy if exists worker_skills_owner_all on public.worker_skills;
create policy worker_skills_owner_all on public.worker_skills for all to authenticated
  using (worker_id=public.current_worker_id() or public.is_admin())
  with check (worker_id=public.current_worker_id() or public.is_admin());

drop policy if exists jobs_live_or_org_read on public.jobs;
create policy jobs_live_or_org_read on public.jobs for select to authenticated using (
  (state='published' and (expires_at is null or expires_at>now())
    and public.is_verified_employer(employer_id))
  or public.is_active_employer_member(employer_id) or public.is_admin()
);

drop policy if exists jobs_org_draft_insert on public.jobs;
create policy jobs_org_draft_insert on public.jobs for insert to authenticated
  with check (state='draft' and created_by=auth.uid() and public.is_active_employer_member(employer_id)
    and exists(select 1 from public.employer_memberships m where m.employer_id=jobs.employer_id
      and m.user_id=auth.uid() and m.role in ('owner','manager') and m.state='active'));

drop policy if exists jobs_org_draft_update on public.jobs;
create policy jobs_org_draft_update on public.jobs for update to authenticated
  using (state='draft' and public.is_active_employer_member(employer_id))
  with check (state='draft' and public.is_active_employer_member(employer_id));

drop policy if exists job_history_admin_or_org_read on public.job_status_history;
create policy job_history_admin_or_org_read on public.job_status_history for select to authenticated
  using (public.is_admin() or exists(select 1 from public.jobs j where j.id=job_id and public.is_active_employer_member(j.employer_id)));

drop policy if exists verification_admin_read on public.employer_verification_reviews;
create policy verification_admin_read on public.employer_verification_reviews for select to authenticated using (public.is_admin());

drop policy if exists applications_worker_or_employer_read on public.job_applications;
create policy applications_worker_or_employer_read on public.job_applications for select to authenticated using (
  worker_id=public.current_worker_id() or public.is_admin()
  or exists(select 1 from public.jobs j where j.id=job_id and public.is_active_employer_member(j.employer_id))
);

drop policy if exists application_history_authorized_read on public.application_status_history;
create policy application_history_authorized_read on public.application_status_history for select to authenticated using (
  public.is_admin() or exists(select 1 from public.job_applications a where a.id=application_id
    and (a.worker_id=public.current_worker_id() or exists(select 1 from public.jobs j where j.id=a.job_id and public.is_active_employer_member(j.employer_id))))
);

drop policy if exists saved_jobs_owner_all on public.saved_jobs;
create policy saved_jobs_owner_all on public.saved_jobs for all to authenticated
  using (worker_id=public.current_worker_id()) with check (
    worker_id=public.current_worker_id() and exists(select 1 from public.jobs j where j.id=job_id
      and j.state='published' and (j.expires_at is null or j.expires_at>now()))
  );

drop policy if exists notifications_owner_read on public.notifications;
create policy notifications_owner_read on public.notifications for select to authenticated using (user_id=auth.uid() or public.is_admin());

drop policy if exists conversation_participant_read on public.conversations;
create policy conversation_participant_read on public.conversations for select to authenticated using
  (public.can_access_conversation(id) or public.is_admin());

drop policy if exists participants_self_read on public.conversation_participants;
create policy participants_self_read on public.conversation_participants for select to authenticated using
  ((user_id=auth.uid() and public.can_access_conversation(conversation_id)) or public.is_admin());

drop policy if exists messages_participant_read on public.messages;
create policy messages_participant_read on public.messages for select to authenticated using
  (public.can_access_conversation(conversation_id) or public.is_admin());

drop policy if exists documents_owner_read on public.worker_documents;
create policy documents_owner_read on public.worker_documents for select to authenticated
  using (worker_id=public.current_worker_id() or public.is_admin());

drop policy if exists documents_owner_insert on public.worker_documents;
create policy documents_owner_insert on public.worker_documents for insert to authenticated
  with check (worker_id=public.current_worker_id() and (storage_path like auth.uid()::text || '/%'));

drop policy if exists billing_settings_admin_read on public.billing_settings;
create policy billing_settings_admin_read on public.billing_settings for select to authenticated using (public.is_admin());

drop policy if exists payment_orders_owner_read on public.payment_orders;
create policy payment_orders_owner_read on public.payment_orders for select to authenticated using
  (public.is_admin() or public.is_active_employer_member(employer_id));

drop policy if exists payment_events_admin_read on public.payment_events;
create policy payment_events_admin_read on public.payment_events for select to authenticated using (public.is_admin());

drop policy if exists entitlements_admin_read on public.job_entitlements;
create policy entitlements_admin_read on public.job_entitlements for select to authenticated using (public.is_admin());

drop policy if exists unlocks_admin_read on public.contact_unlocks;
create policy unlocks_admin_read on public.contact_unlocks for select to authenticated using (public.is_admin());

drop policy if exists disputes_owner_admin_read on public.payment_disputes;
create policy disputes_owner_admin_read on public.payment_disputes for select to authenticated
  using (public.is_admin() or raised_by=auth.uid());

drop policy if exists audit_admin_read on public.audit_log;
create policy audit_admin_read on public.audit_log for select to authenticated using (public.is_admin());

drop policy if exists support_owner_admin_read on public.support_tickets;
create policy support_owner_admin_read on public.support_tickets for select to authenticated
  using (opened_by=auth.uid() or public.is_admin());

drop policy if exists reports_owner_admin_read on public.user_reports;
create policy reports_owner_admin_read on public.user_reports for select to authenticated
  using (reporter_id=auth.uid() or public.is_admin());

drop policy if exists support_owner_insert on public.support_tickets;
create policy support_owner_insert on public.support_tickets for insert to authenticated
  with check (opened_by=auth.uid() and (employer_id is null or public.is_active_employer_member(employer_id)));

drop policy if exists reports_owner_insert on public.user_reports;
create policy reports_owner_insert on public.user_reports for insert to authenticated
  with check (reporter_id=auth.uid());

-- Least privilege grants
revoke all on all tables in schema public from anon, authenticated;
grant select on public.user_accounts to authenticated;
grant update (display_label) on public.user_accounts to authenticated;
grant select on public.employers, public.employer_memberships to authenticated;
grant select on public.workers to authenticated;
grant insert (user_id, full_name, phone_e164, email, photo_path, address_line, city, postal_code,
  category, experience_band, vehicle_type, has_own_vehicle, fuel_support_required, discoverable, availability)
  on public.workers to authenticated;
grant update (full_name, phone_e164, email, photo_path, address_line, city, postal_code, category,
  experience_band, vehicle_type, has_own_vehicle, fuel_support_required, discoverable, availability)
  on public.workers to authenticated;
grant select, insert, update, delete on public.worker_preferences, public.worker_skills to authenticated;
grant select on public.jobs to authenticated;
grant insert (employer_id, created_by, title, category, description, city, area, postal_code,
  work_address, salary_min_inr, salary_max_inr, requires_driving_licence, expires_at)
  on public.jobs to authenticated;
grant update (title, category, description, city, area, postal_code, work_address,
  salary_min_inr, salary_max_inr, requires_driving_licence, expires_at) on public.jobs to authenticated;
grant select on public.job_status_history, public.employer_verification_reviews,
  public.job_applications, public.application_status_history, public.conversations,
  public.conversation_participants, public.messages, public.worker_documents,
  public.billing_settings, public.payment_orders, public.payment_events,
  public.job_entitlements, public.contact_unlocks, public.payment_disputes,
  public.audit_log, public.support_tickets, public.user_reports to authenticated;
grant select, insert, delete on public.saved_jobs to authenticated;
grant select, insert on public.worker_documents to authenticated;
grant select on public.notifications to authenticated;
grant insert (opened_by, employer_id, subject, details) on public.support_tickets to authenticated;
grant insert (reporter_id, reported_user_id, job_id, details) on public.user_reports to authenticated;

-- Function execution grants
grant execute on function public.current_worker_id(), public.is_admin(), public.is_active_employer_member(uuid),
  public.is_verified_employer(uuid), public.can_access_conversation(uuid) to authenticated;
grant execute on function public.apply_to_job(uuid), public.submit_job(uuid),
  public.set_application_status(uuid,public.application_state), public.send_message(uuid,text),
  public.mark_notification_read(uuid), public.review_job(uuid,boolean,text),
  public.admin_set_job_state(uuid,public.job_state,text),
  public.admin_set_account_state(uuid,public.account_state,text) to authenticated;

-- ============================================================================
-- 12. VIEWS & SAFE DISCOVERY (012)
-- ============================================================================
create or replace function public.discover_workers(
  p_city text default null, p_category text default null, p_experience text default null,
  p_limit integer default 20, p_offset integer default 0
) returns table(candidate_handle text, city text, category text, experience_band text, vehicle_type text)
language plpgsql stable security definer set search_path = ''
as $$
begin
  if auth.uid() is null or not exists(
    select 1 from public.employer_memberships m
    join public.employers e on e.id=m.employer_id
    join public.user_accounts u on u.user_id=m.user_id
    where m.user_id=auth.uid() and m.state='active' and e.verification_state='verified' and u.account_state='active'
  ) then raise exception 'Active verified employer membership required'; end if;
  if p_limit not between 1 and 50 or p_offset < 0 then raise exception 'Invalid pagination'; end if;
  return query select encode(extensions.digest(w.id::text,'sha256'),'hex'),
    w.city,w.category,w.experience_band,w.vehicle_type
    from public.workers w
    where w.discoverable and w.account_state='active'
      and (p_city is null or lower(w.city)=lower(left(p_city,100)))
      and (p_category is null or w.category=p_category)
      and (p_experience is null or w.experience_band=p_experience)
    order by w.created_at desc limit p_limit offset p_offset;
end $$;

revoke all on function public.discover_workers(text,text,text,integer,integer) from public, anon, authenticated;
grant execute on function public.discover_workers(text,text,text,integer,integer) to authenticated;

COMMIT;
