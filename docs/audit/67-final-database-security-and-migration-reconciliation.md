# FleetWala Final Database Security, Privacy & Migration Reconciliation Audit

**Document:** `docs/audit/67-final-database-security-and-migration-reconciliation.md`  
**Audit Date:** 2026-11-26  
**Repository / Branch:** `ankulpal983-arch/fleetwala` (`real-preproduction-conversion`)  
**Remote Staging Database Audited:** `jigbzsaaowtyaqhreplg`  
**Status:** COMPLETED — Remote Migration `027` Live, Staging Admin Removed, History Reconciled (`001`–`027`), Clean Production Baseline Verified in PostgreSQL 18

---

## 1. Pre-Change Backup & Rollback Safety (Phase 1)

Before applying any remote SQL changes on `jigbzsaaowtyaqhreplg`, a read-only catalog, ACL, policy, and record snapshot was exported outside the Git repository to prevent any accidental leakage of personal data or credentials:

- **Backup Artifact (Outside Git):** `C:\Users\ankul\.gemini\antigravity\brain\1f38b1fa-6ee7-4b6f-8086-2679505c5eb1\scratch\db_backup_pre_027\full_pre_027_backup.json`
- **Captured Pre-027 Counts:** `35` functions (exact `pg_proc` ACLs & bodies), `41` RLS policies, `1` employer (`flipkart`), `1` job (`delivery hiring for delhi ncr`), `2` workers (`Dwarka`, `Gurugram Sec 18`), `1` application, `1` conversation, `4` messages, `3` invitations.
- **Rollback Readiness:** Pre-027 function definitions, ACLs, and row counts are preserved in `full_pre_027_backup.json` so any regression can be rolled back forward/transactional SQL without truncating tables, dropping schemas, or resetting user data.

---

## 2. Migration History Reconciliation Matrix (`001`–`027`)

Prior to this clearance pass, remote `supabase_migrations.schema_migrations` tracked only `001`–`016`, while `017`–`026` had been executed directly against staging. Each unrecorded file (`017`–`026`) was audited against live `pg_class`, `pg_proc`, `pg_policies`, and `pg_class.relacl` before running `npx supabase migration repair`.

| Version | Migration File | Remote Verification Before Repair | Action Taken on `jigbzsaaowtyaqhreplg` | Production Portability Assessment |
|---|---|---|---|---|
| `001`–`012` | Core enums, tables, triggers, RPCs, RLS, `discover_workers` | Already tracked in `schema_migrations` & active | Preserved | Portable |
| `013` | `013_test_fixtures_staging_only.sql` | Tracked (`schema_migrations`), staging gate only (no rows) | Preserved | **Exclude in fresh Prod** |
| `014` | `014_database_verification.sql` | Tracked (read-only diagnostics) | Preserved | Post-init check only |
| `015` | `015_data_retention_and_cleanup.sql` | Tracked (retention gate marker, no-op) | Preserved | Exclude/gate marker |
| `016` | `016_employer_registration_and_membership.sql` | Tracked (`register_employer`, `is_active_employer_member` active) | Preserved | Portable |
| `017` | `017_worker_profile_permissions_and_live_integration.sql` | Verified `save_worker_profile` & `workers` policies live in catalog | Repaired (`applied`) | Superseded by `027` column ACLs |
| `018` | `018_admin_workflows_and_notifications.sql` | Verified `admin_review_employer`, `review_job`, `admin_assign_admin`, `admin_grant_staging_job_waiver` live | Repaired (`applied`) | **Exclude `admin_grant_staging_job_waiver` in Prod** |
| `019` | `019_employer_membership_and_job_creation_fix.sql` | Verified `get_current_employer_org` & updated `register_employer` live | Repaired (`applied`) | **Non-portable** (hardcodes staging UID `5733aa5f-...` & org `6e7c9a06-...`) |
| `020` | `020_submit_job_and_workflow_hardening.sql` | Verified `submit_job` & `jobs_org_draft_update` live | Repaired (`applied`) | Superseded by `027` column ACLs |
| `021` | `021_security_discovery_alias_and_privacy_hardening.sql` | Verified `discover_candidates` & Storage policies live | Repaired (`applied`) | Consolidated into prod baseline |
| `022` | `022_public_job_discovery_for_visitors.sql` | Verified `get_public_published_jobs` & anon revocation on `jobs`/`employers` live | Repaired (`applied`) | Superseded by `024` verified check |
| `023` | `023_admin_provisioning_and_invitations.sql` | Verified `candidate_invitations` table & invitation RPCs live | Repaired (`applied`) | **Staging-specific admin email lookup** |
| `024` | `024_hiring_chat_job_visibility_and_invitations.sql` | Verified `application_id` column, `update_employer_job_state`, `send_message`, `get_user_conversations` live | Repaired (`applied`) | Superseded by `025`/`027` |
| `025` | `025_fix_invitation_schema_and_remove_test_fixtures.sql` | Verified repaired invitation RPCs (`legal_name`, valid `notifications` schema) & deleted staging orgs live | Repaired (`applied`) | **Fails on fresh DB** (`RAISE EXCEPTION` staging UUID pre/post-checks) |
| `026` | `026_candidate_discovery_locality_and_anonymization_fix.sql` | Verified area-filtered `discover_workers`/`discover_candidates` live | Repaired (`applied`) | **Fails on fresh DB** (`RAISE EXCEPTION` checks expecting `'Ankul'`/`'Dwarka'`) |
| `027` | `027_predeployment_security_and_rls_hardening.sql` | Reviewed, tested in disposable PostgreSQL 18, owner-approved (`--yes`), applied & repaired | **Applied live + tracked (`27/27`)** | Clean & portable DDL/ACL/RPC hardening |

Result of `npx supabase migration list --remote`: **`27 / 27` versions (`001`–`027`) match cleanly** between local files and remote `supabase_migrations.schema_migrations`.

---

## 3. Remote Security, Privacy & Identifier Remediation (`Migration 027` Live State)

With explicit owner approval, [027_predeployment_security_and_rls_hardening.sql](file:///d:/Downloads/Fleet-Wala-Builder/Fleet-Wala-Builder/supabase/migrations/027_predeployment_security_and_rls_hardening.sql) was executed against `jigbzsaaowtyaqhreplg` and verified read-only:

| Area | Pre-027 Vulnerability | Post-027 Verified Live State (`jigbzsaaowtyaqhreplg`) |
|---|---|---|
| **`candidate_invitations` ACL** | `anon=arwdDxtm`, `authenticated=arwdDxtm` (excessive table grants) | `postgres=arwdDxtm \| service_role=arwdDxtm \| authenticated=r`. Zero `anon` privileges; all writes strictly via `SECURITY DEFINER` RPCs. |
| **Identity Sequences ACL** | `anon=rwU`, `authenticated=rwU` on `application_status_history_id_seq`, `audit_log_id_seq`, `employer_verification_reviews_id_seq`, `job_status_history_id_seq` | `postgres=rwU \| service_role=rwU`. Zero `anon` or `authenticated` grants on all 4 audit/history sequences. |
| **`support_tickets` ACL** | `authenticated=r` (blocked legitimate authenticated support/DPDP ticket submission despite `support_owner_insert` RLS) | `authenticated=r` + column-scoped `INSERT (opened_by, employer_id, subject, details)` + admin status transition RPC `admin_update_support_ticket`. |
| **`workers` & `jobs` Column Grants** | Table-wide `authenticated=arw` from `017`/`020` bypassed column scoping | Restored least-privilege column-scoped `INSERT`/`UPDATE` in `pg_attribute.attacl`: `workers.account_state` is excluded from `UPDATE`; `jobs.state` (excluded from `UPDATE`), `reviewed_by`, and `reviewed_at` are locked against client mutation. |
| **`bootstrap_admin(text)` ACL** | `authenticated=X` callable by signed-in non-admin users if `admin_principals` were empty | Revoked from `public, anon, authenticated`; granted exclusively to `postgres, service_role`. |
| **Candidate Locality Privacy** | `discover_workers` & `get_employer_applicants` projected raw `w.address_line` directly | Added dedicated `public.workers.locality` column + `sanitize_locality` & `safe_worker_locality` (`SET search_path = ''`, filtering out emails, `@/#/`, `>=4` consecutive digits, house/flat/plot/gali/street markers while preserving legitimate neighbourhoods like `Dwarka` and `Gurugram Sec 18`). Both workers backfilled non-destructively (`761d0d18` $\to$ `Dwarka`, `8b91c8eb` $\to$ `Gurugram Sec 18`). |
| **Cryptographic Candidate Handles** | `create_candidate_invitation` accepted raw `w.id::text` & `cand-<uuid8>`; `create_application_invitation` stored `'cand-' \|\| substr(w.id, 1, 8)` | Both RPCs strictly enforce/emit 64-character lowercase SHA-256 hex `candidate_handle` (`^[0-9a-f]{64}$`); raw `w.id` fallback matching removed in SQL and `repo.ts` (`FW-CANDIDATE` fallback without `worker.id`). |
| **PostgREST RPC Ambiguity (`PGRST203`)** | Duplicate 5-arg & 6-arg defaulted `discover_workers` / `discover_candidates` caused HTTP `300 Multiple Choices` | Dropped obsolete 5-arg overloads; verified single canonical 6-arg `discover_workers` & `discover_candidates` (`42501` denied to `anon`, `authenticated=X`). |
| **`anon` Function Surface** | Verified all 35+ public routines | Only `public.get_public_published_jobs()` grants `EXECUTE` to `anon` (returns strictly `state = 'published'`, unexpired jobs of `'verified'` employers). |

---

## 4. Synthetic Staging Admin Removal & Genuine Data Integrity (Phase 4)

- **Provenance Verified Before Removal:**
  - `11111111-1111-1111-1111-111111111111` (`admin-staging-e2e@fleetwala.internal`): `provisioned_by = 'staging_test_bootstrap'`, `reason = 'Staging E2E Test Suite'`, `created_at = null`, `last_sign_in_at = null`.
  - `4346529e-a380-47ea-a0b1-f4890000bfb8` (`ankulpalwork@gmail.com`): `provisioned_by = 'owner_designation'`, `reason = 'Owner designated platform administrator'`.
- **Approved Action Executed:**
  ```sql
  DELETE FROM public.admin_principals
  WHERE user_id = '11111111-1111-1111-1111-111111111111';
  ```
- **Post-Cleanup Verification:**
  - `public.admin_principals` contains **only** `4346529e-a380-47ea-a0b1-f4890000bfb8` (`owner_designation`).
  - Historical `public.audit_log` rows remain intact (`38` records preserved).
  - All genuine data verified intact (`employers = 1` [`flipkart`], `jobs = 1` [`delivery hiring for delhi ncr`], `workers = 2` [`Dwarka` & `Gurugram Sec 18`], `job_applications = 1`, `conversations = 1`, `messages = 4`, `candidate_invitations = 3`, `notifications = 37`, `rls_enabled_tables = 28`, `tables_missing_rls = 0`).

---

## 5. Clean-Room Production Schema Strategy (Phase 7)

Because `supabase/migrations/013`, `018`, `019`, `023`, `025`, and `026` rely on staging-only entities or waivers that fail or should not exist on a fresh public production project, a clean, portable baseline was authored at:

- [supabase/production/001_production_baseline_schema.sql](file:///d:/Downloads/Fleet-Wala-Builder/Fleet-Wala-Builder/supabase/production/001_production_baseline_schema.sql)
- [supabase/production/README.md](file:///d:/Downloads/Fleet-Wala-Builder/Fleet-Wala-Builder/supabase/production/README.md)

### Clean Production Properties Verified in Local PostgreSQL 18 (`WSL` Port `5433`)
- Creates all `9` custom enums and `28` public RLS-enabled tables (including `workers.locality`), `13` custom secondary/partial unique indexes, private `worker-private-documents` Storage bucket/policies, and all RPCs with `SET search_path = ''`.
- Seeds **0** users, **0** admins, **0** employers, **0** jobs, **0** staging waivers (`admin_grant_staging_job_waiver` omitted), **0** staging UUIDs, and keeps `public.billing_settings.enabled = false` (`₹99` posting / `₹10` unlock defaults).
- **Important Compatibility Caveat:** Local PostgreSQL 18 validates standard DDL, RLS policies, column grants, and PL/pgSQL RPC semantics cleanly; it does **not** prove hosted Supabase GoTrue OAuth token issuance, PgBouncer transaction pooler behavior, PostgREST schema reload timing, or hosted Storage signed URL endpoints. Full verification against the live hosted Production Supabase project remains mandatory after provisioning.
