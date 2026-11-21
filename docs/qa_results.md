# QA evidence and outstanding verification

## Evidence policy

This is the first pilot build. Full browser end-to-end automation and independent security/code-review passes were not performed. SQL has not been executed on Supabase. No OTP or billing verification was attempted without an approved external environment.

Compilation, service startup and visual checks will be recorded below when actually executed. A screenshot only verifies visible rendering; it does not prove a click path, persistence, RLS, role authorization, GPS, payment safety or a daily application cap.

## Mandatory matrix status

| IDs | Area | Status / reason |
| --- | --- | --- |
| T01–T04 | OTP, resend, sessions/logout | NOT TESTED: Supabase and SMS unconfigured |
| T05–T09 | Profile/storage/admin/tenant isolation and suspension | NOT TESTED: ordinary-user staged project unavailable |
| T10–T12 | Default privacy, opt-out, PII-free payload | Pilot design only; live REST/JSON verification NOT TESTED |
| T13–T14 | Live job eligibility and stale-page rejection | Pilot only; staged RPC tests NOT TESTED |
| T15 | 15 km/default/manual fallback | Pilot preference only; exact distance NOT DELIVERED |
| T16–T20 | Duplicate, 20/day, concurrency, midnight | SQL draft only; database tests NOT TESTED |
| T21 | Save persists across logout/login | Pilot browser persistence is not authenticated persistence; NOT TESTED live |
| T22–T25 | Status authorization, chat, no contact by applying | SQL/pilot only; negative-case tests NOT TESTED |
| T26–T31 | Payment verification and duplicate unlocks | NOT TESTED: billing disabled, gateway not selected |
| T32–T34 | Signed links, uploads and attack cases | NOT TESTED: private live flow unavailable |
| T35 | Responsive rendering | See actual screenshot observations below |
| T36–T38 | Permissions, slow/offline and accessibility | NOT TESTED interactively |
| T39 | Production build | See actual command evidence below |
| T40–T41 | Fresh migrations and ordinary-JWT RLS | NOT TESTED: no staging connection |
| T42 | Secrets/browser/Git | No credentials supplied or printed; comprehensive scan NOT PERFORMED |
| T43–T45 | Audit, external failures, deleted/suspended accounts | NOT TESTED in live environment |

## Executed first-build checks

- **PASS — parent execution:** `pnpm run typecheck`. All shared libraries and all four leaf packages (FleetWala, API server, mockup sandbox and scripts) completed with exit code 0.
- **PASS — frontend specialist execution:** `pnpm --filter @workspace/fleetwala test`, seven `node:test` cases reported passing: IST date rollover, candidate/day counting, 20/day helper boundary, live job helper, discovery default, Indian phone normalization and closed live-data gate. These are pure helper tests, **not** DB concurrency or RLS tests.
- **PASS — frontend specialist execution:** production build reported successful. Its initial build required explicit development build environment values; see final build result below for the latest asset change.
- **PASS — service startup:** managed `artifacts/fleetwala: web` workflow reached Vite ready in 289 ms at the assigned service port. No runtime error was emitted in the startup log.
- **PASS — visual rendering only:** worker `/` at 1440×1000 and 390×844, employer `/employer` at 1440×1000, admin `/admin` at 1440×1000. All four screenshots rendered the intended portal with explicit pilot labeling and no browser errors. No dialogs, form submissions, authenticated state or offscreen content were verified by these captures.
- Screenshots saved under ignored `generated-artifacts/`: `worker-desktop.jpg`, `worker-mobile.jpg`, `employer-desktop.jpg`, `admin-desktop.jpg`. These are local generated evidence, not committed production assets.
- Optimized the generated marketing image from 2,412,369 bytes to 310,132 bytes; the large source is retained only in ignored generated output.
- Browser zoom restrictions removed; pilot crawler indexing disabled; no accessibility certification is implied.
- **PASS — final parent execution after image/metadata changes:** `pnpm --filter @workspace/fleetwala run typecheck && PORT=18577 BASE_PATH=/ pnpm --filter @workspace/fleetwala run build` exited 0. Vite transformed 2,290 modules and built in 12.61 seconds. Final output: image 310.13 kB, CSS 116.78 kB (19.43 kB gzip), JS 681.52 kB (210.13 kB gzip). Non-blocking warnings: stock UI sourcemap locations, upstream Zod comment annotations, and a bundle chunk over 500 kB. Route-based code splitting remains a performance improvement before launch.
- Final managed workflow restart succeeded after the asset and metadata batch.

## Remaining staging test procedure

Use isolated normal workers A/B, organizations A/B, and a separately provisioned admin. Test direct authenticated REST/RPC requests, not just hidden navigation controls. Keep signed tokens private.

1. Worker A must not select/update B's profile/documents; public visitors must not read jobs or candidates.
2. Employer A cannot access B's drafts/applicants or submit for B by changing an ID.
3. Attempt `user_metadata.role=admin` and direct role/membership insertion; both must fail.
4. Prepare at least 22 approved active jobs. Apply concurrently using separate connections with one worker JWT; at most 20 unique rows may exist for that IST day. Repeated requests to the same job return one application, not multiple counts.
5. Test immediately before/after `Asia/Kolkata` midnight with a controlled test clock or test-only fixture timestamps; never alter a live worker's production history.
6. Pause or expire a job after opening its detail; apply must reject.
7. Opt in then out; next candidate discovery response must exclude the worker. Inspect JSON, HTML and network payloads for identifying fields.
8. Test unauthorized chat read/write and subscriptions, including previously permitted but suspended employers.
9. After a gateway is approved, verify signatures, amounts, currency, account/order/purpose, pending failures and replay behavior before any entitlement exists.
10. Verify storage expiry, content/type/size and cross-worker access using normal clients.

Record exact command, environment, observed result and corrective retest for each case. Do not use service-role access to claim RLS works.
