-- UNEXECUTED — Migration 14 of 15. READ-ONLY diagnostics; no schema/data changes.
-- Run after preceding migrations. Results are observations, not proof of RLS
-- correctness; normal-user JWT negative testing and concurrency tests remain required.
select 'public tables missing RLS' as check_name, c.relname as finding
from pg_class c join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and c.relkind='r' and not c.relrowsecurity;

select 'expected table inventory' as check_name, t.table_name as finding
from (values ('user_accounts'),('workers'),('worker_preferences'),('employers'),
('employer_memberships'),('jobs'),('job_applications'),('saved_jobs'),('notifications'),
('conversations'),('conversation_participants'),('messages'),('worker_documents'),
('payment_orders'),('contact_unlocks'),('audit_log')) expected(table_name)
left join information_schema.tables t on t.table_schema='public' and t.table_name=expected.table_name
where t.table_name is null;

select 'application uniqueness constraint' as check_name, conname as finding
from pg_constraint where conrelid='public.job_applications'::regclass and contype='u';

select 'client grants on sensitive tables' as check_name, table_name || ':' || grantee || ':' || privilege_type as finding
from information_schema.role_table_grants
where table_schema='public' and grantee in ('anon','authenticated')
and table_name in ('admin_principals','job_applications','notifications','employer_memberships',
  'payment_orders','payment_events','job_entitlements','contact_unlocks','audit_log')
and privilege_type in ('INSERT','UPDATE','DELETE');

select 'public document bucket check' as check_name, id || ':' || public::text as finding
from storage.buckets where id='worker-private-documents';
