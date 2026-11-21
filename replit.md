# FleetWala

India-first logistics hiring for workers and employers, with a separate trust/admin surface. The current delivery is a labeled browser-local pilot, not a live recruitment service.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- Managed workflow `artifacts/fleetwala: web` — run the FleetWala preview
- `pnpm --filter @workspace/fleetwala run typecheck` — check frontend TypeScript
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- FleetWala configuration: see `.env.example`. Supabase is explicitly requested; do not substitute the unused scaffold database.

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `artifacts/fleetwala/` — responsive React + Vite application
- `supabase/migrations/` — individually numbered, UNEXECUTED external database proposals
- `docs/` — requirements, decisions, risks, QA evidence and launch runbooks
- `README_FIRST.md` — beginner-friendly handoff and manual setup checklist

## Architecture decisions

- The user's selected React + Vite output was followed despite the uploaded TXT specifying Next.js. This deviation is explicit; do not claim Next.js compliance.
- Supabase Auth exclusively, never Clerk or home-grown authentication. The uploaded instructions explicitly override the earlier PRD's auth choice.
- The original 14-page PRD PDF was not uploaded; original-PRD reconciliation remains UNVERIFIED until it is read.
- Browser-local pilot state is not real authorization, business storage or proof of the daily application cap. Live mode remains blocked pending real adapters and staged tests.
- No real billing, SMS, production migrations or production launch without required configuration and approval.

## Product

Worker job discovery, saved jobs, applications and privacy; employer drafts and applicant workflows; admin trust/moderation, demonstrated with sample data.

## User preferences

- Product scope is India-first delivery, pickup/drop, warehouse and hub hiring, not a general job portal.
- Workers apply free, maximum 20 successful applications per Asia/Kolkata day including withdrawn applications by conservative proposal; the 20th is permitted.
- Discoverability defaults OFF. Applying does not grant employer access to worker contact details. Candidate previews must be anonymized.
- Aadhaar is not a standard profile requirement; driving licence is optional unless an individual job requires it.
- Text-only authorized chat; no AI matching, voice/video, payroll, escrow, attendance or salary disbursement in initial scope.
- English is baseline; Hindi remains an open decision. ₹99 job/₹10 contact pricing is proposed and payments remain disabled.

## Gotchas

- Generated SQL has never been applied. A script existing is not evidence of syntax, authorization or concurrency correctness.
- Never enable live mode solely because a public Supabase key has been supplied; wire and verify actual live data flows first.
- A preview role/workspace selector is not and must never become production role provisioning.
- The existing Express/Drizzle scaffold is not FleetWala's production backend.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
