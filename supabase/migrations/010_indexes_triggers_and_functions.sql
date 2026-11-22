-- UNEXECUTED — Migration 10 of 15. Prerequisite: 001–009.
-- Trusted routines use fixed search_path and derive identity from auth.uid().
create index jobs_live_idx on public.jobs(state, expires_at, city) where state = 'published';
create index jobs_employer_idx on public.jobs(employer_id, created_at desc);
create index applications_worker_day_idx on public.job_applications(worker_id, created_at);
create index applications_job_idx on public.job_applications(job_id, created_at desc);
create index notifications_user_idx on public.notifications(user_id, created_at desc);
create index messages_conversation_idx on public.messages(conversation_id, created_at);
create index audit_log_created_idx on public.audit_log(created_at desc);
create index workers_discovery_idx on public.workers(city, category, experience_band) where discoverable and account_state = 'active';

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

create function public.current_worker_id() returns uuid
language sql stable security definer set search_path = ''
as $$ select w.id from public.workers w where w.user_id = auth.uid() and w.account_state = 'active' $$;
create function public.is_admin() returns boolean
language sql stable security definer set search_path = ''
as $$ select exists (select 1 from public.admin_principals a
  join public.user_accounts u on u.user_id=a.user_id
  where a.user_id=auth.uid() and u.account_state='active') $$;
create function public.is_active_employer_member(p_employer_id uuid) returns boolean
language sql stable security definer set search_path = ''
as $$ select exists (
  select 1 from public.employer_memberships m
  join public.employers e on e.id = m.employer_id
  join public.user_accounts u on u.user_id = m.user_id
  where m.employer_id = p_employer_id and m.user_id = auth.uid()
    and m.state = 'active' and e.verification_state = 'verified'
    and u.account_state = 'active'
) $$;
create function public.is_verified_employer(p_employer_id uuid) returns boolean
language sql stable security definer set search_path = ''
as $$ select exists (select 1 from public.employers e where e.id=p_employer_id and e.verification_state='verified') $$;

-- Application create serializes ALL applications for this worker, across tabs.
-- Exactly 20 IST-local date rows are allowed; withdrawn rows remain counted.
create function public.apply_to_job(p_job_id uuid)
returns table(application_id uuid, was_existing boolean)
language plpgsql security definer set search_path = ''
as $$
declare v_worker_id uuid; v_app public.job_applications%rowtype; v_today date; v_eligible_job uuid;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  select w.id into v_worker_id from public.workers w
    where w.user_id = auth.uid() and w.account_state = 'active' for update;
  if v_worker_id is null then raise exception 'Active worker profile required'; end if;
  -- Idempotent retry succeeds before rate counting; application is immutable.
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

create function public.submit_job(p_job_id uuid) returns void
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

create function public.review_job(p_job_id uuid, p_approve boolean, p_reason text) returns void
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

create function public.admin_set_job_state(p_job_id uuid, p_state public.job_state, p_reason text)
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

create function public.set_application_status(p_application_id uuid, p_status public.application_state)
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

create function public.ensure_application_conversation(p_application_id uuid) returns uuid
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

create function public.can_access_conversation(p_conversation_id uuid) returns boolean
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

create function public.send_message(p_conversation_id uuid,p_body text) returns uuid
language plpgsql security definer set search_path = ''
as $$ declare v_id uuid;
begin
  if auth.uid() is null or char_length(trim(p_body)) not between 1 and 4000 then raise exception 'Invalid message'; end if;
  if not public.can_access_conversation(p_conversation_id) then raise exception 'Conversation access denied'; end if;
  insert into public.messages(conversation_id,sender_id,body) values(p_conversation_id,auth.uid(),trim(p_body)) returning id into v_id;
  return v_id;
end $$;

create function public.mark_notification_read(p_notification_id uuid) returns void
language plpgsql security definer set search_path = ''
as $$ begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  update public.notifications set read_at=coalesce(read_at,clock_timestamp())
    where id=p_notification_id and user_id=auth.uid();
  if not found then raise exception 'Notification not found'; end if;
end $$;

create function public.admin_set_account_state(p_user_id uuid, p_state public.account_state, p_reason text)
returns void language plpgsql security definer set search_path = ''
as $$ begin
  if not public.is_admin() or p_state not in ('active','suspended') then raise exception 'Administrator access required or invalid state'; end if;
  update public.user_accounts set account_state=p_state where user_id=p_user_id;
  update public.workers set account_state=p_state where user_id=p_user_id;
  insert into public.audit_log(actor_id,action,entity_type,entity_id,details)
    values(auth.uid(),'account_state','user',p_user_id::text,jsonb_build_object('state',p_state,'reason',left(p_reason,500)));
end $$;

-- Default deny. Later migrations grant only intended authenticated entrypoints.
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
