# Requirements traceability

Legend: **PILOT** browser-local demonstration; **DRAFT SQL** generated but unexecuted; **BLOCKED** external setup/approval; **NOT DELIVERED** incomplete production feature.

| Requirement from supplied TXT | Source classification | Evidence / current status |
| --- | --- | --- |
| Original PRD reconciliation | TXT instruction | UNVERIFIED: PDF missing |
| Three responsive portals | OWNER OVERRIDE | PILOT in `artifacts/fleetwala/src` |
| Next.js App Router | TXT architecture | NOT DELIVERED: selected React + Vite output followed instead |
| Supabase-only auth | OWNER OVERRIDE | Adapter code; actual delivery/session tests BLOCKED |
| Secure privileged admin access | TXT security | DRAFT SQL; pilot switcher is not auth; live portal NOT DELIVERED |
| Logistics-only roles | Stated original rule, unverified | PILOT sample roles |
| Free worker apply | Stated original rule, unverified | PILOT; no worker payment collection |
| Atomic 20/day IST cap | Stated original rule, unverified | DRAFT SQL; concurrency and midnight tests NOT TESTED |
| Only approved live jobs | Stated original rule, unverified | PILOT filtering and DRAFT SQL; stale-page negative tests NOT TESTED |
| 15 km default with fallback | Stated original rule, unverified | PILOT preference, approximate city matching; exact geospatial search NOT DELIVERED |
| Discovery off by default | Stated original rule, unverified | PILOT + DRAFT SQL default; live opt-out NOT TESTED |
| No candidate PII in preview | Stated original rule, unverified | Anonymous sample records + DRAFT SQL projection; REST/hydration tests NOT TESTED |
| Licence optional, no standard Aadhaar | Stated original rule, unverified | Product baseline; private documents live flow NOT DELIVERED |
| Private signed storage | TXT security | DRAFT SQL; upload scanning/signed link expiry NOT TESTED |
| Worker save/apply/profile | Stated original rule, unverified | PILOT local persistence; live data adapters NOT DELIVERED |
| Organization tenancy | ENGINEERING PROPOSAL | DRAFT SQL; multi-employer tests NOT TESTED |
| Employer drafts and moderation | OWNER OVERRIDE | PILOT + DRAFT SQL; live moderation NOT TESTED |
| ₹99 posting/₹10 contact pricing | Stated future PRD rule, unverified | Disabled product surface + DRAFT SQL; provider pending |
| Payment order/webhook reconciliation | TXT engineering | NOT DELIVERED; no endpoint claims payment success |
| Text-only authorized chat | Stated original rule, unverified | PILOT + DRAFT SQL; real subscriptions NOT DELIVERED |
| Notifications | Stated original rule, unverified | PILOT + DRAFT SQL; live delivery NOT TESTED |
| English/Hindi decision | Stated original rule, unverified | English baseline, Hindi unapproved |
| Audit and support | ENGINEERING PROPOSAL | PILOT + DRAFT SQL; operational service NOT DELIVERED |
| SQL migration files | TXT deliverable | `supabase/migrations/`; UNEXECUTED |
| Production QA/security certification | TXT deliverable | NOT DELIVERED; see `qa_results.md` |
| Public launch | TXT release discipline | NOT READY |

No row labeled DRAFT SQL or PILOT satisfies the corresponding live-production acceptance criterion by itself.
