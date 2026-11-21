# FleetWala Supabase database migrations

**Status: ALL 15 MIGRATIONS UNEXECUTED. This schema has not been connected to or
run against any Supabase project. It is not production-ready or security-verified.**

These are separate, ordered PostgreSQL scripts, not a migration runner and not
idempotent deploy scripts. Run once, in numeric order, against a newly created,
owner-approved **disposable/staging** Supabase project. Do not re-run a partially
applied file; inspect the project and restore/rebuild staging or prepare a new,
reviewed corrective migration. Do not edit a migration after it has been applied.
No credentials are present, and no connection, SQL execution, or production call
was made for this work.

## Order and scope

| # | File | Effect |
|---|---|---|
| 01 | `001_extensions_and_enums.sql` | PostgreSQL extension and application enums |
| 02 | `002_auth_profiles_and_roles.sql` | Supabase Auth-linked user accounts, organizations, memberships, owner-provisioned admin principals |
| 03 | `003_worker_profiles_and_preferences.sql` | Private worker profiles, opt-in discovery, preferences and skills |
| 04 | `004_jobs_and_moderation.sql` | Jobs, moderation history and employer verification reviews |
| 05 | `005_applications_saved_jobs.sql` | Applications/history, one-per-job uniqueness and saved jobs |
| 06 | `006_notifications_chat.sql` | Private notifications and application-linked text conversations |
| 07 | `007_storage_metadata.sql` | Private document bucket and metadata |
| 08 | `008_billing_and_unlocks.sql` | Disabled billing model, INR 99/INR 10 defaults, unique contact unlock ledger |
| 09 | `009_audit_and_support.sql` | Audit, support tickets and user reports |
| 10 | `010_indexes_triggers_and_functions.sql` | Indexes, auth trigger, secured helpers and transaction RPCs |
| 11 | `011_rls_policies.sql` | RLS, least-privilege grants and private Storage object policies |
| 12 | `012_views_and_safe_discovery.sql` | Anonymized, opt-in employer discovery RPC |
| 13 | `013_test_fixtures_staging_only.sql` | Disabled-by-default staging fixture gate; deliberately inserts no records |
| 14 | `014_database_verification.sql` | Read-only SQL diagnostics; output is not a security test |
| 15 | `015_data_retention_and_cleanup.sql` | No-op retention approval gate; no destructive automation |

## Prerequisites and owner-only provisioning

1. Create a new Supabase project for staging and ensure its Auth and Storage
   schemas are present. Back up the empty project state/schema before changes.
2. Sign into the Supabase Dashboard using a trusted project-owner account and
   open **SQL Editor**. Never paste service-role keys or database passwords into
   SQL, chat, source control, or browser code.
3. Paste/run each numbered file separately, verify the SQL Editor reports
   success, and record the result/version before proceeding. The SQL Editor may
   wrap a file in a transaction; do not assume every PostgreSQL/Supabase DDL or
   Storage operation is transactionally rolled back as a unit. If a run fails,
   stop and inspect actual schema state before continuing.
4. Organization, membership, and first-admin provisioning are deliberately
   unavailable to clients. After checking the real Supabase Auth UUID out of
   band, a trusted owner may insert a verified organization and its initial
   owner membership in the SQL Dashboard. To provision an administrator, a
   trusted owner inserts the Auth UUID into `public.admin_principals` and
   records a reason/provisioner. Never add a public signup/admin role field or
   trust user metadata for that decision. Initial SQL provisioning itself is
   outside these migrations.
5. Do not enable billing. Its setting defaults to false; there is no payment
   provider, checkout, webhook verifier, entitlement grant function, or live
   contact reveal implementation in these files. Prices are proposed schema
   defaults only until owner/legal approval and a real provider integration.

Example owner-only SQL Dashboard templates (replace every angle-bracket value
only after independently verifying the existing Auth UUID; these do not create
Auth users). First organization membership is active but the organization stays
pending verification and cannot post until an owner review changes that state:

```sql
with created as (
  insert into public.employers (legal_name, employer_type, created_by)
  values ('<verified legal organization name>', 'company', '<existing Auth UUID>'::uuid)
  returning id
)
insert into public.employer_memberships (employer_id, user_id, role, state)
select id, '<same existing Auth UUID>'::uuid, 'owner', 'active' from created;
```

After out-of-band admin approval and confirming the person has an existing Auth
account, a project owner may provision the initial admin (never run this through
an ordinary authenticated client):

```sql
insert into public.admin_principals (user_id, provisioned_by, reason)
values ('<approved existing Auth UUID>'::uuid, '<owner/operator identifier>', '<approval reference>');
```

## Important design/security behavior

- Supabase Auth is the only identity source (`auth.uid()`); an Auth insert gets a
  minimal `user_accounts` row through a trigger. Profiles refer to `auth.users`.
- Application RPC `apply_to_job(job_id)` locks the active worker row, returns a
  duplicate idempotently before counting, locks eligible job/employer records
  against concurrent pause/verification changes, counts all applications
  created on the current Asia/Kolkata local date (including withdrawn), and
  permits the 20th but rejects the 21st. Unique `(worker_id, job_id)` makes an
  application immutable and prevents reapplication. Timestamps use actual
  clock time at insert; test DST-independent IST midnight cases explicitly.
- Clients have no direct application insert/update privileges. Employer status
  transitions and worker withdrawal go through `set_application_status`.
- Job insertion/editing is limited to drafts. Submission and admin review use
  RPCs; application and moderation events are recorded in history/audit tables.
- Worker profile rows (including phone, email, photo path and address) are
  owner-only at the table level. Employer discovery is a separate RPC returning
  only an opaque candidate handle, city, category, experience and vehicle for
  opted-in, active workers. This is not a contact unlock or identity reveal.
- Text chat is application-linked and only enabled after shortlisting. Messages
  are read-only directly and written through a participant-checking RPC.
- Admin, membership, notification creation, application writes, payment rows,
  entitlements, unlock rows and audit records are not client-writable.
- All worker documents use a private bucket and owner-prefixed object keys.
  MIME/size allow-lists are configured, but actual file-content scanning,
  rate-limiting and secure signed-URL delivery must be implemented and verified
  in the trusted application boundary.

## Staging verification, backup and production gates

Migration 14 is a set of read-only diagnostics and can be run separately after
the schema is installed. It does **not** establish correct permissions. Before
any production consideration, independently test with ordinary worker A/B,
employer A/B, suspended users and admin JWTs (never service role) including
direct PostgREST table/RPC/Storage requests, PII leakage, opt-out, blocked
employer access, transitions, role injection and chat participant denial.
Exercise application calls with 20 successful distinct jobs, the 21st denied,
duplicate retry and concurrent requests across tabs, plus calls on either side
of IST midnight. Verify job pause/expiry races. Run the entire chain from an
empty disposable project, and review policies/functions with a qualified
PostgreSQL/Supabase security reviewer.

Before production changes, obtain owner approval, take a verified recoverable
backup and test its restoration in a separate project. Confirm migration state,
data ownership, RLS under real user JWTs, Auth redirect/SMS policy, Storage
policies, legal/privacy and retention decisions, support operations, payment
provider and incident response. Supabase SQL Editor is not a substitute for a
versioned migration deployment process or a tested rollback. Most schema changes
have no safe automatic rollback; forward-fix through a separately reviewed,
versioned migration. Never execute destructive SQL against production without
explicit written approval and a verified backup.

## Known unverified gaps / release blockers

- No file has been executed, parsed by PostgreSQL, or tested against Supabase.
- RLS/grants and `SECURITY DEFINER` behavior require an actual staging review.
- Employer onboarding/team invitation is owner-provisioned SQL only; no client
  org/membership creation RPC is provided by design.
- Payment processing and contact reveal are intentionally absent/disabled.
- Support ticket/report submission schema is present, but workflow/notifications
  and abuse rate limits need application implementation.
- Document bytes are not virus/content-scanned here; signed access, quotas and
  deletion workflow need owner-approved implementation.
- Retention/export/deletion policy is unresolved and no cleanup is scheduled.
- SQL-level rate limiting, OTP/SMS provider configuration, legal review and
  concurrency/security evidence remain outstanding.
