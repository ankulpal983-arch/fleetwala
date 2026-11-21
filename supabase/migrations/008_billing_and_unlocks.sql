-- UNEXECUTED — Migration 8 of 15. Prerequisite: 002, 004, 005.
-- Disabled by default. No payment-provider integration and no client grants.
create table public.billing_settings (
  singleton boolean primary key default true check (singleton),
  enabled boolean not null default false,
  job_posting_price_inr integer not null default 99 check (job_posting_price_inr > 0),
  candidate_unlock_price_inr integer not null default 10 check (candidate_unlock_price_inr > 0),
  updated_at timestamptz not null default now()
);
insert into public.billing_settings(singleton) values (true);
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
