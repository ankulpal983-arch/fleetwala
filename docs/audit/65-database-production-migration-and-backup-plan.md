# FleetWala Production Database Migration, Separation & Backup Plan

**Document:** `docs/audit/65-database-production-migration-and-backup-plan.md`  
**Audit Date:** 2026-11-26  
**Phase:** Phase 2 & Phase 9 — Database Security, Staging/Production Separation & Disaster Recovery  
**Branch:** `real-preproduction-conversion`  
**Analyzed Remote Project:** `jigbzsaaowtyaqhreplg`

---

## 1. Current Remote Database Security & Schema Audit (`jigbzsaaowtyaqhreplg`)

### 1.1 Row Level Security & Storage Status
- All **28 tables** in `public` have `relrowsecurity = true`:
  `admin_principals`, `application_status_history`, `audit_log`, `billing_settings`, `candidate_invitations`, `contact_unlocks`, `conversation_participants`, `conversations`, `employer_memberships`, `employer_verification_reviews`, `employers`, `job_applications`, `job_entitlements`, `job_status_history`, `jobs`, `messages`, `notifications`, `payment_disputes`, `payment_events`, `payment_orders`, `saved_jobs`, `support_tickets`, `user_accounts`, `user_reports`, `worker_documents`, `worker_preferences`, `worker_skills`, `workers`.
- Private Storage Bucket: `worker-private-documents` (`public = false`) protected by folder-prefix policies scoping `auth.uid()::text` or `is_admin()`.
- Billing guard: `public.billing_settings` singleton has `enabled = false`, `job_posting_price_inr = 99`, `candidate_unlock_price_inr = 10`.

### 1.2 Live Privilege & RPC Findings Resolved in Staged Migration `027`
The remote read-only catalog inspection identified the following gaps, now addressed in `supabase/migrations/027_predeployment_security_and_rls_hardening.sql` (staged; awaiting owner confirmation `--yes` before remote execution because it modifies live grants on `jigbzsaaowtyaqhreplg`):

| Finding | Remote State (`jigbzsaaowtyaqhreplg`) | Remediation in Migration `027` |
|---|---|---|
| **P0 Over-permissive ACL** | `public.candidate_invitations` holds `anon=arwdDxtm/postgres`, `authenticated=arwdDxtm/postgres` | `REVOKE ALL` from `public, anon, authenticated`; `GRANT SELECT` only to `authenticated` |
| **P0 Broken Support Insert** | `public.support_tickets` holds `authenticated=r/postgres` (blocks authenticated ticket creation despite `support_owner_insert` RLS) | Column-scoped `GRANT INSERT (opened_by, employer_id, subject, details)` to `authenticated` + `admin_update_support_ticket` RPC |
| **P1 Bootstrap Exposure** | `public.bootstrap_admin(text)` grants `EXECUTE` to `authenticated` | `REVOKE ALL` from `public, anon, authenticated`; grant `EXECUTE` only to `postgres, service_role` |
| **P0 Applicant Anonymity & Join** | Direct employer `workers(...)` join blocked by `worker_owner_select` RLS (`FW-CANDIDATE` fallback) | `get_employer_applicants(p_employer_id)` RPC returning SHA-256 `FW-XXXXXX` handle + anonymized summary even when `discoverable = false` |
| **P0 Worker Application Visibility** | `jobs`/`employers` RLS hides paused/closed job info & employer `legal_name` on worker `/applications` | `get_worker_applications()` RPC scoped strictly to `current_worker_id()` |
| **P0 Settings Overwrite Risk** | Updating discoverability previously re-submitted whole worker profile | Dedicated `set_worker_discoverability(p_discoverable)` updating only consent timestamp & flag |
| **P1 Invitation Hardening** | `create_candidate_invitation` / `create_application_invitation` lacked verified-employer check; `respond_to_candidate_invitation` hardcoded `old_status = 'applied'` | Enforced `verification_state = 'verified'` and recorded actual prior status in `application_status_history` |

### 1.3 Pending Owner-Only Staging Cleanup (`admin_principals`)
- `public.admin_principals` currently contains:
  - `4346529e-a380-47ea-a0b1-f4890000bfb8` (`ankulpalwork@gmail.com` — owner designated administrator)
  - `11111111-1111-1111-1111-111111111111` (`admin-staging-e2e@fleetwala.internal` — `staging_test_bootstrap`, referenced by `audit_actor = 2` historical `audit_log` rows and `0` `jobs_reviewed` rows)
- **Explicit Owner Action Required before Production Cutover:**
  ```sql
  DELETE FROM public.admin_principals
  WHERE user_id = '11111111-1111-1111-1111-111111111111';
  ```
  *(Deleting from `admin_principals` revokes admin privileges without breaking foreign keys on historical `audit_log` rows.)*

---

## 2. Staging vs. Production Database Separation Strategy

1. **Keep `jigbzsaaowtyaqhreplg` as Controlled Staging / Pre-Production** OR follow clean isolation:
   - **Recommended Production Topology:** Create a dedicated **Production Supabase project** (Asia South `ap-south-1` Mumbai recommended for Indian latency & DPDP alignment) before accepting public customers, while keeping `jigbzsaaowtyaqhreplg` for localhost & Vercel staging previews.
   - **Strict Data Segregation Policy:** Never bulk-copy real user PII, staging passwords, or synthetic accounts from `jigbzsaaowtyaqhreplg` into a separate Production project without explicit owner authorization and data-subject consent. Fresh production accounts should register organically, and the owner admin account should be provisioned cleanly in `public.admin_principals` via Supabase SQL Editor / `service_role`.

---

## 3. Exact Migration Application Order

### 3.1 Fresh Production Project Bootstrap Order
Apply sequentially via Supabase SQL / CLI (`013` **must be excluded** on production):
1. `001_extensions_and_enums.sql` through `012_views_and_safe_discovery.sql`
2. **SKIP** `013_test_fixtures_staging_only.sql` *(Staging fixtures only — never apply in production)*
3. **READ-ONLY CHECK:** `014_database_verification.sql`
4. **DO NOT AUTOMATE:** `015_data_retention_and_cleanup.sql` *(Release gate marker pending owner legal retention sign-off)*
5. `016_employer_registration_and_membership.sql`
6. `017_worker_profile_permissions_and_live_integration.sql`
7. `018_admin_workflows_and_notifications.sql`
8. `019_employer_membership_and_job_creation_fix.sql`
9. `020_submit_job_and_workflow_hardening.sql`
10. `021_security_discovery_alias_and_privacy_hardening.sql`
11. `022_public_job_discovery_for_visitors.sql`
12. `023_admin_provisioning_and_invitations.sql`
13. `024_hiring_chat_job_visibility_and_invitations.sql`
14. `025_fix_invitation_schema_and_remove_test_fixtures.sql`
15. `026_candidate_discovery_locality_and_anonymization_fix.sql`
16. `027_predeployment_security_and_rls_hardening.sql`

### 3.2 Existing `jigbzsaaowtyaqhreplg` Migration History Reconciliation
- `supabase_migrations.schema_migrations` on `jigbzsaaowtyaqhreplg` currently records `"001"`–`"016"` only; `017`–`026` were applied out-of-band.
- When the owner authorizes Migration `027`:
  1. Run `027_predeployment_security_and_rls_hardening.sql` once (never re-run `013` or older DDL scripts blindly).
  2. Reconcile CLI tracking with:
     `supabase migration repair --status applied 017 018 019 020 021 022 023 024 025 026 027`

---

## 4. Storage, Auth, Secrets, Backup & Restore Plan

- **Storage Bucket (`worker-private-documents`):** Confirm `public = false`, max MIME enforcement (`application/pdf`, `image/jpeg`, `image/png`, `<= 10 MiB`), and object policies scoped to `auth.uid()::text`.
- **Auth Provisioning:** Seed initial production admin directly in SQL (`INSERT INTO public.user_accounts ...` + `INSERT INTO public.admin_principals ...`) rather than re-opening `bootstrap_admin`.
- **Secret Management:** Keep `SUPABASE_SERVICE_ROLE_KEY`, database password, and future gateway webhook secrets strictly out of `.env.local`, Git, and Vercel `VITE_*` variables. Store server-only credentials exclusively in Render Secret Environment Variables.
- **Backup & Restore:**
  - Before any production schema migration (`027` or future): trigger an on-demand backup / `pg_dump --schema=public --format=custom` snapshot (encrypted at rest by owner).
  - Verify Supabase plan provides automated daily backups and enable Point-in-Time Recovery (PITR) prior to public launch.
  - Quarterly Staging Restore Drill: restore latest backup into a temporary staging project and verify `014_database_verification.sql` + anonymized RLS smoke tests pass.
