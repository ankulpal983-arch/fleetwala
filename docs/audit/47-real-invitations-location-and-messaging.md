# 47. Real Candidate Invitations, Geolocation Distance, and Messaging Audit

## 1. Real Candidate Invitations System
Prior versions possessed UI buttons indicating "Invites open after live launch" or "Candidate preview". In this release, Migration 023 and full frontend integration activate authentic candidate invitations.

### Database Architecture (`public.candidate_invitations`)
```sql
create table public.candidate_invitations (
  id uuid primary key default gen_random_uuid(),
  employer_id uuid not null references public.employers(id) on delete cascade,
  worker_id uuid not null references public.workers(id) on delete cascade,
  job_id uuid references public.jobs(id) on delete set null,
  invited_by uuid not null references auth.users(id),
  message text,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined', 'expired')),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '7 days'),
  responded_at timestamptz
);
```

### Invitation Security & RPC Workflows
1. **Creation (`create_candidate_invitation`)**:
   - Caller must be an authenticated user with an `active` status in `employer_memberships`.
   - Resolves candidate by anonymized candidate handle or UUID.
   - Enforces unique pending invite per employer-candidate-job pair.
   - Automatically writes an in-app notification to `public.notifications` for the target worker.
   - Writes an immutable audit entry in `public.audit_log`.
2. **Worker Acceptance/Declination (`respond_to_candidate_invitation`)**:
   - Caller must be the authenticated owner of the worker profile.
   - Validates that the invitation is in `pending` state and not expired.
   - On acceptance: updates state to `accepted`, sets `responded_at = now()`, creates an automatic job application in `public.applications` (if `job_id` is linked), and notifies the employer.
   - On declination: updates state to `declined` and notifies the employer.

### Frontend Integration (`worker-more.tsx`)
In the Worker Portal (`/applications`), a dedicated "Hiring Invitations" tab renders real-time pending invitations:
- Displays employer business trade name, job opening, custom employer message, and invitation expiry countdown.
- Actions: **Accept Invitation** and **Decline** trigger `respondToLiveCandidateInvitation()` RPC and provide immediate user feedback.

---

## 2. Geolocation & Haversine Distance Calculation
In `worker-jobs.tsx`, geolocation is connected to standard browser APIs:
```typescript
const requestGps = () => {
  if (!navigator.geolocation) {
    toast({ title: 'Geolocation unavailable', description: 'Your browser does not support geolocation.', variant: 'destructive' });
    return;
  }
  setGpsStatus('acquiring');
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      setCoordinates({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      setGpsStatus('granted');
      toast({ title: 'Location updated', description: 'Displaying logistics jobs near your current coordinates.' });
    },
    (err) => {
      setGpsStatus('denied');
      toast({
        title: 'Location access denied',
        description: 'Location permission is disabled. Choose your city or area manually from the filters.',
      });
    },
    { timeout: 10000, enableHighAccuracy: true }
  );
};
```
- **Privacy First**: Exact GPS coordinates are never broadcast to other users; they are solely utilized client-side to compute distance offsets to job distribution warehouses.
- **Indian Logistics Hub Centers**: Pre-configured regional coordinates for major hubs (Bengaluru Whitefield/Peenya, Delhi NCR Gurugram/Noida, Mumbai Bhiwandi/Kurla, Hyderabad Shamshabad).

---

## 3. Real In-App Notification and Chat Pipeline
- **Real-Time Database Triggers**: Application status updates and candidate invitations automatically populate `public.notifications`.
- **Channel Security**: Direct messaging (`public.messages`) enforces RLS:
  - Workers can only message employers where an active application or invitation exists.
  - Messages are validated against anti-spam heuristics and character limits.
  - Unauthenticated access is blocked with 42501.
