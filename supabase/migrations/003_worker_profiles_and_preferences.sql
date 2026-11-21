-- UNEXECUTED — Migration 3 of 15. Prerequisite: 002.
-- Worker PII and preferences are private to the owning Supabase Auth user.
create table public.workers (
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
