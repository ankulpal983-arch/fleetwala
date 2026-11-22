# FleetWala Pre-Production Baseline & Change Control Plan

**Document:** `docs/audit/34-baseline-and-phase-plan.md`  
**Execution Timestamp:** 2026-11-22T17:20:00+05:30  
**Phase:** Phase 0 — Baseline & Change Control  
**Author:** Antigravity Autonomous Engineering Orchestrator  
**Target Repository:** `https://github.com/ankulpal983-arch/fleetwala`  
**Target Branch:** `real-preproduction-conversion`  
**Status:** PASS — Fully Verified Baseline

---

## 1. Executive Summary & Change Control Baseline

This document establishes the verified baseline for the FleetWala application prior to executing the end-to-end SaaS hardening, deployment configuration, and pre-production release sequence.

All observations recorded in this document have been gathered through live command execution, remote Supabase PostgreSQL inspection, and direct build and test execution.

---

## 2. Git & Repository Status

| Attribute | Verified Value | Evidence |
|:---|:---|:---|
| **Active Branch** | `real-preproduction-conversion` | `git status` |
| **Commit Head** | `084688d` | `git log -n 1 --oneline` |
| **Working Tree** | Clean (`nothing to commit, working tree clean`) | `git status` |
| **Remote Tracking** | `origin/real-preproduction-conversion` (up to date) | `git status` |
| **Protected Branch Rule** | `main` branch untouched; no force-pushing | Verified |
| **Local Monorepo Root** | `D:\Downloads\Fleet-Wala-Builder\Fleet-Wala-Builder` | Current working directory |
| **Frontend Workspace** | `artifacts/fleetwala` (React 19, Vite 7, TypeScript, Tailwind CSS 4) | Monorepo layout |
| **API Server Workspace** | `artifacts/api-server` (Express 5, Node.js) | Monorepo layout |

---

## 3. Remote Supabase & Database Baseline

- **Supabase Project Reference:** `jigbzsaaowtyaqhreplg`
- **Supabase Project URL:** `https://jigbzsaaowtyaqhreplg.supabase.co`
- **Applied Migrations (Verified in Repository & Remote PostgreSQL):**
  1. `001_extensions_and_enums.sql`
  2. `002_auth_profiles_and_roles.sql`
  3. `003_worker_profiles_and_preferences.sql`
  4. `004_jobs_and_moderation.sql`
  5. `005_applications_saved_jobs.sql`
  6. `006_notifications_chat.sql`
  7. `007_storage_metadata.sql`
  8. `008_billing_and_unlocks.sql`
  9. `009_audit_and_support.sql`
  10. `010_indexes_triggers_and_functions.sql`
  11. `011_rls_policies.sql`
  12. `012_views_and_safe_discovery.sql`
  13. `013_test_fixtures_staging_only.sql`
  14. `014_database_verification.sql`
  15. `015_data_retention_and_cleanup.sql`
  16. `016_employer_registration_and_membership.sql`
  17. `017_worker_profile_permissions_and_live_integration.sql`
  18. `018_admin_workflows_and_notifications.sql`
  19. `019_employer_membership_and_job_creation_fix.sql`

### Active Remote State Snapshot:
- **`public.employers`:**
  - `6e7c9a06-b7ba-4a76-bb3c-25e9b410639f` (`Ghar-Tak Parcels Staging Pvt Ltd`, `verified`, created by `22222222-2222-2222-2222-222222222222`)
  - `480c9331-a3fc-4a8b-b636-f91472965708` (`Bengaluru Fast-Fleet Logistics`, `pending`, created by `44444444-4444-4444-4444-444444444444`)
- **`public.employer_memberships`:**
  - `5733aa5f-ee59-4ed1-bc9d-9b6deb6b07b3` (Owner account, role: `owner`, state: `active`, org: `6e7c9a06-b7ba-4a76-bb3c-25e9b410639f`)
  - `22222222-2222-2222-2222-222222222222` (Staging Employer, role: `owner`, state: `active`, org: `6e7c9a06-b7ba-4a76-bb3c-25e9b410639f`)
  - `44444444-4444-4444-4444-444444444444` (Staging Employer 2, role: `owner`, state: `active`, org: `480c9331-a3fc-4a8b-b636-f91472965708`)
- **`public.jobs`:**
  - `ad8adc97-e06f-45e7-a5b5-fdb7b517f4d1` (`published`, Express Parcel Delivery Partner)
  - `6157b3c8-018c-4187-ba4c-cb6ec40d91a2` (`pending_review`, Express Delivery Partner - Electronic City, created by owner)
  - `41552fab-d004-4c2e-84e9-10197df8afea` (`draft`, Hub Sorter - Whitefield Warehouse)

---

## 4. Test Suite, Typecheck & Production Build Baseline

- **Automated Tests:** 62 passed, 0 failed, 0 skipped (`corepack pnpm --filter @workspace/fleetwala run test`).
- **TypeScript Typecheck:** 0 errors (`corepack pnpm --filter @workspace/fleetwala run typecheck`).
- **Production Bundle Build:** Succeeded in 11.10s (`corepack pnpm --filter @workspace/fleetwala run build`), generating `dist/public/index.html` (4.17 kB) and `dist/public/assets/index-DK2wXDWH.js` (989.29 kB).
- **Backend API Health Check:** Running on `http://localhost:5000/api/healthz` -> HTTP 200 `{"status":"ok"}`.
- **Frontend Server:** Running on `http://localhost:3000`.

---

## 5. Architectural Map & Identity Resolution

```
[Browser Client]
       │
       ├── Auth / Profiles / Jobs / Applications / Storage (RLS + JWT)
       │    └── Direct to Supabase API (https://jigbzsaaowtyaqhreplg.supabase.co)
       │         ├── RPC get_current_employer_org() -> returns active org membership
       │         ├── Direct Table INSERT / UPDATE on public.jobs (RLS protected)
       │         ├── RPC submit_job(p_job_id) -> state transition draft -> pending_review
       │         └── RPC review_job(p_job_id, approve, reason) -> admin moderation
       │
       └── Health Check & Future Webhook Handlers
            └── Express API (Render Web Service / localhost:5000)
                 └── /api/healthz (200 OK)
```

---

## 6. Execution Roadmap (Phases 1 through 11)

| Phase | Description | Key Focus / Target Deliverable |
|:---|:---|:---|
| **Phase 1** | P0 Fix: Submit for Review | Resolve draft-update vs create duplication, verify `submit_job` RPC, update UI refresh, write `020_submit_job_and_workflow_hardening.sql`, browser verification -> `docs/audit/35-submit-for-review-root-cause-fix.md` |
| **Phase 2** | Admin Onboarding & Moderation | Verify `admin_principals`, review queue UI, employer verification and job approval flows -> `docs/audit/36-admin-and-moderation-verification.md` |
| **Phase 3** | Worker -> Employer Hiring E2E | Worker browsing, applying (20/day IST limit), employer candidate review, shortlist, in-app messaging -> `docs/audit/37-real-hiring-e2e-results.md` |
| **Phase 4** | Multi-Tenant Security & Privacy | Cross-tenant RLS isolation, candidate projection privacy (no phone/photo PII leaks), billing gate defense -> `docs/audit/38-security-privacy-release-gates.md` |
| **Phase 5** | Split Deployment Architecture | Vercel (frontend) + Render (API) + Supabase contract, CORS allowlist, env matrix -> `docs/deployment/01-architecture-and-env-matrix.md`, `02-frontend-backend-contract.md` |
| **Phase 6** | Vercel Frontend Deployment Prep | `vercel.json`, SPA routing rewrites, preview deployment runbook -> `docs/deployment/03-vercel-setup-and-test.md` |
| **Phase 7** | Render Backend Deployment Prep | `render.yaml`, monorepo build/start, zero secrets in frontend, cold start handling -> `docs/deployment/04-render-setup-and-test.md` |
| **Phase 8** | Supabase Auth & Origin Config | Redirect allowlist, Google OAuth callback configuration, email rate limit runbook -> `docs/deployment/05-auth-oauth-env-validation.md` |
| **Phase 9** | Online Pre-Production E2E | End-to-end verification across deployed preview origins, mobile responsiveness, go/no-go audit -> `docs/deployment/06-online-e2e-and-go-no-go.md` |
| **Phase 10** | Payment Gateway Future Activation | Razorpay/Cashfree architecture specification, ₹99/job and ₹10 unlock order flow (retained disabled) -> `docs/deployment/07-payments-future-activation-plan.md` |
| **Phase 11** | Production Hardening & Launch Gates | Trust & safety policies, Indian labor regulatory checklist, incident response, owner launch checklist -> `docs/deployment/08-production-hardening-and-launch-checklist.md` |
| **Final** | Master Completion & Risk Register | Master matrix, owner handoff guide, risk register -> `docs/audit/39-master-all-phases-completion-matrix.md`, `docs/deployment/09-owner-handoff.md`, `docs/deployment/10-release-risk-register.md` |

Phase 0 is complete and verified. Moving immediately to Phase 1.
