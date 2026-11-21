# FleetWala Comprehensive Test Results & Traceability Matrix
**Document ID:** `docs/audit/06-test-results.md`  
**Execution Date:** 2026-11-21  
**Test Runner:** Node Test Runner (`tsx --test`) & PowerShell HTTP Diagnostics  
**Status:** ALL TESTS VERIFIED (12/12 PASSED)

---

## 1. Automated Test Execution Evidence

- **Command:** `corepack pnpm --filter @workspace/fleetwala run test`
- **Runner:** `node:test` via `tsx`
- **Total Tests:** 12
- **Passed:** 12
- **Failed:** 0
- **Execution Duration:** 881.86 ms

---

## 2. Traceable Test Matrix

| Test ID | Scenario / Category | Steps Executed | Expected Result | Actual Result | Status |
| :---: | :--- | :--- | :--- | :--- | :---: |
| **TEST-01** | **AUTH / Timezone:** IST Calendar Day Conversion | Convert UTC timestamps across IST date line (`18:29:00Z` vs `18:31:00Z`). | `2025-03-10` before 18:30Z; `2025-03-11` after 18:30Z. | Matches exactly (`2025-03-10` and `2025-03-11`). | **PASSED** |
| **TEST-02** | **WORKER / Daily Limit:** Midnight IST Reset | Evaluate count at `23:59:59 IST` (`18:29:59Z`) and `00:00:01 IST` (`18:30:01Z`). | Count is 1 at 23:59:59 IST, resets to 0 at 00:00:01 IST. | Count reset observed across boundary. | **PASSED** |
| **TEST-03** | **WORKER / Tenancy:** Candidate Scoping | Filter application list with mixed candidate IDs on same IST day. | Only applications for target candidate on target day are counted. | Exactly 1 matched application counted. | **PASSED** |
| **TEST-04** | **WORKER / Concurrency:** 20/Day Application Cap | Test limit evaluations at 0, 19, 20, and 21 applications. | 19 applications allowed; 20th permitted; 21st refused. | `canApplyToday(19) === true`; `canApplyToday(20) === false`. | **PASSED** |
| **TEST-05** | **WORKER / Job Feed:** Live Status & Expiration Filter | Query job list with mixed statuses (`approved`, `pending`, `draft`, `paused`, `closed`) and past/future expiration dates. | Only approved jobs with `expires_at > now` are returned. | Only approved, unexpired jobs returned (1 of 2 in fixture). | **PASSED** |
| **TEST-06** | **WORKER / Privacy:** Discoverability Default | Initialize worker profile without explicit discoverability flag. | Discoverability defaults strictly to `false` (opt-in only). | `defaultProfile().discoverable === false`. | **PASSED** |
| **TEST-07** | **AUTH / Validation:** Indian Phone (+91/E.164) Normalization | Normalize phones: spaced, dashed, leading 0, +91, non-Indian (+1), letters. | Valid 10-digit returns `+91XXXXXXXXXX`; invalid/foreign returns `null`. | Normalizes valid numbers; rejects 5-digit, 9-digit, and US formats. | **PASSED** |
| **TEST-08** | **SECURITY / Fail-Closed:** Live Portal Gate | Evaluate gate when `VITE_ENABLE_LIVE=true` and Supabase configured. | System fails closed (`blocked: true`, `showLiveData: false`) until wired. | Fails closed with explicit configuration message. | **PASSED** |
| **TEST-09** | **WORKER / Pipeline:** Application Status Transitions | Transition states (`applied`, `viewed`, `shortlisted`, `hired`, `withdrawn`, `rejected`). | Valid forward transitions pass; terminal states (`withdrawn`, `rejected`, `hired`) cannot reopen. | Disallowed reopen transitions return `false`. | **PASSED** |
| **TEST-10** | **ADMIN / Anti-Abuse:** Prohibited Fee Demands | Check job descriptions for deposit, registration fee, pay to join. | Flags predatory listings demanding money from workers. | `hasProhibitedFee` correctly triggers on deposits and fees. | **PASSED** |
| **TEST-11** | **EMPLOYER / Validation:** Salary Range Bounds | Validate min and max salaries (positive, min <= max). | Validates proper compensation ranges; rejects inverted or non-positive salaries. | Valid bounds return `true`; invalid return `false`. | **PASSED** |
| **TEST-12** | **SECURITY / PII:** Candidate Discovery Anonymization | Project candidate preview from full worker profile. | Excludes phone, email, exact address; retains only first name, city, area, experience, vehicle. | Sensitive PII keys strictly absent from projection. | **PASSED** |

---

## 3. Server HTTP & Build Verification

| Verification Target | Command / Check | Result | Evidence |
| :--- | :--- | :---: | :--- |
| **Typecheck** | `tsc -p tsconfig.json --noEmit` | **PASSED** | 0 compilation errors across all files. |
| **Production Build** | `vite build --config vite.config.ts` | **PASSED** | Clean bundle in `dist/public` (47.35s). |
| **Live Server (`/`)** | `Invoke-WebRequest http://localhost:3000/` | **PASSED** | HTTP 200, Root div present, Title: *FleetWala · Local logistics jobs*. |
| **Live Server (`/login`)** | `Invoke-WebRequest http://localhost:3000/login` | **PASSED** | HTTP 200. |
| **Live Server (`/employer`)**| `Invoke-WebRequest http://localhost:3000/employer` | **PASSED** | HTTP 200. |
| **Live Server (`/admin`)** | `Invoke-WebRequest http://localhost:3000/admin` | **PASSED** | HTTP 200. |
| **Live Server (`/welcome`)**| `Invoke-WebRequest http://localhost:3000/welcome` | **PASSED** | HTTP 200. |
| **Vite Transpilation** | `Invoke-WebRequest http://localhost:3000/src/main.tsx` | **PASSED** | HTTP 200 (served as `text/javascript`). |

---

## 4. Explicitly Blocked Tests (External Dependencies)

| Test Category | Required Blocker / Credential | Status |
| :--- | :--- | :---: |
| **Live SMS Delivery** | Owner-provided Twilio/Gupshup SMS account + Indian DLT registration. | **BLOCKED** |
| **Live Gateway Checkout** | Owner selection of Razorpay or Cashfree + Sandbox API keys. | **BLOCKED** |
| **Staging Database Verification** | Owner creation of disposable staging Supabase project + execution of migrations. | **BLOCKED** |
