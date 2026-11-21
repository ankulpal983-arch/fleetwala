-- UNEXECUTED — Migration 12 of 15. Prerequisite: 003, 010, 011.
-- No direct worker table access is granted to employers; this RPC emits only
-- an opaque handle and opted-in, non-identifying attributes.
create function public.discover_workers(
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
