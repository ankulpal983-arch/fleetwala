-- UNEXECUTED — Migration 2 of 15. Auth identity is exclusively Supabase Auth.
-- Prerequisite: 001. Effect: private account profiles, organization tenancy, admin allowlist.
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

-- Deliberately not client-writable. Provision administrators only by a trusted
-- project owner in the Supabase SQL dashboard after out-of-band identity checks.
create table public.admin_principals (
  user_id uuid primary key references auth.users(id) on delete restrict,
  provisioned_by text not null,
  provisioned_at timestamptz not null default now(),
  reason text not null
);
revoke all on public.admin_principals from anon, authenticated;
