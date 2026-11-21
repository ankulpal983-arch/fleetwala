-- UNEXECUTED — Migration 13 of 15. Intentionally does not create fixture rows,
-- auth.users, fabricated identities, contacts, or fake published jobs.
-- Fixture insertion is disabled unless the operator sets the DB-local custom
-- setting fleetwala.allow_staging_fixtures = 'on' in an approved staging session.
-- This guard only provides a staging gate; owner must use approved staging
-- Auth UUIDs and non-contact test data. No fixture inserts are included here.
do $$
begin
  if current_setting('fleetwala.allow_staging_fixtures', true) = 'on'
     and current_setting('app.environment', true) = 'staging' then
    raise notice 'Staging fixture gate is enabled; this migration intentionally seeds no records.';
  else
    raise notice 'Fixture generation disabled. Set approved staging-only settings before separate fixture work.';
  end if;
end $$;
