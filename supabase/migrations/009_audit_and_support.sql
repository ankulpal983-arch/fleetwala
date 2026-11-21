-- UNEXECUTED — Migration 9 of 15. Prerequisite: 002, 004.
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
