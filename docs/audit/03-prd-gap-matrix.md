# FleetWala PRD & Route Gap Audit Matrix
**Document ID:** `docs/audit/03-prd-gap-matrix.md`  
**Audit Date:** 2026-11-21  
**Auditor:** Antigravity Autonomous Orchestrator  
**Status:** COMPLETE (Phase 2)

---

## 1. Overview & Baseline Reconciliation

- **Product:** FleetWala (India-focused logistics hiring marketplace).
- **Core Surfaces:** Worker Experience (`/`, `/jobs/:id`, `/saved`, `/applications`, `/messages`, `/profile`), Employer Dashboard (`/employer`, `/employer/jobs`, `/employer/applicants`, `/employer/candidates`, `/employer/billing`, `/employer/team`), Role-Protected Admin Panel (`/admin`, `/admin/jobs`, `/admin/employers`, `/admin/audit`, `/admin/support`).
- **Baseline Change Recorded:** The user baseline explicitly overrides the original PRD's mobile-first Expo and Clerk auth specifications in favor of a responsive **React + Vite Web SaaS** backed by **Supabase Auth**.

---

## 2. Feature & Route Gap Matrix

Status definitions:
- **Implemented & tested:** Feature exists in code and has automated tests that passed.
- **Implemented but untested:** UI or logic exists, but requires live backend/E2E test suite.
- **Partial:** UI screen exists with browser-local pilot state or mock; live backend integration pending.
- **Missing:** Not yet implemented in UI or API.
- **Blocked:** Blocked on external credentials, third-party approvals (SMS gateway, payment gateway, live Supabase project).

### 2.1 Worker Experience

| Feature / Requirement | Route / Component | Current Implementation Status | Gap / Evidence / Notes |
| :--- | :--- | :--- | :--- |
| **Phone OTP Auth (+91 / E.164)** | `/login` ([public.tsx](file:///d:/Downloads/Fleet-Wala-Builder/Fleet-Wala-Builder/artifacts/fleetwala/src/pages/public.tsx)) | **Implemented & tested** (formatting) / **Blocked** (live SMS) | `normalizeIndianPhone` handles 10-digit validation and prefixes `+91`. Supabase `signInWithOtp` adapter is wired in `lib/supabase.ts`. Live SMS delivery is blocked pending owner-provided SMS gateway and TRAI DLT registration. |
| **Onboarding & Profile Wizard** | `/profile` ([worker-more.tsx](file:///d:/Downloads/Fleet-Wala-Builder/Fleet-Wala-Builder/artifacts/fleetwala/src/pages/worker-more.tsx)) | **Partial** | Full UI with `react-hook-form` + `zod`. Tracks first name, city, area, experience, vehicle, availability. Saves to browser pilot state. Live DB write pending Supabase connection. |
| **Optional Vehicles, Skills, Shifts** | `/profile` | **Implemented but untested** | Supports Bicycle, Scooter, Motorcycle, EV 2W, Auto/3W, Commercial 4W, Walking; shifts (Morning, Evening, Night, Flexible). |
| **Live Jobs Feed** | `/` ([worker-jobs.tsx](file:///d:/Downloads/Fleet-Wala-Builder/Fleet-Wala-Builder/artifacts/fleetwala/src/pages/worker-jobs.tsx)) | **Implemented & tested** | `liveJobs()` filters by `status === 'approved'` and `expires_at > now`. Verified by unit tests. |
| **Search & Filters (Role, Fuel, Licence)**| `/` | **Implemented & tested** | Full search by keyword, city, area, work type, fuel allowance flag, and no-license-required flag. |
| **15 km Radius & Manual Fallback** | `/` | **Partial** | UI defaults radius to 15 km with slider/selector and location consent modal. Exact GPS geocoding is labeled approximate; falls back seamlessly to city and area selection. |
| **Job Details Page** | `/jobs/:id` | **Implemented & tested** | Displays salary range, shift, vehicle requirements, openings, company info, and apply dialog. |
| **Saved Jobs Persistence** | `/saved` | **Implemented & tested** | Toggle save/unsave state persists in local storage across sessions. |
| **Job Application Flow** | `/jobs/:id` | **Implemented & tested** (local) / **Blocked** (DB RPC) | Applying records application with timestamp. Duplicate prevention and withdrawal supported. Daily cap (20) enforced in memory; atomic Postgres RPC exists in `supabase/migrations/010_*.sql` but unexecuted. |
| **20 Applications/Day Server Limit** | `lib/rules.ts` & Migration 010 | **Implemented & tested** (rules) / **Implemented but untested** (SQL) | `canApplyToday` and `countToday` tested for IST day boundaries (Asia/Kolkata). SQL function `apply_for_job` enforces concurrency lock and count. |
| **Application Status Timeline** | `/applications` | **Implemented but untested** | Timeline visualizes `applied -> viewed -> shortlisted -> hired`, plus withdrawal and rejection states. |
| **Notifications Queue** | `/notifications` | **Implemented & tested** | In-app notification bell with unread badge and mark-all-as-read action. |
| **Privacy / Discoverability Toggle** | `/settings` & `lib/rules.ts` | **Implemented & tested** | Discoverability defaults to `OFF` (`discoverable: false`). Only explicit worker opt-in enables candidate discovery. |
| **Optional Documents Upload** | `/profile` | **Partial** | Document metadata schema defined in SQL (Migration 007); UI upload widget currently placeholders private storage. |
| **In-App Text Chat** | `/messages` | **Partial** | Threaded messaging UI with authorized recruiter conversations. Realtime WebSocket subscription blocked until live auth session. |
| **Support & Safety Queue** | `/support` | **Implemented but untested** | Worker support ticket creation with topics (Fake employer, safety, payment question) and audit logs. |
| **Logout & Account Deletion Request** | `/settings` | **Partial** | Sign-out is implemented via `supabase.auth.signOut()`. Account deletion policy and GDPR/DPDP request flow drafted in SQL Migration 015. |

---

### 2.2 Employer Experience

| Feature / Requirement | Route / Component | Current Implementation Status | Gap / Evidence / Notes |
| :--- | :--- | :--- | :--- |
| **Employer Organization & Types** | `/employer/team` ([employer.tsx](file:///d:/Downloads/Fleet-Wala-Builder/Fleet-Wala-Builder/artifacts/fleetwala/src/pages/employer.tsx)) | **Implemented but untested** | Supports Company, Vendor/DSP, Agency, Recruiter seat types. Multi-tenant org schema drafted in SQL Migration 002. |
| **Employer Verification Queue** | `/employer` & `/admin/employers` | **Implemented but untested** | Employer status pill shows `unverified`, `verified`, or `suspended`. Unverified employers have limited posting privileges. |
| **Job Posting & Lifecycle** | `/employer/jobs` | **Implemented & tested** | Comprehensive Zod-validated job creation dialog (pay, vehicle, openings, dates). Prohibits deposit/fee demands (`!/(deposit|registration fee|pay to join)/i`). |
| **Job Moderation Statuses** | `/employer/jobs` | **Implemented & tested** | Supports `draft -> pending -> approved -> paused -> closed`. |
| **Applicant Pipeline Management** | `/employer/applicants` | **Implemented but untested** | Allows employer to view applicants, advance status (`applied -> viewed -> shortlisted -> hired`), and view candidate profiles without contact disclosure. |
| **Candidate Discovery (Anonymized)** | `/employer/candidates` | **Implemented but untested** | Shows only opted-in workers (`discoverable: true`). Reveals only first name, area, experience, and vehicle. Phone, email, and exact address are completely redacted. |
| **Authorized Contact Unlock (₹10)** | `/employer/candidates` | **Partial / Blocked** | UI explains the ₹10 contact unlock rule. Payment gateway integration is blocked pending owner selection of gateway (Razorpay / Cashfree). |
| **Dispute / Invalid Contact Handling** | `/admin/support` | **Partial** | Support ticket system handles employer disputes for unreachable contacts. |

---

### 2.3 Admin & Moderation Experience

| Feature / Requirement | Route / Component | Current Implementation Status | Gap / Evidence / Notes |
| :--- | :--- | :--- | :--- |
| **Role-Protected Admin Access** | `/admin` ([admin.tsx](file:///d:/Downloads/Fleet-Wala-Builder/Fleet-Wala-Builder/artifacts/fleetwala/src/pages/admin.tsx)) | **Partial** (UI demo) / **Implemented but untested** (SQL RLS) | In pilot mode, accessed via top-level workspace switcher. In SQL (Migration 002 & 011), admins are strictly managed via `admin_users` table with server-side RLS enforcement. |
| **Employer Verification Queue** | `/admin/employers` | **Implemented but untested** | Allows admin to review organization registration, verify, or suspend suspicious employers. |
| **Job Moderation Queue** | `/admin/jobs` | **Implemented & tested** | Allows admin to review pending jobs, approve, pause, or send back to draft with mandatory moderation notes. |
| **Audit Logs Trail** | `/admin/audit` | **Implemented & tested** | Full timestamped ledger of admin actions, job status changes, and employer verifications. |
| **Abuse & Ticket Queue** | `/admin/support` | **Implemented but untested** | Review user-reported listings and support tickets. |

---

### 2.4 Cross-Cutting & Technical Quality

| Dimension | Status | Evidence & Details |
| :--- | :--- | :--- |
| **Empty, Loading, Error States** | **Implemented & tested** | `CardSkeleton`, `EmptyState`, and `ErrorBoundary` implemented across all screens. |
| **Offline Awareness** | **Implemented & tested** | Global online/offline banner triggered by `navigator.onLine` and `window.addEventListener('offline')`. |
| **Accessibility (a11y)** | **Implemented & tested** | Radix UI primitives with full ARIA attributes, semantic landmarks, high-contrast labels, and focus rings. |
| **Responsive Mobile / Tablet / Desktop** | **Implemented & tested** | Tested with Tailwind responsive breakpoints (`sm:`, `md:`, `lg:`), bottom mobile nav, and desktop sidebar header. |
| **SEO & Document Titles** | **Implemented & tested** | Dynamic document title and OpenGraph metadata updater configured per route in `App.tsx`. |
| **Legal / Compliance Disclosures** | **Implemented & tested** | `/legal/terms` and `/legal/privacy` display draft policies addressing DPDP Act, non-discrimination, and no-deposit rules. |

---

## 3. PRD Ambiguities & Open Decisions

The following items are not fully resolved by the second-hand prompt text and require explicit confirmation:
1. **SMS Gateway & TRAI DLT Registration:** Which SMS provider (Twilio, Gupshup, Exotel, Msg91) will be integrated with Supabase Phone Auth?
2. **Payment Gateway Selection:** Which India-compatible gateway (Razorpay vs Cashfree) will handle ₹99 job posting and ₹10 candidate contact unlock?
3. **Admin Provisioning Pathway:** Admin users should be provisioned via a protected CLI script or database seed, rather than public sign-up.
4. **Application Withdrawal Quota Policy:** If a worker applies and then withdraws on the same day, does that count toward the 20/day limit? (Current implementation conservatively counts all submissions within that IST calendar day).
