# FleetWala schema relationship diagram

**Proposed PostgreSQL schema; UNEXECUTED and not production-ready.**
Identity arrows to Auth reference Supabase `auth.users(id)`. Worker discovery
does not expose the worker relation directly to employers.

```mermaid
erDiagram
  AUTH_USERS ||--|| USER_ACCOUNTS : owns
  AUTH_USERS ||--o| WORKERS : has_private_profile
  AUTH_USERS ||--o{ EMPLOYER_MEMBERSHIPS : member
  AUTH_USERS ||--o{ ADMIN_PRINCIPALS : owner_provisioned
  EMPLOYERS ||--o{ EMPLOYER_MEMBERSHIPS : scopes
  EMPLOYERS ||--o{ JOBS : owns
  JOBS ||--o{ JOB_STATUS_HISTORY : changes
  EMPLOYERS ||--o{ EMPLOYER_VERIFICATION_REVIEWS : reviewed
  WORKERS ||--o{ WORKER_SKILLS : has
  WORKERS ||--o| WORKER_PREFERENCES : configures
  WORKERS ||--o{ WORKER_DOCUMENTS : owns_private_objects
  WORKERS ||--o{ JOB_APPLICATIONS : applies
  JOBS ||--o{ JOB_APPLICATIONS : receives
  JOB_APPLICATIONS ||--o{ APPLICATION_STATUS_HISTORY : changes
  WORKERS ||--o{ SAVED_JOBS : saves
  JOBS ||--o{ SAVED_JOBS : saved_for
  AUTH_USERS ||--o{ NOTIFICATIONS : receives
  JOB_APPLICATIONS ||--o| CONVERSATIONS : authorizes_after_shortlist
  CONVERSATIONS ||--o{ CONVERSATION_PARTICIPANTS : includes
  AUTH_USERS ||--o{ CONVERSATION_PARTICIPANTS : participates
  CONVERSATIONS ||--o{ MESSAGES : contains
  EMPLOYERS ||--o{ PAYMENT_ORDERS : orders
  PAYMENT_ORDERS ||--o{ PAYMENT_EVENTS : receives
  PAYMENT_ORDERS ||--o| JOB_ENTITLEMENTS : may_fund
  PAYMENT_ORDERS ||--o| CONTACT_UNLOCKS : may_fund
  EMPLOYERS ||--o{ CONTACT_UNLOCKS : unlocks_pair
  WORKERS ||--o{ CONTACT_UNLOCKS : pair_target
  AUTH_USERS ||--o{ SUPPORT_TICKETS : opens
  AUTH_USERS ||--o{ USER_REPORTS : reports
  AUTH_USERS ||--o{ AUDIT_LOG : acts
```

## Trust boundaries

- `workers` contains personal contact/address/profile fields. Table RLS is
  owner-only for regular users. `discover_workers` is a narrowly scoped
  employer RPC that selects only opaque handle, city, category, experience and
  vehicle for active profiles with explicit discoverability on.
- Application writes, status changes, moderation, chat sends, admin account
  state changes, membership setup and audit writes are trusted routines or
  owner-only provisioning; clients do not receive direct write grants for the
  underlying sensitive ledgers.
- `worker-private-documents` is a private Storage bucket with owner-UUID
  object paths. Metadata is stored separately and does not publish object URLs.
- Billing ledger tables are read-only to clients and the billing singleton is
  disabled. No payment callback, entitlement grant, or contact-return endpoint
  is provided.
