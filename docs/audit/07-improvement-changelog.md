# FleetWala Prioritized Improvements Changelog
**Document ID:** `docs/audit/07-improvement-changelog.md`  
**Audit Date:** 2026-11-21  
**Auditor:** Antigravity Autonomous Orchestrator  
**Status:** COMPLETE (Phase 11)

---

## 1. Prioritized Improvements Breakdown

### P0 — Security & Data Loss Fixes
- **Windows Binary Restoration (`pnpm-workspace.yaml`):** Removed Replit overrides that suppressed `win32-x64` builds of `esbuild`, `rollup`, `lightningcss`, and `@tailwindcss/oxide`. Allowed native compilation without falling back to unconfigured npm proxies.
- **Fail-Closed Live Mode Enforcement:** Ensured `gate.blocked` and `gate.showLiveData` always divert live requests away from sample fixtures into `<LiveSetup />` until live Supabase adapters pass staging verification.
- **Strict Anonymization in Rules:** Added `anonymizedCandidateProjection()` to programmatically ensure candidate discovery views can never expose phone numbers, emails, or exact street addresses.
- **Prohibited Deposit / Fee Detection:** Added `hasProhibitedFee()` to automatically flag and reject fraudulent job postings asking for security deposits or registration charges.
- **Terminal Application State Protection:** Added `isValidAppStatusTransition()` ensuring withdrawn, hired, or rejected applications cannot be silently modified or reopened.

---

### P1 — Broken Core Flows Repaired
- **Cross-Platform Preinstall Execution:** Replaced POSIX `sh -c` in root `package.json` with a cross-platform Node script, allowing `pnpm install` to execute on Windows PowerShell and CMD.
- **Resilient Environment Variables in `vite.config.ts`:** Eliminated hard unhandled exceptions when `PORT` or `BASE_PATH` are unset; provided fallback defaults (`PORT=3000`, `BASE_PATH='/'`).
- **Guarded Replit Error Overlay:** Wrapped `@replit/vite-plugin-runtime-error-modal` with `process.env.REPL_ID !== undefined` so it only runs inside Replit containers and never throws in local or self-hosted environments.
- **IST Midnight Application Reset:** Implemented and validated date boundary calculations ensuring the 20/day limit correctly resets at midnight IST (00:00:00 Asia/Kolkata).

---

### P2 — UX & Performance Optimizations
- **Expanded Test Suite:** Added 5 additional business rules and edge-case unit tests covering midnight boundary transitions, status transitions, fee detection, salary validation, and candidate anonymization (expanding test coverage to 12 automated tests).
- **Typecheck & Production Build Verification:** Verified `tsc -p tsconfig.json --noEmit` (0 errors) and `vite build` (clean 47s production bundle).
- **Responsive Layout Stability:** Verified mobile viewport responsiveness with bottom sticky navigation bar and desktop sidebar.

---

### P3 — Polish & Developer Experience
- **Structured Audit Documentation:** Created `docs/audit/` with full traceability, root cause analysis, security threat model, database review, test matrix, and release readiness.
- **Manual Migration Runbook:** Created `docs/sql-execution-order.md` with step-by-step SQL Editor templates for the 15 unexecuted migrations.
- **Updated Root `.env.example`:** Clarified public vs secret variable separation and added local port instructions.
