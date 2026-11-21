# FleetWala database dictionary

**Schema proposal only — migrations are UNEXECUTED and not production-ready.**
All identities are Supabase Auth UUIDs (`auth.users.id`); there is no secondary
identity provider. Times are `timestamptz` unless noted. RLS and grants are
defined in migration 11 and remain unverified against a live database.

## Identity and organizations

| Table | Columns / purpose |
|---|---|
| `user_accounts` | `user_id` Auth PK/FK; `account_state` active/suspended/deleted; optional `display_label`; created/updated times. Signup trigger creates this row. |
| `employers` | `id`; legal name; employer type (company/vendor DSP/agency); verification state; `created_by` Auth UUID; timestamps. Organization setup is trusted-owner provisioned only. |
| `employer_memberships` | `id`; employer/Auth user; owner/manager/recruiter role; invited/active/suspended/removed state; created time; unique employer/user. Client cannot create or elevate memberships. |
| `admin_principals` | Auth UUID PK; `provisioned_by`, `provisioned_at`, reason. No client grants or self-provisioning path; trusted project owner inserts through SQL Dashboard. |

## Worker-owned profile and privacy

| Table | Columns / purpose |
|---|---|
| `workers` | `id`; unique Auth `user_id`; full name, phone, email, photo object path, address, city, postal code (private PII); category, experience band, vehicle, own-vehicle/fuel flags, availability; `discoverable` defaults false; account state; timestamps. Row access is owner-only (admin policy separately present); employer access is never direct. |
| `worker_preferences` | Worker PK/FK; radius defaults 15 km; preferred city/categories/shifts; discovery-consent timestamp; updated time. |
| `worker_skills` | UUID; worker FK; skill label and creation time; unique worker/skill. |
| `worker_documents` | UUID; worker FK; private Storage object path; document kind, original filename, MIME, byte size and created time. Contains metadata only, no signed/public URL. |

## Jobs and applications

| Table | Columns / purpose |
|---|---|
| `jobs` | UUID; employer and creator Auth FKs; title/category/description; city/area/postal code/work address; INR salary bounds; licence requirement; draft/pending_review/published/rejected/paused/closed state; review note/actor/time; expiry and timestamps. Direct clients can create/edit draft fields only. |
| `job_status_history` | Identity PK; job; old/new state; actor, reason and change time. |
| `employer_verification_reviews` | Identity PK; employer; reviewer Auth UUID; verified/rejected/suspended decision; reason/time. |
| `job_applications` | UUID; worker/job FKs; status; creation/update times; unique worker/job. Client insert/update prohibited. Includes withdrawn records in daily IST cap. |
| `application_status_history` | Identity PK; application; old/new state; actor/reason/time. |
| `saved_jobs` | Composite worker/job PK and creation time. Worker-owned; live-job save policy. |

## Notifications and communication

| Table | Columns / purpose |
|---|---|
| `notifications` | UUID; Auth owner; kind; JSON object payload; read time; creation time. Owner reads and may update read timestamp only; trusted writers required. |
| `conversations` | UUID; unique application FK; creation time. No free-form direct conversation creation. |
| `conversation_participants` | Composite conversation/Auth UUID PK and join time. Membership is generated through trusted conversation routine. |
| `messages` | UUID; conversation, sender Auth UUID, bounded text body and creation time. Read is participant-only; send via checked RPC. |

## Billing, trust and support

| Table | Columns / purpose |
|---|---|
| `billing_settings` | Singleton boolean PK; `enabled=false`; job price 99 INR and candidate unlock price 10 INR; updated time. Defaults are proposed, not approved commercial terms. |
| `payment_orders` | UUID; employer; purpose; INR amount; payment state; unique provider reference; created time. No client writes or grant-on-payment logic. |
| `payment_events` | UUID; unique provider event ID; optional order; verification flag; JSON event payload; receive time. Admin read-only. |
| `job_entitlements` | UUID; employer/job; optional unique payment order; grant time. No grant function or client writes. |
| `contact_unlocks` | UUID; employer/worker; optional unique payment order; grant time; unique employer/worker prevents duplicate pair unlock. No reveal endpoint exists in this proposal. |
| `payment_disputes` | UUID; payment order; reporter Auth UUID; ticket state; details; creation time. |
| `audit_log` | Identity PK; optional actor; action/entity type/entity ID; JSON details; creation time. Trusted functions write; admin reads. Keep PII out of event details. |
| `support_tickets` | UUID; opener Auth UUID; optional employer; subject/details; ticket state; timestamps. Owner insert/read and admin read; handling workflow is not implemented. |
| `user_reports` | UUID; reporter and optional reported Auth UUID/job; details; ticket state and creation time. Owner insert/read and admin read. |

## Database functions and key invariants

- `apply_to_job(job_id)` derives identity from `auth.uid()`, takes a worker row
  lock, returns an existing unique application before counting, locks an
  eligible published/unexpired job and verified employer, and counts the
  worker's all-status applications on the Asia/Kolkata calendar date. 20 are
  allowed; 21 is refused. Worker lock serializes a worker's requests across tabs.
- `submit_job(job_id)` accepts only an active owner/manager's draft and sets
  pending review; it does not publish.
- `review_job(job_id, approve, reason)` requires an admin principal and audits
  the change.
- `set_application_status(application_id, status)` permits worker-owned
  withdrawal or valid employer status changes; shortlisted status initializes
  a conversation. Terminal statuses cannot be changed.
- `send_message(conversation_id, body)` checks current active participant status, validates
  bounded text and requires the application to remain shortlisted.
- `mark_notification_read(notification_id)` is the only client-facing
  notification mutation; direct notification updates/inserts are denied.
- `admin_set_job_state(job_id, state, reason)` permits only audited admin
  pause/close/reopen transitions and requires a verified employer to reopen.
- `admin_set_account_state(user_id, state, reason)` supports admin suspension
  and writes an audit event. Trusted helpers check account state on employer
  membership and worker operations.
- `discover_workers(...)` requires active verified employer membership and
  returns only an opaque hash handle, city/category/experience/vehicle for
  opted-in, active workers; it does not return PII.
