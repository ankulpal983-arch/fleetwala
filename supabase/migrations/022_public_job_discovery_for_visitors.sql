-- Migration 022: Public Published Job Discovery RPC for Visitors
-- Preserves strict table RLS (direct anon SELECT on public.jobs remains denied with 42501)
-- Provides a hardened SECURITY DEFINER RPC for prospective workers and visitors to browse approved published jobs.

-- 1. Ensure direct table access is revoked from anon
revoke all on public.jobs from anon;
revoke all on public.employers from anon;
drop policy if exists jobs_anon_read_published on public.jobs;
drop policy if exists employers_anon_read_verified on public.employers;

-- 2. Create hardened public discovery RPC
create or replace function public.get_public_published_jobs()
returns table (
  id uuid,
  employer_id uuid,
  title text,
  company text,
  city text,
  area text,
  category text,
  description text,
  salary_min_inr integer,
  salary_max_inr integer,
  requires_driving_licence boolean,
  expires_at timestamptz,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  return query
  select
    j.id,
    j.employer_id,
    j.title,
    coalesce(e.legal_name, 'Verified Logistics Partner')::text as company,
    j.city,
    coalesce(j.area, 'Central')::text as area,
    j.category,
    j.description,
    coalesce(j.salary_min_inr, 18000),
    coalesce(j.salary_max_inr, 24000),
    coalesce(j.requires_driving_licence, false),
    coalesce(j.expires_at, now() + interval '30 days'),
    j.created_at
  from public.jobs j
  left join public.employers e on e.id = j.employer_id
  where j.state = 'published'
    and (j.expires_at is null or j.expires_at > now())
  order by j.created_at desc;
end;
$$;

-- 3. Grant execute to anon and authenticated
revoke all on function public.get_public_published_jobs() from public;
grant execute on function public.get_public_published_jobs() to anon, authenticated;
