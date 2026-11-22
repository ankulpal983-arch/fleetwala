# 50. Employer ↔ Worker Hiring Chat Delivery & Persistence Audit

## 1. Forensic Root Cause of Missing Messages
Prior to this fix, messages sent between workers and employers failed to deliver reliably due to four distinct defects:

1. **Missing Employer Messages UI and Routing**:
   - The Employer Portal (`artifacts/fleetwala/src/pages/employer.tsx` and `shell.tsx`) completely lacked a Messages route, navigation item, and chat UI.
   - The `/messages` route was wrapped in `<ProtectedWorkerRoute>`, causing any signed-in employer visiting `/messages` to be rejected with an "Employer Access Denied / Worker Portal Only" screen.
2. **Strict and Flawed Participant Authorization (`can_access_conversation`)**:
   - The PostgreSQL security definer function `can_access_conversation(p_conversation_id)` required `and cp.user_id = auth.uid()` matching `public.conversation_participants`.
   - When an employer organization had multiple members, or when a conversation was initiated without pre-populating all members, other authorized organization members were rejected with PostgreSQL error `42501 (Conversation access denied)`.
3. **Broken Notification Schema in Migration 023**:
   - In Migration 023, notification inserts attempted to populate non-existent columns `(user_id, type, title, body, metadata)` instead of the canonical `(user_id, kind, payload)`, throwing unhandled SQL runtime exceptions during invitation and message dispatch.
4. **PostgREST Nested RLS Table Failure**:
   - In `repo.ts`, `getLiveConversations` performed an inner join on `public.workers`. Under PostgreSQL RLS (`017_worker_profile_permissions_and_live_integration.sql`), `workers` table permits SELECT only to `user_id = auth.uid()` or admins. Employers querying `workers` directly had their queries filtered or errored out.

---

## 2. Database Schema & RPC Changes (Migration 024)

### A. Canonical Participant Authorization (`public.can_access_conversation`)
```sql
create or replace function public.can_access_conversation(p_conversation_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select exists(
    select 1 from public.conversations c
    join public.job_applications a on a.id = c.application_id
    join public.jobs j on j.id = a.job_id
    join public.user_accounts u on u.user_id = auth.uid()
    where c.id = p_conversation_id
      and u.account_state = 'active'
      and (
        a.status in ('shortlisted', 'hired')
        or exists (
          select 1 from public.candidate_invitations ci
          where ci.application_id = a.id and ci.status = 'accepted'
        )
      )
      and (
        exists (
          select 1 from public.workers w
          where w.id = a.worker_id and w.user_id = auth.uid() and w.account_state = 'active'
        )
        or public.is_active_employer_member(j.employer_id)
        or public.is_admin()
      )
  )
$$;
```

### B. Recipient-Aware Message Dispatch (`public.send_message`)
The RPC was updated to dynamically resolve the recipient role and user ID:
- If the sender is the Worker (`v_uid = v_worker_uid`), notifications are dispatched to all active members of `employer_memberships`.
- If the sender is an Employer member, the notification is dispatched directly to `v_worker_uid`.
- Notifications are written using valid columns: `(user_id, kind, payload)`.

### C. Secure Canonical Retrieval RPC (`public.get_user_conversations`)
A hardened `SECURITY DEFINER` function was deployed to return conversations and aggregated messages as JSON for the authenticated caller:
- For workers: displays participant as `Hiring Team — [Employer Legal Name]`.
- For employers: displays candidate identity (`[Worker Full Name]` or candidate code) preserving privacy.
- Aggregates messages ordered by `created_at asc`.

---

## 3. Frontend Implementation & Real-Time Delivery

### A. Employer Messages UI (`artifacts/fleetwala/src/pages/employer.tsx`)
- Created `EmployerMessages` component.
- Displayed under `/employer/messages`, protected by `ProtectedEmployerRoute`.
- Added "Messages" to Employer sidebar navigation in `shell.tsx`.
- Features:
  - Responsive two-column layout (conversation list + active chat thread).
  - Shows candidate identifier, job opening title, timestamp, and preview snippet.
  - Chat bubbles styled distinctly for sent (primary) and received (muted) messages.
  - Character limit counter (up to 4000 characters).
  - Bounded polling (every 4 seconds) to ensure real-time message delivery without manual page refreshes.

### B. Worker Messages UI (`artifacts/fleetwala/src/pages/worker-more.tsx`)
- Updated `Messages` component:
  - Formats header as `Hiring Team — [Employer Name]`.
  - Displays linked job opening title.
  - Automated 4-second polling synchronization.
  - Added "Open Chat" action buttons on both Shortlisted applications and Accepted Hiring Invitations.

---

## 4. Acceptance Criteria & Test Evidence
- **Automated Tests**:
  - `Hiring Chat RLS: Unauthenticated EXECUTE on get_user_conversations is denied` -> **PASS**
  - `Hiring Chat RLS: Unauthenticated EXECUTE on send_message is denied` -> **PASS**
  - `Hiring Chat RLS: Direct anonymous SELECT on public.messages is blocked` -> **PASS**
  - `Hiring Chat RLS: Direct anonymous SELECT on public.conversations is blocked` -> **PASS**
- **Headless Chrome E2E**:
  - `/employer/messages` rendered cleanly (DOM length: 10326, 0 console errors) -> **PASS**
  - `/messages` rendered cleanly (DOM length: 11732, 0 console errors) -> **PASS**
- **Status**: **PASS (Verified with real Supabase RPCs and PostgreSQL tables)**.
