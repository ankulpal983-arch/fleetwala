# FleetWala Preview Failure Root Cause & Repair Report
**Document ID:** `docs/audit/02-preview-root-cause.md`  
**Audit Date:** 2026-11-21  
**Auditor:** Antigravity Autonomous Orchestrator  
**Status:** REPAIRED & VERIFIED (Phase 1)

---

## 1. Problem Statement

The repository was exported from Replit as a ZIP archive and extracted locally. When opening the workspace in Antigravity or running local startup scripts, the preview server failed to run.

---

## 2. Reproduction Steps & Exact Error Evidence

### Reproduction Step 1: Execution from Workspace Root (`d:\Downloads\Fleet-Wala-Builder`)
- **Command:** `corepack pnpm run dev`
- **Exit Code:** `1`
- **Captured Error Output:**
  ```text
  Error: ERR_PNPM_NO_IMPORTER_MANIFEST_FOUND
    × No package.json, package.json5, or package.yaml was found in "D:\Downloads\Fleet-Wala-Builder"
  ```
- **Evidence:** The ZIP extraction created an extra nested directory level (`Fleet-Wala-Builder/Fleet-Wala-Builder`). The root workspace opened in the IDE contained no `package.json`.

---

### Reproduction Step 2: Execution inside nested folder (`Fleet-Wala-Builder/Fleet-Wala-Builder`)
- **Command:** `corepack pnpm --filter @workspace/fleetwala run dev`
- **Exit Code:** `1`
- **Captured Error Output:**
  ```text
  Scope: 2 of 9 workspace projects
  . preinstall$ sh -c 'rm -f package-lock.json yarn.lock; case "$npm_config_user_agent" in pnpm/*) ;; *) echo "Use pnpm instead" >&2; exit 1 ;; esac'
  . preinstall: 'sh' is not recognized as an internal or external command,
  . preinstall: operable program or batch file.
  . preinstall: Failed
  Error: ERR_PNPM_EXECUTOR_LIFECYCLE_SCRIPT_FAILED
  ```
- **Evidence:** The root `package.json` had a POSIX `sh -c` shell script in `preinstall`. In Windows environments where `sh` is not in standard PATH, the script fails immediately, aborting pnpm.

---

### Reproduction Step 3: Package Installation with Suppressed Windows Binaries
- **Command:** `corepack pnpm install`
- **Exit Code:** `1`
- **Captured Error Output:**
  ```text
  .../esbuild@0.28.2/node_modules/esbuild postinstall$ node install.js
  .../esbuild@0.28.2/node_modules/esbuild postinstall: [esbuild] Failed to find package "@esbuild/win32-x64" on the file system
  .../esbuild@0.28.2/node_modules/esbuild postinstall: [esbuild] Trying to install package "@esbuild/win32-x64" using npm
  ```
- **Evidence:** `pnpm-workspace.yaml` contained platform overrides generated for Replit's Linux container that explicitly blocked all Windows binaries (`@esbuild/win32-x64: '-'`, `@rollup/rollup-win32-x64-msvc: '-'`, `@tailwindcss/oxide-win32-x64-msvc: '-'`, `lightningcss-win32-x64-msvc: '-'`). On Windows, essential native build binaries were suppressed from installation.

---

### Reproduction Step 4: Strict Environment Variable Checks in `vite.config.ts`
- **Code:** [vite.config.ts](file:///d:/Downloads/Fleet-Wala-Builder/Fleet-Wala-Builder/artifacts/fleetwala/vite.config.ts#L8-L28)
- **Captured Error Throw:**
  ```text
  const rawPort = process.env.PORT;
  if (!rawPort) throw new Error('PORT environment variable is required but was not provided.');
  const basePath = process.env.BASE_PATH;
  if (!basePath) throw new Error('BASE_PATH environment variable is required but was not provided.');
  ```
- **Evidence:** Replit injects `PORT` and `BASE_PATH` automatically in its cloud container. Outside of Replit or without manual definitions, Vite crashed unconditionally upon startup.

---

## 3. Systematic Repairs Applied

1. **Created Dedicated Git Branch:**
   - Switched to dedicated branch `audit-and-preview-repair` to protect existing code.
2. **Cross-Platform Preinstall Script:**
   - Replaced POSIX `sh -c` with cross-platform Node script:
     `"preinstall": "node -e \"const agent = process.env.npm_config_user_agent || ''; if (agent && !agent.startsWith('pnpm/')) { console.error('Use pnpm instead'); process.exit(1); }\""`
3. **Restored Windows Native Binaries in `pnpm-workspace.yaml`:**
   - Removed the suppression overrides for `@esbuild/win32-*`, `@rollup/rollup-win32-*`, `@tailwindcss/oxide-win32-*`, and `lightningcss-win32-*`.
4. **Resilient Port & Base Path Handling in `vite.config.ts`:**
   - Defaulted `rawPort` to `process.env.PORT || '3000'` and `basePath` to `process.env.BASE_PATH || '/'`.
   - Guarded `@replit/vite-plugin-runtime-error-modal` so it only activates inside Replit (`process.env.REPL_ID !== undefined`).
5. **Clean Dependency Installation:**
   - Executed `corepack pnpm install` cleanly in 6.5s.

---

## 4. Verification Evidence

### 4.1 Unit Test Suite
- **Command:** `corepack pnpm --filter @workspace/fleetwala run test`
- **Result:** `PASS (7/7 tests pass)`
- **Duration:** 2507 ms

### 4.2 TypeScript Typecheck
- **Command:** `corepack pnpm --filter @workspace/fleetwala run typecheck`
- **Result:** `PASS (0 errors)`

### 4.3 Production Build
- **Command:** `corepack pnpm --filter @workspace/fleetwala run build`
- **Result:** `PASS (dist/public bundle generated cleanly)`
- **Duration:** 47.35 s

### 4.4 Live Preview Startup & HTTP Verification
- **Command:** `corepack pnpm --filter @workspace/fleetwala run dev`
- **Host & Port:** `http://localhost:3000/` (Vite v7.3.7)
- **HTTP Status Check:**
  - `GET /` -> **HTTP 200** (Root container rendered, Title: *FleetWala · Local logistics jobs*)
  - `GET /login` -> **HTTP 200**
  - `GET /welcome` -> **HTTP 200**
  - `GET /employer` -> **HTTP 200**
  - `GET /admin` -> **HTTP 200**

---

## 5. Gate Status

- **Phase 1 Gate:** **PASS**
- **Evidence:** Terminal logs, HTTP 200 responses, tests passing, production bundle built, and server live on `http://localhost:3000`.
