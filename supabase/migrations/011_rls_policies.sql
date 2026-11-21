-- UNEXECUTED — Migration 11 of 15. Prerequisite: 001–010.
-- Every public table is RLS-enabled; direct application, billing, entitlement,
-- membership and role writes are denied. No client can edit admin_principals.
alter table public.user_accounts enable row level security;
alter table public.employers enable row level security;
alter table public.employer_memberships enable row level security;
alter table public.admin_principals enable row level security;
alter table public.workers enable row level security;
alter table public.worker_preferences enable row level security;
alter table public.worker_skills enable row level security;
alter table public.jobs enable row level security;
alter table public.job_status_history enable row level security;
alter table public.employer_verification_reviews enable row level security;
alter table public.job_applications enable row level security;
alter table public.application_status_history enable row level security;
alter table public.saved_jobs enable row level security;
alter table public.notifications enable row level security;
alter table public.conversations enable row level security;
alter table public.conversation_participants enable row level security;
alter table public.messages enable row level security;
alter table public.worker_documents enable row level security;
alter table public.billing_settings enable row level security;
alter table public.payment_orders enable row level security;
alter table public.payment_events enable row level security;
alter table public.job_entitlements enable row level security;
alter table public.contact_unlocks enable row level security;
alter table public.payment_disputes enable row level security;
alter table public.audit_log enable row level security;
alter table public.support_tickets enable row level security;
alter table public.user_reports enable row level security;

create policy accounts_owner_read on public.user_accounts for select to authenticated using (user_id=auth.uid() or public.is_admin());
create policy accounts_owner_update on public.user_accounts for update to authenticated using (user_id=auth.uid()) with check (user_id=auth.uid() and account_state='active');
create policy employer_member_read on public.employers for select to authenticated using (public.is_active_employer_member(id) or public.is_admin());
create policy membership_self_read on public.employer_memberships for select to authenticated using (user_id=auth.uid() or public.is_admin());
create policy worker_owner_all on public.workers for all to authenticated
  using (user_id=auth.uid() or public.is_admin())
  with check (user_id=auth.uid() or public.is_admin());
create policy worker_preferences_owner_all on public.worker_preferences for all to authenticated
  using (worker_id=public.current_worker_id() or public.is_admin())
  with check (worker_id=public.current_worker_id() or public.is_admin());
create policy worker_skills_owner_all on public.worker_skills for all to authenticated
  using (worker_id=public.current_worker_id() or public.is_admin())
  with check (worker_id=public.current_worker_id() or public.is_admin());
create policy jobs_live_or_org_read on public.jobs for select to authenticated using (
  (state='published' and (expires_at is null or expires_at>now())
    and public.is_verified_employer(employer_id))
  or public.is_active_employer_member(employer_id) or public.is_admin()
);
create policy jobs_org_draft_insert on public.jobs for insert to authenticated
  with check (state='draft' and created_by=auth.uid() and public.is_active_employer_member(employer_id)
    and exists(select 1 from public.employer_memberships m where m.employer_id=jobs.employer_id
      and m.user_id=auth.uid() and m.role in ('owner','manager') and m.state='active'));
create policy jobs_org_draft_update on public.jobs for update to authenticated
  using (state='draft' and public.is_active_employer_member(employer_id))
  with check (state='draft' and public.is_active_employer_member(employer_id));
create policy job_history_admin_or_org_read on public.job_status_history for select to authenticated
  using (public.is_admin() or exists(select 1 from public.jobs j where j.id=job_id and public.is_active_employer_member(j.employer_id)));
create policy verification_admin_read on public.employer_verification_reviews for select to authenticated using (public.is_admin());
create policy applications_worker_or_employer_read on public.job_applications for select to authenticated using (
  worker_id=public.current_worker_id() or public.is_admin()
  or exists(select 1 from public.jobs j where j.id=job_id and public.is_active_employer_member(j.employer_id))
);
create policy application_history_authorized_read on public.application_status_history for select to authenticated using (
  public.is_admin() or exists(select 1 from public.job_applications a where a.id=application_id
    and (a.worker_id=public.current_worker_id() or exists(select 1 from public.jobs j where j.id=a.job_id and public.is_active_employer_member(j.employer_id))))
);
create policy saved_jobs_owner_all on public.saved_jobs for all to authenticated
  using (worker_id=public.current_worker_id()) with check (
    worker_id=public.current_worker_id() and exists(select 1 from public.jobs j where j.id=job_id
      and j.state='published' and (j.expires_at is null or j.expires_at>now()))
  );
create policy notifications_owner_read on public.notifications for select to authenticated using (user_id=auth.uid() or public.is_admin());
create policy conversation_participant_read on public.conversations for select to authenticated using
  (public.can_access_conversation(id) or public.is_admin());
create policy participants_self_read on public.conversation_participants for select to authenticated using
  ((user_id=auth.uid() and public.can_access_conversation(conversation_id)) or public.is_admin());
create policy messages_participant_read on public.messages for select to authenticated using
  (public.can_access_conversation(conversation_id) or public.is_admin());
create policy documents_owner_read on public.worker_documents for select to authenticated
  using (worker_id=public.current_worker_id() or public.is_admin());
create policy documents_owner_insert on public.worker_documents for insert to authenticated
  with check (worker_id=public.current_worker_id()
    and (storage_path like auth.uid()::text || '/%'));
create policy billing_settings_admin_read on public.billing_settings for select to authenticated using (public.is_admin());
create policy payment_orders_owner_read on public.payment_orders for select to authenticated using
  (public.is_admin() or public.is_active_employer_member(employer_id));
create policy payment_events_admin_read on public.payment_events for select to authenticated using (public.is_admin());
create policy entitlements_admin_read on public.job_entitlements for select to authenticated using (public.is_admin());
create policy unlocks_admin_read on public.contact_unlocks for select to authenticated using (public.is_admin());
create policy disputes_owner_admin_read on public.payment_disputes for select to authenticated
  using (public.is_admin() or raised_by=auth.uid());
create policy audit_admin_read on public.audit_log for select to authenticated using (public.is_admin());
create policy support_owner_admin_read on public.support_tickets for select to authenticated
  using (opened_by=auth.uid() or public.is_admin());
create policy reports_owner_admin_read on public.user_reports for select to authenticated
  using (reporter_id=auth.uid() or public.is_admin());
create policy support_owner_insert on public.support_tickets for insert to authenticated
  with check (opened_by=auth.uid() and (employer_id is null or public.is_active_employer_member(employer_id)));
create policy reports_owner_insert on public.user_reports for insert to authenticated
  with check (reporter_id=auth.uid());

-- Revoke default/legacy table access first, then grant the minimum read/write surface.
revoke all on all tables in schema public from anon, authenticated;
grant select on public.user_accounts to authenticated;
grant update (display_label) on public.user_accounts to authenticated;
grant select on public.employers, public.employer_memberships to authenticated;
grant select on public.workers to authenticated;
grant insert (user_id, full_name, phone_e164, email, photo_path, address_line, city, postal_code,
  category, experience_band, vehicle_type, has_own_vehicle, fuel_support_required, discoverable, availability)
  on public.workers to authenticated;
grant update (full_name, phone_e164, email, photo_path, address_line, city, postal_code, category,
  experience_band, vehicle_type, has_own_vehicle, fuel_support_required, discoverable, availability)
  on public.workers to authenticated;
grant select, insert, update, delete on public.worker_preferences, public.worker_skills to authenticated;
grant select on public.jobs to authenticated;
grant insert (employer_id, created_by, title, category, description, city, area, postal_code,
  work_address, salary_min_inr, salary_max_inr, requires_driving_licence, expires_at)
  on public.jobs to authenticated;
grant update (title, category, description, city, area, postal_code, work_address,
  salary_min_inr, salary_max_inr, requires_driving_licence, expires_at) on public.jobs to authenticated;
grant select on public.job_status_history, public.employer_verification_reviews,
  public.job_applications, public.application_status_history, public.conversations,
  public.conversation_participants, public.messages, public.worker_documents,
  public.billing_settings, public.payment_orders, public.payment_events,
  public.job_entitlements, public.contact_unlocks, public.payment_disputes,
  public.audit_log, public.support_tickets, public.user_reports to authenticated;
grant select, insert, delete on public.saved_jobs to authenticated;
grant select, insert on public.worker_documents to authenticated;
grant select on public.notifications to authenticated;
grant insert (opened_by, employer_id, subject, details) on public.support_tickets to authenticated;
grant insert (reporter_id, reported_user_id, job_id, details) on public.user_reports to authenticated;
-- Storage path is owner UUID followed by a filename; bucket is never public.
create policy worker_documents_object_insert on storage.objects for insert to authenticated
  with check (bucket_id='worker-private-documents' and (storage.foldername(name))[1]=auth.uid()::text);
create policy worker_documents_object_read on storage.objects for select to authenticated
  using (bucket_id='worker-private-documents' and ((storage.foldername(name))[1]=auth.uid()::text
    or public.is_admin()));
create policy worker_documents_object_delete on storage.objects for delete to authenticated
  using (bucket_id='worker-private-documents' and (storage.foldername(name))[1]=auth.uid()::text);

-- Function execution privileges are explicitly narrow; owner-only helpers remain unavailable.
grant execute on function public.current_worker_id(), public.is_admin(), public.is_active_employer_member(uuid),
  public.is_verified_employer(uuid), public.can_access_conversation(uuid) to authenticated;
grant execute on function public.apply_to_job(uuid), public.submit_job(uuid),
  public.set_application_status(uuid,public.application_state), public.send_message(uuid,text),
  public.mark_notification_read(uuid), public.review_job(uuid,boolean,text),
  public.admin_set_job_state(uuid,public.job_state,text),
  public.admin_set_account_state(uuid,public.account_state,text) to authenticated;
