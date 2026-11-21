-- UNEXECUTED — Migration 5 of 15. Prerequisite: 003, 004.
-- One immutable application per worker/job. Withdrawals still count toward daily cap.
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
