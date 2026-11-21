# Start here — FleetWala

## What you can use now

Open FleetWala in Preview. This build is a **pilot workspace with sample data**, not a live recruitment service. Explore worker job discovery, saved jobs, applications, profile/privacy settings, employer recruitment screens and admin moderation screens. Pilot changes are stored in this browser; they are not shared with other people or devices. Do not enter real applicants' personal information.

The workspace switcher demonstrates the three products. It is **not authentication or permission enforcement**. Real administrative access must never be implemented by a switcher.

## What is not ready

Real Supabase-backed portal workflows, real SMS delivery, production multi-user authorization, storage uploads, real billing and deployment security verification remain launch blockers. Supabase authentication adapter code does not mean authentication has been verified. Setting environment variables does not complete the missing live-data wiring.

The requested original 14-page PDF was not supplied. Only the uploaded master TXT was available. All original-PRD comparisons are **UNVERIFIED**.

Your selected React + Vite web output was followed instead of the TXT's Next.js framework requirement. This is a documented architecture deviation, not a claim of Next.js compliance.

## Run and check

The FleetWala web workflow is `artifacts/fleetwala: web`. Use Run/Preview to open it. Development routing and the listening port are supplied by that workflow.

From the Shell:

```sh
pnpm --filter @workspace/fleetwala run typecheck
pnpm run typecheck
```

The generated production build is in `artifacts/fleetwala/dist/public` when built in its configured workflow environment. The build requires the workflow-supplied `PORT` and `BASE_PATH`; do not infer a production address from the preview address.

## What you need to do manually

1. Upload `FleetWala_Full_Product_Requirements_Document_PRD.pdf`.
2. Create or approve a **disposable staging Supabase project**, separate from production. No migration has been executed for you.
3. Read `supabase/migrations/README.md`. Review and apply each numbered SQL file in order in staging only. Record actual results and resolve failures before continuing. Do not run these against an existing production database.
4. Configure Supabase Phone Auth and a suitable SMS provider. Confirm Indian TRAI DLT registrations/templates and provider costs with the provider. No provider or delivery guarantee is assumed.
5. Configure employer email authentication, redirect URLs, SMTP delivery, abuse protection, and privileged-role MFA policy. Provision the first admin through a trusted database-owner process, never a public role selector.
6. Add only the **public** project URL and publishable key to application configuration using the names in `.env.example`. Never share credentials in chat.
7. Keep `VITE_ENABLE_LIVE=false` until live data flows are implemented and the ordinary-user RLS, privacy and concurrent application tests have passed.
8. Approve a payment provider and sandbox separately. ₹99/₹10 are proposed configurable prices, not permission to collect money. Billing stays disabled.
9. Supply actual support contacts and approve privacy, retention, disputes and deletion policies.
10. Review `docs/release_readiness.md` before any public launch.

## Where to look

- `docs/prd_reconciliation.md`: source limitations and overrides.
- `docs/requirements_traceability.md`: delivered versus blocked requirements.
- `docs/open_decisions.md`: concise owner decision checklist.
- `docs/architecture.md`: pilot/live trust boundaries.
- `docs/screen_routes.md`: product journeys and routes.
- `docs/database_dictionary.md`, `docs/schema_diagram.md`: database reference.
- `supabase/migrations/`: separate, unexecuted SQL deliverables.
- `docs/qa_results.md`: actual checks and explicitly untested cases.
- `docs/operations_runbook.md`: launch, incident, recovery and privacy guidance.

No specialist verdict should be interpreted as a production security certification.
