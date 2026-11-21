# Architecture and trust boundaries

## Delivered architecture

```
Browser
 ├─ React + Vite FleetWala UI
 ├─ Clearly labeled pilot fixtures + browser-local pilot state
 └─ Supabase JS authentication adapter (unverified externally)

Future verified live mode (NOT activated)
 ├─ Supabase Auth identity
 ├─ RLS-protected PostgreSQL tables and trusted RPCs
 ├─ Private Storage with owner-scoped paths and short-lived signed access
 └─ Trusted payment server/Edge Function boundary (not delivered)
```

The existing Express API was preserved; no fake production recruitment API was added to it. No Replit database was substituted for the specifically requested Supabase project.

## Pilot is not live

Browser-local sample data is permitted only in a clearly labeled pilot workspace. It is not a security boundary, cannot prove tenant isolation, and cannot enforce limits against malicious clients or multiple devices. Browser role switching, sample approval and sample application state have no production authority.

Live mode must fail closed until verified data adapters exist. A public Supabase URL/key plus a successful OTP is not a fully integrated live product. Do not route signed-in workers into sample records presented as real jobs.

## Planned live boundaries

- Identity derived from Supabase's verified user identity, not request-supplied IDs.
- Own private worker profile rows only. Employer candidate discovery returns an explicit anonymous projection; it must not return a full worker row and hide fields in CSS.
- Membership scoped to an active organization. Public user metadata cannot grant admin/membership privileges.
- Job publishing, moderation, daily application limit and status changes happen inside trusted database transactions/RPCs.
- Apply should lock one worker identity, recheck the live job and count the entire Asia/Kolkata day in the same transaction. Unique worker/job constraint makes retries safe. This is unproven until concurrency testing against staging.
- No application automatically grants contact data.
- Storage remains private; client MIME declarations alone are not sufficient content validation.
- Payment browser callbacks never grant entitlements. No gateway was selected or implemented.
- Authenticated Realtime is not enabled by default; use scoped polling until subscription authorization is proven.

## Implementation limitations

This is a Vite SPA, not Next.js. There are no Next.js server components/actions, SSR session cookies, or production payment server handlers. Avoid describing browser checks as “server protection.” Database RLS/RPC drafts are a starting point for that protection, not evidence they work.

Supabase live-data wiring, negative-case authorization tests, production rate limiting, privileged MFA enforcement, secure document content inspection and observability remain unfinished.

## Official references checked

- https://supabase.com/docs/guides/auth/phone-login
- https://supabase.com/docs/reference/javascript/auth-signinwithotp
- https://supabase.com/docs/guides/database/postgres/row-level-security

Supabase's phone guide requires an SMS provider and specifically flags Indian TRAI DLT compliance. Its RLS guide states both grants and row policies must be checked, and that policies are unproven until ordinary-role tests pass. Provider setup, project settings, OTP validity and delivery must be verified in the actual staging project, not inferred from sample documentation.
