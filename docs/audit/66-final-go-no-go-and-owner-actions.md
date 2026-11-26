# FleetWala Final Release GO / NO-GO Matrix & Owner Action List

**Document:** `docs/audit/66-final-go-no-go-and-owner-actions.md`  
**Audit Date:** 2026-11-26  
**Branch:** `real-preproduction-conversion`  
**Audit Reference:** Phase 17 — Formal Release Readiness Assessment

---

## 1. Dual Release Decisions

| Milestone | Target | Decision | Summary |
|---|---|---|---|
| **Controlled Staging Deployment** | Staging Vercel + Render + `jigbzsaaowtyaqhreplg` | **CONDITIONAL GO (Pending 1 Owner DB Step)** | All frontend/backend code & security fixes are complete, tested (`99/99` unit/RLS tests, production builds, `0` bundle secret hits, `16/16` Chrome smoke, `12/12` responsive dry-run routes). Before exposing shared staging URLs, owner must execute/confirm Migration `027` (`--yes`), remove staging test admin `11111111-...` from `admin_principals`, and verify authenticated 3-role OAuth E2E interactively. |
| **Public Customer Launch** | `https://fleetwala.app` + `https://api.fleetwala.app` | **NO-GO / BLOCKED** | Public launch MUST remain blocked until Legal Entity/CIN/Address/Grievance Officer, active `fleetwala.app` mailboxes + Custom SMTP, Name.com DNS, production OAuth redirects, dedicated Production Supabase + PITR backups, uptime monitoring, and authorized payment gateway setup (or confirmed free beta terms) are completed. |

---

## 2. 29-Category Release Readiness Matrix

| # | Category | Status | Verified Basis / Remaining Gap |
|---|---|---|---|
| 1 | **Authentication** | **PARTIAL** | Removed `fleetwala_test_auth` backdoor; PKCE Google/Email auth & guards verified; prod redirect URLs (`fleetwala.app`), Custom SMTP, and interactive OAuth E2E pending. |
| 2 | **Authorization** | **PASS** | Route guards + DB-backed `is_admin()`, `is_active_employer_member()`, `current_worker_id()` verified; `bootstrap_admin` client lock & `11111111-...` cleanup staged. |
| 3 | **Worker Portal** | **PARTIAL** | Fixed `/applications`, `/settings` discoverability overwrite bug, Hero live usage/profile, & saved bookmark toggles; authenticated browser verification after `027` pending. |
| 4 | **Employer Portal** | **PARTIAL** | Fixed `ShieldCheck`, removed `FW-PILOT`/pilot strings, wrote `get_employer_applicants`; live team multi-seat email invites intentionally disabled until Custom SMTP; `027` pending apply. |
| 5 | **Admin Portal** | **PARTIAL** | Wired live `audit_log`, `support_tickets`, employer verification pill, and `admin_set_job_state` Pause/Close; `admin_update_support_ticket` awaits `027`; staging admin row `11111111-...` still active. |
| 6 | **Job Posting** | **PASS** | Draft creation/editing, prohibited fee rejection, `submit_job`, and Pause/Resume/Close transitions verified in code & DB RPCs. |
| 7 | **Moderation** | **PASS** | Enforced `verified` employer requirement before `review_job` approval; `admin_set_job_state` & `audit_log` trail verified. |
| 8 | **Applications** | **PARTIAL** | Atomic `apply_to_job` 20/IST-day limit & Withdraw action wired cleanly; `get_worker_applications` RPC awaits `027` apply for paused/closed company preservation. |
| 9 | **Candidate Discovery** | **PASS** | Real `Ankul` Dwarka record & SHA-256 `FW-492E4A` handle intact; consent opt-in respected; verified-employer invitation gate hardened in `027`. |
| 10 | **Invitations** | **PARTIAL** | Application-linked and discovery-linked RPCs verified; `candidate_invitations` least-privilege `REVOKE anon` & prior status history fix staged in `027`. |
| 11 | **Chat** | **PASS** | Canonical conversation creation, participant membership RLS (`can_access_conversation`), `send_message`, and real DB message history verified. |
| 12 | **Notifications** | **PARTIAL** | Added `new_application`, `candidate_invited`, `invitation_accepted`/`declined`, `support_ticket_update` mappers + `Shell` unread count query; support ticket updates await `027`. |
| 13 | **Privacy** | **PASS** | Discoverability defaults false; zero Aadhaar collected; SHA-256 candidate handles; `workers`/`messages` blocked cleanly for anon users; atomic toggle prevents data clobbering. |
| 14 | **Location** | **PARTIAL** | 15 km default radius, coordinate bounds validation, denied/timeout/unavailable handling, city-hub Haversine matching & Indian pincode normalization tested via unit suite; live GPS dialog not clicked in headless Chrome. |
| 15 | **Security** | **PASS** | Auth bypass eliminated, fail-closed CORS (`403`), `100kb` cap (`413`), rate limit (`429`), HSTS/security headers verified live; `0` secrets in frontend bundle; RLS enabled on 28/28 tables. |
| 16 | **Caching** | **PASS** | Logout & session UID changes clear TanStack Query cache & `localStorage` (`fleetwala.store.v2`); mutations invalidate relevant queries cleanly. |
| 17 | **Performance** | **PARTIAL** | Production Vite bundle compiles (`1,047.42 kB` JS / `300.71 kB` gzip; triggers Rollup `>500 kB` chunk warning); acceptable for staging, recommend route lazy-splitting before high-scale launch. |
| 18 | **Database** | **PARTIAL** | 28/28 tables RLS-enabled & genuine data preserved; `027` ACL/RPC hardening staged awaiting owner `--yes` consent; `017`–`026` history reconciliation & Prod DB separation needed before launch. |
| 19 | **Frontend Build** | **PASS** | Clean TS check + `vite build` + `0` secret hits in `dist/public`. |
| 20 | **Backend Build** | **PASS** | Clean TS check + `node ./build.mjs` (`dist/index.mjs` `1.4mb`) + `SIGTERM`/`SIGINT` drain verified. |
| 21 | **Vercel Preparation** | **PASS** | `vercel.json` & `artifacts/fleetwala/vercel.json` exclude `favicon.svg` and set HSTS/XSS/frame headers; not deployed. |
| 22 | **Render Preparation** | **PASS** | `render.yaml` verified (`--frozen-lockfile`, `/api/healthz`, strict `CORS_ORIGIN=https://fleetwala.app,https://www.fleetwala.app`); not deployed. |
| 23 | **DNS Preparation** | **BLOCKED** | Name.com checklist ready (`docs/deployment/11`); awaits owner connecting Vercel/Render domains, backing up existing MX/TXT, and entering actual destination records. |
| 24 | **OAuth Preparation** | **BLOCKED** | Supabase/Google OAuth runbook prepared cleanly; external dashboard `https://fleetwala.app` origins & redirects not edited per freeze. |
| 25 | **Email Readiness** | **BLOCKED** | `support@fleetwala.app`, `grievance@fleetwala.app`, `noreply@fleetwala.app` mailboxes & Custom SMTP not yet configured; Supabase free-tier ~3-4/hr limit active. |
| 26 | **Payment Readiness** | **BLOCKED** | Safely disabled (`billing_settings.enabled = false`); ₹0 worker apply / ₹99 job / ₹10 unlock rules preserved; Razorpay/Cashfree KYC, server webhooks & secrets require separate owner authorization. |
| 27 | **Legal Readiness** | **BLOCKED** | Missing owner legal entity name, CIN/LLPIN, registered address, Grievance Officer name/contact, active emails, legal counsel approval, and retention schedule sign-off (`015`). |
| 28 | **Production Monitoring** | **BLOCKED** | Server structured pino logs & `/api/healthz` ready; external uptime alerts & log retention drains not yet provisioned in cloud. |
| 29 | **Backup & Restore** | **BLOCKED** | Plan documented in `docs/audit/65`; automated PITR plan & verified staging restore drill required before public launch. |

---

## 3. Prioritized Owner Action List Before Staging & Public Launch

### Step A — Immediate Owner Actions (Required for Controlled Staging)
1. **Authorize & Apply Migration `027` on `jigbzsaaowtyaqhreplg`:**
   - Review `supabase/migrations/027_predeployment_security_and_rls_hardening.sql`.
   - Apply in Supabase SQL Editor or via `npx supabase db query --remote --yes` (and run `npx supabase migration repair --status applied 017 018 019 020 021 022 023 024 025 026 027`).
2. **Revoke Staging E2E Admin Row:**
   - Execute `DELETE FROM public.admin_principals WHERE user_id = '11111111-1111-1111-1111-111111111111';` so only owner admin `4346529e-a380-47ea-a0b1-f4890000bfb8` remains active.
3. **Interactive 3-Account OAuth Sanity Pass:**
   - Verify Worker, Employer, and Admin flows manually in Chrome once `027` is live.

### Step B — Mandatory Owner Actions (Required Before Public Customer Launch on `fleetwala.app`)
1. **Legal Incorporation & DPDP Compliance (`artifacts/fleetwala/src/pages/legal.tsx` & `public.tsx`):**
   - Supply legal entity name, CIN/LLPIN, Bengaluru/Karnataka registered office address, designated Grievance Officer name & working `grievance@fleetwala.app` / `support@fleetwala.app` emails, counsel sign-off, and retention approval (`015`).
2. **Domain Email & Custom SMTP (`fleetwala.app`):**
   - Configure workspace/transactional email (`support@`, `grievance@`, `noreply@fleetwala.app`) + SPF/DKIM/DMARC DNS records; configure Custom SMTP in Supabase Auth.
3. **Production Database Isolation & Backups:**
   - Provision dedicated Production Supabase project (`ap-south-1`), run `001`–`027` (**skip `013`**), seed owner admin directly, enable PITR backups, and verify restore drill (`docs/audit/65`).
4. **Cloud Deployments, Name.com DNS & OAuth Cutover:**
   - Connect Vercel (`artifacts/fleetwala`), Render (`render.yaml`), configure Name.com records using actual Vercel/Render target values (preserving existing MX/TXT), and add `https://fleetwala.app/**` in Supabase Auth & Google OAuth Console (`docs/deployment/11`).
5. **Monitoring & Commercial Billing Decision:**
   - Set up BetterStack/UptimeRobot monitors on `https://fleetwala.app` & `https://api.fleetwala.app/api/healthz`.
   - Either keep `billing_settings.enabled = false` explicitly for an owner-approved promotional phase, OR separately authorize Razorpay/Cashfree merchant setup & server webhook implementation (`docs/deployment/07`).
