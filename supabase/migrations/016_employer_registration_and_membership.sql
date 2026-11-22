-- 016_employer_registration_and_membership.sql
-- Enables secure employer organization onboarding via RPC without granting direct INSERT on employers table.

-- 1. Update is_active_employer_member so active members can read their organization and manage drafts while verification_state = 'pending'
create or replace function public.is_active_employer_member(p_employer_id uuid) returns boolean
language sql stable security definer set search_path = ''
as $$ select exists (
  select 1 from public.employer_memberships m
  join public.employers e on e.id = m.employer_id
  join public.user_accounts u on u.user_id = m.user_id
  where m.employer_id = p_employer_id and m.user_id = auth.uid()
    and m.state = 'active' and u.account_state = 'active'
) $$;

-- 2. Procedure for authenticated user to register a new employer organization safely
create or replace function public.register_employer(
  p_legal_name text,
  p_employer_type public.employer_type
) returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_emp_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;
  if char_length(trim(p_legal_name)) not between 2 and 200 then
    raise exception 'Organization name must be between 2 and 200 characters';
  end if;

  -- Organization always starts with 'pending' verification state (cannot self-verify)
  insert into public.employers(legal_name, employer_type, verification_state, created_by)
  values (trim(p_legal_name), p_employer_type, 'pending', auth.uid())
  returning id into v_emp_id;

  -- Register creator as organization owner
  insert into public.employer_memberships(employer_id, user_id, role, state)
  values (v_emp_id, auth.uid(), 'owner', 'active');

  insert into public.audit_log(actor_id, action, entity_type, entity_id, details)
  values (auth.uid(), 'employer_register', 'employer', v_emp_id::text, jsonb_build_object('legal_name', trim(p_legal_name), 'type', p_employer_type));

  return v_emp_id;
end $$;

revoke all on function public.register_employer(text, public.employer_type) from public, anon, authenticated;
grant execute on function public.register_employer(text, public.employer_type) to authenticated;
