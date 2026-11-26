# FleetWala Final Pre-Deployment Security & Readiness Audit

**Document:** `docs/audit/63-final-pre-deployment-security-and-readiness-audit.md`  
**Audit Date:** 2026-11-26  
**Branch:** `real-preproduction-conversion`  
**Baseline Commit:** `b20c08748ccbc0c7a83566bbba8f34bb24cda2c1`  
**Scope:** Full 19-Phase Pre-Deployment Audit & Engineering Remediation (Frontend, API Server, PostgreSQL/RLS, Caching, UI/UX, Vercel/Render/DNS/OAuth/Legal Readiness — **NO external deploy/DNS/OAuth/billing changes executed**).

---

## 1. Executive Summary of Engineering Repairs Executed

| Category | Vulnerability / Defect Found | Concrete Repair Applied | Verification Evidence |
|---|---|---|---|
| **P0 Authentication** | `artifacts/fleetwala/src/lib/auth-context.tsx` checked `localStorage.getItem('fleetwala_test_auth') === 'employer'` to inject a synthetic authenticated employer session even in production builds. | Completely removed `fleetwala_test_auth` bypass from `auth-context.tsx` and browser scripts (`browser-smoke-test.cjs`, `test-candidates-page.cjs`). | `predeployment-audit.test.ts` #1 passes; `dist/public` secret scan = `0` matches; headless Chrome `/employer/candidates` shows `Employer Workspace Required`. |
| **P0 Backend CORS & Hardening** | `artifacts/api-server/src/app.ts` accepted all origins (`else callback(null, true)`) plus wildcard `*.vercel.app`, with no body size limit, rate limit, security headers, or graceful shutdown (`index.ts`). | Enforced fail-closed `CORS_ORIGIN` allowlist (`https://fleetwala.app`, `https://www.fleetwala.app`), HTTP `403` on unauthorized `Origin`, `100kb` payload cap (`413`), sliding-window `120/min` rate limit (`429`), HSTS & security headers, JSON 404/error handler, and `SIGTERM`/`SIGINT` drain. | Production dry-run (`NODE_ENV=production`) verified `200` for `fleetwala.app`, `403` for `attacker.vercel.app` & `evil.example`, `413` on >100kb JSON, `404` JSON, and strict response headers. |
| **P0 Worker Applications & Discoverability** | `worker-more.tsx`: `Applications` filtered against pilot `state.jobs` (`if (!job) return null`), hiding every real live application; `Withdraw` skipped Supabase; `SettingsPage` called `saveLiveWorkerProfile({ ...state.profile, discoverable })` with empty pilot fields, risking overwriting real worker profiles! | Wired `getLiveApplications()` RPC-first metadata + `setLiveApplicationStatus(a.id, 'withdrawn')` + TanStack Query invalidation; added `setLiveWorkerDiscoverability()` (`set_worker_discoverability` RPC / single-column fallback); fixed `Profile` `Discard` to reset to loaded cloud profile. | `predeployment-audit.test.ts` #4 passes; TS typecheck & `vite build` pass cleanly. |
| **P0 Worker Hero, Usage & Saved Jobs** | `worker-jobs.tsx` rendered empty pilot `state.profile`, `0/20` usage counter, pilot bookmark toggles, and stale `"applying still works in the pilot"` copy; GPS handler ignored `userCoords` and lacked error/invalid-coord differentiation. | Wired TanStack Query live worker profile, IST daily usage, saved jobs (`toggleLiveSavedJob`), `applyToLiveJob` invalidation; implemented `rules.ts` coordinate validation, city-hub Haversine matching, and 6-digit Indian pincode filter with explicit denied/timeout/unavailable messages. | `predeployment-audit.test.ts` #3 passes; 99/99 unit/RLS tests pass. |
| **P0 Employer Applicants & Pilot Leaks** | `getLiveEmployerApplicants` returned `FW-CANDIDATE` due to `workers` RLS blocking nested select; `employer.tsx` retained `'FW-PILOT'`, `'No email is sent in the pilot.'`, `'Pilot worker'`, `'This pilot'`. | Wrote `get_employer_applicants` SECURITY DEFINER RPC in Migration `027` + RPC-first fallback in `repo.ts`; removed misleading pilot/team-invite UI behavior cleanly. | Verified `employer.tsx` compiles cleanly (`ShieldCheck` imported) & `predeployment-audit.test.ts` #5 passes. |
| **P0 Admin Live Controls** | `admin.tsx` read pilot `state.audit` and `state.tickets`, Admin Pause/Close mutated local store instead of `admin_set_job_state` RPC, and Employer Verification status pill used pilot `state.employers`. | Wired `getLiveAdminAuditLog()`, `getLiveAdminSupportTickets()`, `adminSetLiveJobState()`, `adminUpdateLiveSupportTicket()`, and live `employer_status`. | `predeployment-audit.test.ts` #5 passes; TypeScript & build pass cleanly. |
| **P1 Cross-User Caching** | `store.tsx` left `fleetwala.store.v2` in `localStorage` across logout / account switches; `shell.tsx` ignored live Supabase unread notifications. | Added `SESSION_RESET_EVENT` cleared on `logout()` & user ID transitions alongside `queryClient.clear()`; wired `Shell` unread badge to `getLiveNotifications()`. | Verified in code (`predeployment-audit.test.ts` #1) and TypeScript/build checks. |
| **P1 Error Honesty & Copy** | `legal.tsx` `SupportPage` marked `submitted = true` even when unauthenticated or DB `insert` failed; stale `"pilot"`/`"sample"` strings existed in `index.html`, `public.tsx`, `repo.ts`, `legal.tsx`. | Wired `submitLiveSupportTicket()` returning real auth/DB errors (`Please sign in...`); removed misleading pilot/sample claims; updated support contact placeholders cleanly to `fleetwala.app` (`[OWNER ACTION REQUIRED — not yet active]`). | Verified live in headless Chrome production dry-run: `/support` rejected unauthenticated submission with explicit error and zero fake success. |
| **P1 Deploy Configs** | `vercel.json` / `artifacts/fleetwala/vercel.json` rewrote `/favicon.svg` to `/index.html` and omitted HSTS/Permissions-Policy; `render.yaml` omitted `--frozen-lockfile` and pointed CORS to `fleetwala.vercel.app`. | Updated rewrite exclusions to preserve `favicon.svg`, added HSTS + Permissions-Policy headers, updated `render.yaml` `--frozen-lockfile` and `https://fleetwala.app,https://www.fleetwala.app`. | Verified `GET /favicon.svg` returns SVG HTTP 200 on compiled preview; `predeployment-audit.test.ts` #6 passes. |

---

## 2. Staged Database Hardening Migration (`027`) & Unresolved Remote Items

Because linked Supabase project `jigbzsaaowtyaqhreplg` is flagged `production` and enforces explicit operator consent (`HostedMutationConsentRequiredError` without `--yes`), and per policy preventing unapproved live-permission / destructive remote SQL changes:
1. **Staged Migration Ready (`supabase/migrations/027_predeployment_security_and_rls_hardening.sql`):**
   - Tightens `candidate_invitations` ACL (revokes `anon` & client `INSERT/UPDATE/DELETE`, leaves `SELECT` for `authenticated`).
   - Grants column-restricted `INSERT (opened_by, employer_id, subject, details)` on `support_tickets` to `authenticated` + adds `admin_update_support_ticket` RPC.
   - Revokes `EXECUTE` on `bootstrap_admin(text)` from `authenticated` and `anon`.
   - Enforces verified-employer check in `create_candidate_invitation` & `create_application_invitation`; records actual prior status in `respond_to_candidate_invitation`.
   - Adds `get_employer_applicants`, `get_worker_applications`, and `set_worker_discoverability` `SECURITY DEFINER` RPCs (`SET search_path = ''`, schema-qualified `extensions.digest`).
2. **Deferred Staging Admin Revocation:**
   - `11111111-1111-1111-1111-111111111111` (`admin-staging-e2e@fleetwala.internal`) remains in `public.admin_principals`. Owner SQL cleanup command documented in `docs/audit/65` & `docs/audit/66`.
3. **Public Launch Blockers (Unconfigured Owner Inputs):**
   - Legal business entity, CIN/LLPIN, registered office, Grievance Officer contact, `support@`/`grievance@`/`noreply@fleetwala.app` mailboxes + Custom SMTP, Name.com DNS, production OAuth URLs, Supabase backups/PITR verification, uptime monitoring, and payment gateway KYC (`billing_settings.enabled` safely `false`).

---

## 3. Observed Verification Results After Final Code Edits

| Suite / Check | Scope & Outcome | Count / Timing |
|---|---|---|
| `tsc -p tsconfig.json --noEmit` (`api-server` & `fleetwala`) | Clean pass, zero type errors | **2/2 PASS** |
| `tsx --test src/lib/*.test.ts` (6 test files incl. live `jigbzsaaowtyaqhreplg` anon RLS probes) | Zero failures, zero skips | **99/99 PASS** (`16.44s`) |
| `vite build --config vite.config.ts` | Production client bundle (`dist/public/index.html`, JS `1,047.42 kB` / gzip `300.71 kB`) + secret scan (`0` hits) | **PASS** (`48.53s`) |
| `node ./build.mjs` (`api-server`) | Production server bundle (`dist/index.mjs` `1.4mb`) | **PASS** (`762ms`) |
| Local Production Dry-Run (`NODE_ENV=production` API + `vite preview` + Chrome) | Health, security headers, fail-closed CORS, 404/413, `/favicon.svg`, 12/12 SPA routes across Desktop (`1280x800`), Tablet (`768x1024`), Mobile (`390x844`), `/support` unauth rejection | **PASS** |
| `node scripts/browser-smoke-test.cjs` + `test-candidates-page.cjs` (live local dev `localhost:3000` & `localhost:5000`) | All 16 routes hydrated with expected text & `0` console/JS errors + unauthenticated `/employer/candidates` guard verified (`ShieldCheck`/no ReferenceErrors) | **16/16 + 1/1 PASS** |
