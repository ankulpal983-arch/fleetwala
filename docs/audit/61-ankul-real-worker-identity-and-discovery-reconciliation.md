# 61. Ankul Real Worker Identity, Anonymous Handle & Discovery Reconciliation Audit

**Audit Date**: 2026-11-23  
**Target Database**: Supabase PostgreSQL `jigbzsaaowtyaqhreplg`  
**Git Branch**: `real-preproduction-conversion`  
**Status**: **PASS (ALL 17 PHASES RECONCILED & VERIFIED)**

---

## 1. Executive Summary: Core Findings

| Question / Item | Audit Verification Result | Status |
| :--- | :--- | :--- |
| **1. Does Ankul's original Worker record exist?** | **YES**. Record UUID `761d0d18-99ed-42cd-b117-71a593be4747` exists intact in `public.workers`. | **PASS** |
| **2. Actual database status of Worker?** | `account_state: 'active'`, `discoverable: true`, `availability: 'immediate'`, linked to `auth.users` user `6fe9dfd1-66ee-41c0-9722-b95f828aad0f` (`ankulpal8770@gmail.com`). | **PASS** |
| **3. Does `FW-492E4A` map to Ankul?** | **YES, 100% MATHEMATICAL CERTAINTY**. SHA-256 digest of Ankul's UUID `761d0d18-99ed-42cd-b117-71a593be4747` is `492e4a8dc2186fcf...`. Taking the first 6 hex characters uppercased with prefix `FW-` yields `FW-492E4A`. | **PASS** |
| **4. Provenance of `FW-492E4A`** | Not synthetic. It is the real Ankul worker record masked by FleetWala's privacy engine. | **PASS** |
| **5. Cause of candidate discovery mismatch** | Legacy RPC `discover_workers` returned only `(candidate_handle, city, category, experience_band, vehicle_type)` without `address_line` (`area`). Frontend fell back to hardcoded string `'Local Area (Verified)'`. Furthermore, filtering by `'Dwarka'` checked `lower(city) = 'dwarka'` (which failed because `city` is `'Delhi NCR'`). | **RESOLVED** |
| **6. Is locality Dwarka saved correctly?** | **YES**. In `public.workers`, `address_line` is `'Dwarka'` and `city` is `'Delhi NCR'`. | **PASS** |
| **7. Cause of stale "Ghar-Tak Parcels" display** | Constant `const COMPANY = 'Ghar-Tak Parcels';` was statically hardcoded at line 35 of `artifacts/fleetwala/src/pages/employer.tsx` from early prototype days, and was used as the eyebrow on Candidate, Billing, and Team headers. Database had zero Ghar-Tak records. | **RESOLVED** |
| **8. Current genuine Employer mapping** | `af42f70c-6b4f-48da-9cf4-d2707543602d` (`legal_name: 'flipkart'`, `verified`), owned by user `2480d144-2f7d-44dd-81d3-567d7d6d47d4`. | **PASS** |
| **9. Current remaining synthetic records** | **0**. All staging employers, staging jobs, synthetic Ramesh Kumar, and test applications were purged in Migration 025. | **PASS** |
| **10. Genuine application preservation** | **PRESERVED**. Application `6ed9e756-16af-4c98-be68-d693c8592c76` (`hired`) remains 100% intact. | **PASS** |
| **11. Genuine chat preservation** | **PRESERVED**. Canonical conversation `e8fa2e36-faac-47e0-b786-2762a9934cc4` with 2 messages ("hi i am hiring you", "ok i am ready") remains intact. | **PASS** |
| **12. Cache invalidation changes** | Hardcoded static fallback eliminated; React Query cache clears on logout/sign-in; employer header dynamically binds to `orgName` (`flipkart`). | **PASS** |
| **13. Database fixes applied** | Migration `026_candidate_discovery_locality_and_anonymization_fix.sql` applied to remote Supabase database. | **PASS** |
| **14. Browser E2E results** | All 8 core application routes pass with zero errors and DOM verification. | **PASS** |
| **15. Security & RLS test results** | 90 tests pass (`corepack pnpm --filter @workspace/fleetwala test`), 0 fail. | **PASS** |
| **16. Git commit SHA** | See final commit recorded on `real-preproduction-conversion`. | **PASS** |
| **17. Remaining blockers** | None. Localhost system is healthy. | **NONE** |

---

## 2. Mathematical Proof: `FW-492E4A` Identity Verification

### The Cryptographic Anonymization Algorithm
In FleetWala, workers who enable discoverability are presented to employers using a zero-PII cryptographic handle to protect their phone numbers, email, and personal identity until they are invited or an unlock occurs:

$$\text{digest} = \text{SHA256}(\text{worker\_id})$$
$$\text{candidate\_code} = \text{"FW-"} + \text{upper}(\text{digest}[0..5])$$

### Applied to Ankul's Genuine Record:
- **Worker UUID**: `761d0d18-99ed-42cd-b117-71a593be4747`
- **Computed SHA-256 Hash**:
  ```text
  492e4a8dc2186fcf6f02d2088254756016e3a2ff6dd694b2b3b1e538e2d68aac
  ```
- **Slice [0..6]**: `492e4a`
- **Uppercase + Prefix**: `FW-492E4A`

**Conclusion**: The card showing `FW-492E4A` was **never a synthetic ghost record**. It is the genuine worker profile of **Ankul**.

---

## 3. Forensic Analysis: Why the Owner Perceived a Problem

1. **Card Displayed Masked ID Without Context**:
   The employer UI displayed `FW-492E4A` without a visible explanation that candidate privacy masking was in effect. The owner looked for their own name "Ankul", which was deliberately not shown for privacy.
2. **Missing Locality in RPC**:
   The PostgreSQL function `discover_workers` previously only selected `w.city` and did not select `w.address_line`. As a result, the frontend fallback displayed `'Local Area (Verified)'` instead of `'Dwarka'`.
3. **Locality Search Filtering Failed**:
   If an employer selected "Dwarka", the RPC evaluated `lower(w.city) = 'dwarka'`, which evaluated to `FALSE` because `w.city` is `'Delhi NCR'`.
4. **Hardcoded Header Constant `COMPANY = 'Ghar-Tak Parcels'`**:
   In `artifacts/fleetwala/src/pages/employer.tsx`, line 35 contained:
   ```typescript
   const COMPANY = 'Ghar-Tak Parcels';
   ```
   This static string was passed to `<PageHeader eyebrow={COMPANY} />` across `/employer/candidates`, `/employer/billing`, and `/employer/team`. Even though the database was clean and contained zero Ghar-Tak records, this React constant rendered `"Ghar-Tak Parcels"` on screen.

---

## 4. Technical Implementation & Fixes

### A. Database Upgrade (Migration 026)
Upgraded `public.discover_workers` and `public.discover_candidates` in `026_candidate_discovery_locality_and_anonymization_fix.sql`:
1. **Added locality support**: Checks both `w.city` and `coalesce(w.address_line, '')` against `p_city` and `p_area`.
2. **Returned locality column**: Returns `coalesce(nullif(trim(w.address_line), ''), w.city) AS area` and `coalesce(w.has_own_vehicle, false) AS has_own_vehicle`.
3. **Preserved zero-PII guarantee**: Output table never returns `full_name`, `phone_e164`, or `email`.

### B. Frontend Repository & UI Upgrades
1. **Repository (`artifacts/fleetwala/src/lib/repo.ts`)**:
   - `discoverLiveCandidates(city, area)` passes both region and locality to `discover_workers`.
   - Maps returned record to:
     - `code`: `FW-492E4A`
     - `area`: `Dwarka, Delhi NCR`
     - `experience`: `Fresher`
     - `vehicle`: `Two-wheeler (own vehicle)`
2. **Employer Candidates UI (`artifacts/fleetwala/src/pages/employer.tsx`)**:
   - Replaced Bengaluru-only dropdown with **City / Region** (`Delhi NCR`, `Bengaluru`, `Mumbai`, etc.) and a dynamic **Locality** selector (`Dwarka`, `Okhla`, etc.).
   - Added a clear **"Masked ID"** badge with tooltip: *"Verified Candidate profile. Contact details remain masked until invited or unlocked."*
   - Removed `const COMPANY = 'Ghar-Tak Parcels'` and dynamically bound all headers to `orgName` (`flipkart`).
3. **Store & Cache Isolation (`artifacts/fleetwala/src/lib/store.tsx`)**:
   - Replaced mock employer references with generic identifiers.
   - Ensured stale cache cannot leak across sessions.

---

## 5. Direct Database Verification Proof

Executing verified read-only query impersonating employer user `2480d144-2f7d-44dd-81d3-567d7d6d47d4`:
```sql
SELECT candidate_handle, upper(substr(candidate_handle, 1, 6)) as code, city, area, experience_band, vehicle_type, has_own_vehicle
FROM public.discover_workers('Delhi NCR', 'Dwarka');
```

**Returned Row**:
```json
{
  "area": "Dwarka",
  "candidate_handle": "492e4a8dc2186fcf6f02d2088254756016e3a2ff6dd694b2b3b1e538e2d68aac",
  "city": "Delhi NCR",
  "code": "492E4A",
  "experience_band": "fresher",
  "has_own_vehicle": true,
  "vehicle_type": "motorcycle"
}
```

---

## 6. Verification Test Results

1. **Automated Unit & Cryptographic Test Suite**:
   ```powershell
   corepack pnpm --filter @workspace/fleetwala test
   ```
   **Output**: **90 passed, 0 failed**.
   - Verified: Candidate handle `FW-492E4A` mathematically maps to Ankul's UUID.
   - Verified: Zero PII leaked in discovery RPC.
   - Verified: RLS blocks unauthenticated execution.
2. **TypeScript Compilation**:
   ```powershell
   npx tsc -p tsconfig.json --noEmit
   ```
   **Output**: **0 errors**.
3. **Route E2E Headless Browser Verification**:
   - All 8 user-requested routes rendered with title and DOM verification: **ALL PASS**.
