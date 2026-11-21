# FleetWala Repository Inventory & Evidence Report
**Document ID:** `docs/audit/01-repository-inventory.md`  
**Audit Date:** 2026-11-21  
**Auditor:** Antigravity Autonomous Orchestrator  
**Status:** COMPLETE (Phase 0)

---

## 1. Executive Summary & Root Layout

The repository opened in Antigravity was originally generated in Replit, downloaded as a ZIP archive, and extracted into `d:\Downloads\Fleet-Wala-Builder`.

### 1.1 Critical Workspace Extraction Finding
- **Outer Directory:** `d:\Downloads\Fleet-Wala-Builder`
- **Actual Monorepo Root:** `d:\Downloads\Fleet-Wala-Builder\Fleet-Wala-Builder`
- **Finding:** A nested directory structure was created during ZIP extraction. The outer directory contains *only* the inner `Fleet-Wala-Builder` folder. Any commands (such as `pnpm install`, `pnpm run dev`, `npm start`) executed from the root workspace directory fail immediately with `ENOENT: no such file or directory, open 'package.json'`.

---

## 2. Monorepo Architecture & Package Inventory

The project is structured as a **pnpm workspace** (`pnpm-workspace.yaml`).

| Package Path | Package Name | Role / Tech Stack | Primary Scripts |
| :--- | :--- | :--- | :--- |
| `artifacts/fleetwala` | `@workspace/fleetwala` | Responsive React 19 + Vite 7 SPA (Worker, Employer, Admin portals) | `dev`, `build`, `serve`, `typecheck`, `test` |
| `artifacts/api-server` | `@workspace/api-server` | Express 5 API scaffold (healthz route) | `dev`, `build`, `start`, `typecheck` |
| `artifacts/mockup-sandbox` | `@workspace/mockup-sandbox` | Component preview sandbox | `dev`, `build`, `preview`, `typecheck` |
| `lib/api-client-react` | `@workspace/api-client-react` | TanStack React Query API hooks | (exports `./src/index.ts`) |
| `lib/api-spec` | `@workspace/api-spec` | OpenAPI 3.1 specification & Orval codegen | `codegen` |
| `lib/api-zod` | `@workspace/api-zod` | Shared Zod schemas | (exports `./src/index.ts`) |
| `lib/db` | `@workspace/db` | Drizzle ORM + PostgreSQL client | `push`, `push-force` |
| `scripts` | `@workspace/scripts` | Development maintenance scripts | `hello`, `typecheck` |
| `supabase/migrations` | N/A | 15 unexecuted SQL migrations (001 to 015) | N/A |

---

## 3. Tooling, Runtime & Dependency Analysis

- **Node.js Runtime:** v22.22.2 installed locally (Replit config specified `nodejs-24`).
- **Package Manager:** `pnpm` (lockfile: `pnpm-lock.yaml`, version 9 catalog format).
- **Core Dependencies (FleetWala Web):**
  - React 19.1.0 (`@types/react` ^19.2.0)
  - Vite ^7.3.2
  - Wouter ^3.3.5 (lightweight declarative router)
  - `@tanstack/react-query` ^5.90.21
  - Tailwind CSS ^4.1.14 with `@tailwindcss/vite`
  - Radix UI primitives & Lucide React icons
  - `@supabase/supabase-js` ^2.119.2
- **Scaffold Dependencies:**
  - Express ^5.3.0
  - Drizzle ORM ^0.45.2
  - Zod catalog (`zod/v4`)
  - Esbuild 0.28.2

---

## 4. Route Hierarchy (FleetWala Web)

All routes are declared in [App.tsx](file:///d:/Downloads/Fleet-Wala-Builder/Fleet-Wala-Builder/artifacts/fleetwala/src/App.tsx):

### 4.1 Public Routes
- `/welcome` — Splash / Landing page
- `/login` — OTP & Magic Link authentication setup
- `/legal/:doc` — Terms of Service and Privacy Policy draft disclosures

### 4.2 Worker Experience Routes
- `/` — Job Feed (15 km default radius, filters, search, manual location fallback)
- `/jobs/:id` — Job Detail & Application submission
- `/saved` — Saved jobs list
- `/applications` — Application history & timeline
- `/messages` — In-app text chat (authorized participants)
- `/notifications` — System and application status notifications
- `/profile` — Worker onboarding, vehicle, license, skills profile
- `/settings` — Privacy settings (discoverability toggle default OFF)
- `/support` — Help, ticket submission & safety guide

### 4.3 Employer Experience Routes
- `/employer` — Hiring overview & key metrics
- `/employer/jobs` — Job posting, drafts, and status management
- `/employer/applicants` — Applicant review pipeline
- `/employer/candidates` — Anonymized opted-in candidate discovery
- `/employer/billing` — Planned billing overview (currently disabled)
- `/employer/team` — Organization staff & recruiter seat management

### 4.4 Admin & Moderation Routes
- `/admin` — Trust & operations overview
- `/admin/jobs` — Job moderation queue (approve/reject/pause)
- `/admin/employers` — Employer verification queue (verify/suspend)
- `/admin/audit` — Audit log trail
- `/admin/support` — Support ticket queue

---

## 5. Environment Variables & Secret Safety Audit

Inspected `.env.example` in [nested repo root](file:///d:/Downloads/Fleet-Wala-Builder/Fleet-Wala-Builder/.env.example):
- `VITE_SUPABASE_URL` — Supabase project URL (placeholder)
- `VITE_SUPABASE_PUBLISHABLE_KEY` — Supabase publishable/anon key (placeholder)
- `VITE_ENABLE_LIVE` — Feature flag for live data mode (set to `false`)

**Secret Safety Findings:**
- No hardcoded secrets, service role keys, DB passwords, or SMS API keys found in checked-in files.
- Client uses only `VITE_` public variables.
- Neither `PORT` nor `BASE_PATH` is declared in `.env.example`, though both are strictly required by `artifacts/fleetwala/vite.config.ts`.

---

## 6. Provisional Preview Root-Cause Hypothesis

Before reproducing the preview failure, our static inspection revealed the following exact causes:

1. **Nested Directory Extraction:**
   - The files live at `Fleet-Wala-Builder/Fleet-Wala-Builder`, so running commands from `d:\Downloads\Fleet-Wala-Builder` fails with missing `package.json`.
2. **Missing Dependencies (`node_modules`):**
   - `node_modules` does not exist. No packages have been installed.
3. **Strict Environment Variable Checks in `vite.config.ts`:**
   - [vite.config.ts](file:///d:/Downloads/Fleet-Wala-Builder/Fleet-Wala-Builder/artifacts/fleetwala/vite.config.ts#L8-L28) unconditionally throws:
     - `throw new Error('PORT environment variable is required but was not provided.')`
     - `throw new Error('BASE_PATH environment variable is required but was not provided.')`
   - In Replit workflows, `PORT` and `BASE_PATH` are auto-injected. Outside Replit or without manual definition, `vite` crashes immediately upon launch.
4. **Replit-Specific Plugins in `vite.config.ts`:**
   - `@replit/vite-plugin-runtime-error-modal` is imported unconditionally and may fail or interfere outside Replit.
5. **Windows Shell Incompatibility in `package.json`:**
   - The root `package.json` `preinstall` script uses `sh -c '...'`, which fails in Windows PowerShell/cmd environments where `sh` is not in PATH.
6. **Windows Incompatibility in `artifacts/api-server/package.json`:**
   - `"dev": "export NODE_ENV=development && ..."` uses Unix `export`, failing on Windows PowerShell.
