-- UNEXECUTED — Migration 4 of 15. Prerequisite: 002, 003.
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
