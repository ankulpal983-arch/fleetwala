# FleetWala Production Database Initialization Guide

This folder contains the **clean-room, non-staging production initialization baseline** for a dedicated Production Supabase project (`ap-south-1` Mumbai recommended).

## Why Staging Incremental Files (`supabase/migrations/001..026`) Are Not Run Verbatim on Fresh Production

Several incremental staging migrations in `supabase/migrations/` contain staging-specific provenance checks or data operations:
- `013_test_fixtures_staging_only.sql`: Staging fixture gate notice.
- `018_admin_workflows_and_notifications.sql`: Includes `admin_grant_staging_job_waiver` (staging billing waiver).
- `019_employer_membership_and_job_creation_fix.sql`: References hardcoded staging owner/org UUIDs (`5733aa5f-...`, `6e7c9a06-...`).
- `023_admin_provisioning_and_invitations.sql`: References owner staging admin email lookup.
- `025_fix_invitation_schema_and_remove_test_fixtures.sql` & `026_candidate_discovery_locality_and_anonymization_fix.sql`: Execute `RAISE EXCEPTION` pre/post-checks expecting staging row UUIDs (`af42f70c-...`, `761d0d18-...`).

Instead, `supabase/production/001_production_baseline_schema.sql` consolidates the hardened production schema (equivalent to `001`–`027` with zero hardcoded UUIDs, zero staging emails, zero fixture records, zero staging job waivers, sanitized `workers.locality`, and collision-resistant SHA-256 `candidate_handle` enforcement).

## Initialization Procedure (When Owner Authorizes Production Project)

1. Provision a new Production Supabase project (do **not** copy staging PII or test accounts).
2. Enable `pgcrypto` (schema `extensions`) and verify Supabase `auth` and `storage` schemas exist.
3. Run `supabase/production/001_production_baseline_schema.sql` once in the Supabase Dashboard SQL Editor or CLI.
4. Run read-only schema diagnostics (`supabase/migrations/014_database_verification.sql`).
5. Sign in once with the owner administrator's production Google/email account, verify the exact UUID in `Authentication -> Users`, and provision the initial administrator out-of-band:

```sql
insert into public.user_accounts (user_id, account_state)
values ('<OWNER_PRODUCTION_AUTH_UUID>'::uuid, 'active')
on conflict (user_id) do update set account_state = 'active';

insert into public.admin_principals (user_id, provisioned_by, reason)
values ('<OWNER_PRODUCTION_AUTH_UUID>'::uuid, 'owner_production_bootstrap', 'Designated production administrator')
on conflict (user_id) do nothing;
```

6. Keep `public.billing_settings.enabled = false` until Razorpay/Cashfree KYC and signed webhook verification are deployed on Render.
