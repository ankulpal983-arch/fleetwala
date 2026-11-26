# FleetWala Final Pre-Deployment Baseline & Risk Assessment

**Document:** `docs/audit/62-pre-deployment-baseline-and-risk-assessment.md`  
**Audit Date:** 2026-11-26  
**Phase:** Phase 0 — Baseline Verification & Change Control  
**Branch:** `real-preproduction-conversion`  
**Baseline Git HEAD:** `b20c08748ccbc0c7a83566bbba8f34bb24cda2c1` (`b20c087`)  
**Supabase Project Ref:** `jigbzsaaowtyaqhreplg`

---

## 1. Environment & Repository Baseline

| Check | Verified Value | Notes |
|---|---|---|
| **Local Repository** | `D:\Downloads\Fleet-Wala-Builder\Fleet-Wala-Builder` | Verified workspace root with `package.json` & `pnpm-workspace.yaml` |
| **Active Git Branch** | `real-preproduction-conversion` | Confirmed before any modification |
| **Git HEAD (baseline)** | `b20c08748ccbc0c7a83566bbba8f34bb24cda2c1` | Commit: `fix(employer): import ShieldCheck icon in employer.tsx and add browser candidate discovery regression tests` |
| **Working Tree** | Clean at baseline | `.env.local` untracked & ignored via `.gitignore` |
| **Node.js Version** | `v22.22.2` | Active runtime via nvm installs path |
| **pnpm Version** | `12.21.0` | Monorepo package manager |
| **Frontend Package** | `@workspace/fleetwala` (`artifacts/fleetwala`) | React 19, Vite 7, TypeScript, Wouter, TanStack Query, Tailwind CSS 4 |
| **Backend Package** | `@workspace/api-server` (`artifacts/api-server`) | Express 5, Node.js, esbuild (`dist/index.mjs`) |
| **`.env.local` Keys Present** | `PORT`, `BASE_PATH`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_ENABLE_LIVE` | No `SUPABASE_SERVICE_ROLE_KEY` or secret credentials exposed in client env |

Recent 5 commits on `real-preproduction-conversion`:
- `b20c087` — `fix(employer): import ShieldCheck icon in employer.tsx and add browser candidate discovery regression tests`
- `c2bb1dc` — `fix(discovery): reconcile FW-492E4A to genuine Ankul worker, add Dwarka locality filtering, eliminate static Ghar-Tak references`
- `f56569f` — `fix(invitations): resolve trade_name schema error, purge staging test fixtures, and preserve genuine records`
- `6068843` — `feat(hiring): complete real two-way chat, job pause/close visibility gates, and application invitations`
- `0e47827` — `feat(core): complete real-world three-account hiring workflows, candidate invitations, and admin provisioning`

---

## 2. Remote Database & Migration Baseline (`jigbzsaaowtyaqhreplg`)

### 2.1 Migration History Drift
- **`supabase_migrations.schema_migrations` recorded versions:** `"001"` through `"016"` (16 rows).
- **Local `supabase/migrations/` files:** `001` through `026` (26 numbered migrations, plus `consolidated_staging_migration.sql`).
- **Finding:** Migrations `017`–`026` were executed out-of-band via direct SQL query rather than tracked via `supabase db push` / `schema_migrations`, causing `supabase migration list --remote` to show `017`–`026` as blank remotely despite their tables, columns, and RPCs existing in Postgres. **Do not re-run `013`–`026` on `jigbzsaaowtyaqhreplg`.**

### 2.2 Live Record & Schema Snapshot (Read-Only Baseline)
- **Tables in `public`:** 28 tables, **28/28 have `relrowsecurity = true`**.
- **Storage buckets:** `worker-private-documents` (`public = false`).
- **Billing settings singleton:** `enabled = false`, `job_posting_price_inr = 99`, `candidate_unlock_price_inr = 10`.
- **Live entity counts:**
  - `employers`: `1` (genuine Flipkart org preserved)
  - `jobs`: `1` (genuine Delhi NCR hiring job preserved)
  - `workers`: `2` (genuine Ankul Dwarka profile preserved alongside second account)
  - `job_applications`: `1` (genuine `6ed9e756-...` application preserved)
  - `conversations`: `1` / `messages`: `4` (genuine hiring conversation preserved)
  - `candidate_invitations`: `3`
  - `audit_log`: `38`
  - `notifications`: `37`
  - `support_tickets`: `0`
- **Admin principals (`public.admin_principals`):**
  1. `4346529e-a380-47ea-a0b1-f4890000bfb8` — `ankulpalwork@gmail.com` (`provisioned_by = 'owner_designation'`)
  2. `11111111-1111-1111-1111-111111111111` — `admin-staging-e2e@fleetwala.internal` (`provisioned_by = 'staging_test_bootstrap'`, `audit_actor = 2`, `jobs_reviewed = 0`, `auth_user = 1`)

---

## 3. Baseline P0 / P1 Risk Register & Repair Scope

| ID | Sev | Area | Verified Baseline Defect | Planned Remediation & Impact |
|---|---|---|---|---|
| **RISK-01** | **P0** | Authentication | `artifacts/fleetwala/src/lib/auth-context.tsx` honors `localStorage.getItem('fleetwala_test_auth') === 'employer'` to forge an authenticated Flipkart employer session in app code. | Remove bypass completely from `auth-context.tsx`; update browser scripts so they never rely on client auth bypasses. |
| **RISK-02** | **P0** | Backend Security | `artifacts/api-server/src/app.ts` allows every origin (`else callback(null, true)`) plus wildcard `*.vercel.app` with `credentials: true`; lacks rate limit, JSON body size cap, security headers, global error handler, and graceful shutdown. | Enforce fail-closed CORS allowlist (`https://fleetwala.app`, `https://www.fleetwala.app`, `http://localhost:3000`, explicit `CORS_ORIGIN`), add body size limit (`100kb`), rate limit, headers, error handler, and `SIGTERM`/`SIGINT` shutdown. |
| **RISK-03** | **P0** | DB Privileges | `public.candidate_invitations` holds `anon=arwdDxtm/postgres` and `authenticated=arwdDxtm/postgres`. `public.support_tickets` has `authenticated=r/postgres` (missing `INSERT`), silently blocking real support ticket creation. `public.bootstrap_admin` grants `EXECUTE` to `authenticated`. | Additive Migration `027`: revoke all direct privileges on `candidate_invitations` from `public`/`anon`/`authenticated` and grant `SELECT` only to `authenticated`; grant column-scoped `INSERT` on `support_tickets` (`opened_by, employer_id, subject, details`) to `authenticated` + add `admin_update_support_ticket`; revoke `authenticated` execute on `bootstrap_admin`. |
| **RISK-04** | **P0** | Employer / Worker Privacy & RLS Joins | `getLiveEmployerApplicants` queries `workers(...)` directly, which `worker_owner_select` blocks for employers (resulting in `FW-CANDIDATE` fallback). `getLiveApplications` loses company name / paused / closed jobs due to `employers` & `jobs` RLS. | Migration `027`: add `SECURITY DEFINER` RPCs `get_employer_applicants` (returns SHA-256 `FW-XXXXXX` handle + anonymized summary for applicant workers even when `discoverable = false`) and `get_worker_applications` (returns worker's own applications including paused/closed jobs & company name). |
| **RISK-05** | **P0** | Worker Live UI | In `worker-more.tsx`, `/applications` filters against pilot `state.jobs` (`[]` in live mode -> renders nothing!), Withdraw only mutates pilot store, and `/settings` discoverability toggle calls `saveLiveWorkerProfile({ ...state.profile, discoverable })` with empty pilot `state.profile`, risking clobbering real profile fields! In `worker-jobs.tsx`, Hero & JobDetail/Saved rely on pilot store for worker profile, daily usage `0/20`, saved toggle. | Wire live Supabase profile, applications (`getLiveApplications` RPC), withdraw (`setLiveApplicationStatus`), daily IST application usage count, live saved jobs, and dedicated atomic `set_worker_discoverability` RPC + profile-loaded guard. |
| **RISK-06** | **P0** | Admin Live UI | `admin.tsx` reads pilot `state.audit` and `state.tickets`, Admin Pause/Close triggers pilot store `actions.setJobStatus` instead of `admin_set_job_state` RPC, and Admin Jobs displays pilot employer verification badge. | Wire `admin_set_job_state`, live `audit_log` & `support_tickets` queries, `admin_update_support_ticket`, and live employer verification badge from joined `employers.verification_state`. |
| **RISK-07** | **P1** | Caching & Logout | `store.tsx` persists `fleetwala.store.v2` in `localStorage` and `logout()` never clears it; `shell.tsx` unread counter ignores live notifications. | Clear `fleetwala.store.v2` and TanStack Query cache cleanly on logout / user switch; display real unread notification count in live mode. |
| **RISK-08** | **P1** | Invitation Hardening | `create_candidate_invitation` & `create_application_invitation` do not enforce `e.verification_state = 'verified'`; `respond_to_candidate_invitation` hardcodes `old_status = 'applied'` in history even when transitioning from `'reviewing'`. | Fix cleanly in Migration `027`. |
| **RISK-09** | **P1** | Error Honesty | `SupportPage` (`legal.tsx`) sets `submitted = true` even when unauthenticated or DB insert fails. Also stale `"pilot"` / `"sample"` copy remains in `index.html`, `public.tsx`, `employer.tsx`, `worker-jobs.tsx`. | Return explicit auth/DB error without faking submission; remove misleading pilot/sample claims while preserving honest empty states and legal blockers. |
| **RISK-10** | **BLOCKED** | Staging Admin & Legal / Domain Readiness | `admin-staging-e2e@fleetwala.internal` (`11111111-...`) remains in `admin_principals`; legal entity name, registered address, grievance officer, and `fleetwala.app` mailboxes are unconfigured; billing is disabled (`enabled=false`). | **Do not delete `11111111-...` automatically** (impact analysis documented below; revoke during owner-approved cutover). Mark Public Launch **BLOCKED** until owner supplies legal details, SMTP/mailboxes, DNS/OAuth config, and payment gateway authorization. |

---

## 4. Impact Analysis for Migration `027_predeployment_security_and_rls_hardening.sql`

Before applying Migration `027` to shared Supabase project `jigbzsaaowtyaqhreplg`:
1. **`candidate_invitations` privilege change (`REVOKE ALL` / `GRANT SELECT TO authenticated`):** Zero rows altered or deleted. Existing `invitations_employer_read` and `invitations_worker_read` RLS policies remain active. Only removes unused/excessive `anon` and direct client `INSERT/UPDATE/DELETE/TRUNCATE` grants since all writes occur through `SECURITY DEFINER` RPCs.
2. **`support_tickets` column-scoped `INSERT` (`opened_by, employer_id, subject, details`):** Zero rows altered. Unblocks `support_owner_insert` RLS policy while blocking client attempts to forge `status = 'resolved'` on insert.
3. **`bootstrap_admin` privilege revocation (`authenticated`):** Zero rows altered. Currently 2 admins exist so `bootstrap_admin` already fails for non-admins; revoking `authenticated` eliminates first-mover claim exposure on fresh environments.
4. **RPC hardening & additions (`create_candidate_invitation`, `create_application_invitation`, `respond_to_candidate_invitation`, `get_employer_applicants`, `get_worker_applications`, `set_worker_discoverability`, `admin_update_support_ticket`):** Strictly additive / non-destructive `CREATE OR REPLACE FUNCTION` using explicit `SET search_path` and schema-qualified table/function references. Zero modifications to `employers`, `jobs`, `workers`, `job_applications`, `conversations`, `messages`, or `candidate_invitations` rows.
5. **Unapplied destructive change intentionally DEFERRED (`11111111-1111-1111-1111-111111111111`):**
   - Verified `audit_log.actor_id` references `11111111-...` in 2 historical rows and `jobs.reviewed_by` references 0 rows.
   - Revoking staging admin access requires `DELETE FROM public.admin_principals WHERE user_id = '11111111-1111-1111-1111-111111111111';` (which preserves historical `audit_log` rows while revoking admin role). Left as an explicit owner-authorized pre-launch SQL action in `docs/audit/65` and `docs/audit/66`.
