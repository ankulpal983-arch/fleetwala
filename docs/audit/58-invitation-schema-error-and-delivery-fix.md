# 58. Invitation Schema Error (e.trade_name) and Delivery Fix

## 1. Executive Summary & Root Cause Investigation

When employers attempted to invite candidates on FleetWala, the operation failed with the PostgreSQL runtime error:
```
ERROR: 42703: column e.trade_name does not exist
```

### Forensic Analysis of the Error:
1. **Schema Mismatch**:
   - In Migration `023_admin_provisioning_and_invitations.sql` (lines 101 and 269), the functions `public.create_candidate_invitation()` and `public.get_worker_candidate_invitations()` queried `e.trade_name`:
     ```sql
     select m.employer_id, e.trade_name into v_employer_id, v_employer_name
     from public.employer_memberships m join public.employers e on e.id = m.employer_id ...
     ```
     and:
     ```sql
     coalesce(e.trade_name, e.legal_name) as employer_name
     ```
   - Inspection of `information_schema.columns` for `public.employers` confirmed that the table schema has the canonical column **`legal_name`**, and does **not** contain `trade_name`.
2. **Notification Schema Conflict**:
   - Migration 023 also attempted to insert records into `public.notifications` using columns `(user_id, type, title, body, metadata)`, whereas the actual database table `public.notifications` is structured with `(user_id, kind, payload)`.
3. **Frontend Discovery & Invitation Action Mismatch**:
   - The Employer Candidate Discovery page (`/employer/candidates`) opened an `InviteCandidateDialog` calling `createLiveCandidateInvitation(candidate.id, jobId, message)`, which triggered the broken SQL function and failed with `column e.trade_name does not exist`.
   - FleetWala's canonical hiring funnel is **application-linked**: employers review candidates and invite applicants via `/employer/applicants` ("Invite to Discuss").

---

## 2. Technical Remediation (Migration 025)

In Migration `025_fix_invitation_schema_and_remove_test_fixtures.sql`:

### A. Repaired `create_candidate_invitation` RPC
Replaced `e.trade_name` with `e.legal_name` and updated notifications to use `(user_id, kind, payload)`:
```sql
CREATE OR REPLACE FUNCTION public.create_candidate_invitation(
  p_candidate_handle text,
  p_job_id uuid,
  p_message text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_worker_id uuid;
  v_employer_id uuid;
  v_job public.jobs%rowtype;
  v_invitation_id uuid;
  v_worker_user_id uuid;
  v_employer_name text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING errcode = '42501';
  END IF;

  -- 1. Query legal_name from public.employers
  SELECT m.employer_id, e.legal_name INTO v_employer_id, v_employer_name
  FROM public.employer_memberships m
  JOIN public.employers e ON e.id = m.employer_id
  WHERE m.user_id = v_uid AND m.state = 'active'
  LIMIT 1;

  IF v_employer_id IS NULL THEN
    RAISE EXCEPTION 'Active employer membership required to invite candidates' USING errcode = '42501';
  END IF;

  -- 2. Verify job ownership
  IF p_job_id IS NOT NULL THEN
    SELECT * INTO v_job FROM public.jobs WHERE id = p_job_id AND employer_id = v_employer_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Specified job listing does not belong to your organization';
    END IF;
  END IF;

  -- 3. Resolve worker by handle
  SELECT id, user_id INTO v_worker_id, v_worker_user_id
  FROM public.workers
  WHERE (
    encode(digest(id::text, 'sha256'), 'hex') = p_candidate_handle
    OR id::text = p_candidate_handle
    OR ('cand-' || substr(id::text, 1, 8)) = p_candidate_handle
  )
    AND discoverable = true AND account_state = 'active'
  LIMIT 1;

  IF v_worker_id IS NULL THEN
    RAISE EXCEPTION 'Candidate is not available for invitation or has disabled discoverability';
  END IF;

  -- 4. Check for duplicate pending invitation
  SELECT id INTO v_invitation_id
  FROM public.candidate_invitations
  WHERE employer_id = v_employer_id AND worker_id = v_worker_id AND status = 'pending'
    AND (job_id IS NOT DISTINCT FROM p_job_id);

  IF v_invitation_id IS NOT NULL THEN
    RAISE EXCEPTION 'A pending invitation already exists for this candidate';
  END IF;

  -- 5. Insert invitation
  INSERT INTO public.candidate_invitations (
    employer_id, worker_id, candidate_handle, job_id, message, status
  ) VALUES (
    v_employer_id, v_worker_id, p_candidate_handle, p_job_id, left(p_message, 500), 'pending'
  ) RETURNING id INTO v_invitation_id;

  -- 6. Insert notification with valid columns
  INSERT INTO public.notifications (
    user_id, kind, payload
  ) VALUES (
    v_worker_user_id,
    'candidate_invited',
    jsonb_build_object(
      'invitation_id', v_invitation_id,
      'job_id', p_job_id,
      'job_title', coalesce(v_job.title, 'General Logistics Opportunity'),
      'company', coalesce(v_employer_name, 'Logistics Partner'),
      'message', left(p_message, 500)
    )
  );

  -- 7. Record audit log
  INSERT INTO public.audit_log (actor_id, action, entity_type, entity_id, details)
  VALUES (v_uid, 'candidate_invite_sent', 'candidate_invitation', v_invitation_id::text, jsonb_build_object(
    'employer_id', v_employer_id,
    'candidate_handle', p_candidate_handle,
    'job_id', p_job_id
  ));

  RETURN v_invitation_id;
END;
$$;
```

### B. Repaired `get_worker_candidate_invitations` RPC
```sql
CREATE OR REPLACE FUNCTION public.get_worker_candidate_invitations()
RETURNS TABLE (
  id uuid,
  job_id uuid,
  job_title text,
  employer_name text,
  message text,
  status text,
  created_at timestamptz,
  expires_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_worker_id uuid := public.current_worker_id();
BEGIN
  IF v_worker_id IS NULL THEN RETURN; END IF;

  RETURN QUERY
  SELECT
    i.id,
    i.job_id,
    coalesce(j.title, 'General Logistics Opportunity')::text AS job_title,
    e.legal_name::text AS employer_name,
    i.message,
    i.status,
    i.created_at,
    i.expires_at
  FROM public.candidate_invitations i
  JOIN public.employers e ON e.id = i.employer_id
  LEFT JOIN public.jobs j ON j.id = i.job_id
  WHERE i.worker_id = v_worker_id
  ORDER BY i.created_at DESC;
END;
$$;
```

### C. Unified Acceptance and Conversation Provisioning (`respond_to_candidate_invitation`)
When a candidate accepts an invitation, whether application-linked or direct, the RPC:
1. Transitions the invitation to `'accepted'`.
2. Resolves or automatically links the underlying `job_applications` record and marks it `'shortlisted'`.
3. Invokes `ensure_application_conversation()`, creating the canonical conversation and participants in `public.conversations` and `public.conversation_participants`.
4. Emits a real notification to employer team members.

---

## 3. UI/UX Enhancements

In `artifacts/fleetwala/src/pages/employer.tsx`:
1. **Candidate Discovery Multi-Region Filter**:
   - Expanded from Bengaluru-only dropdown to include **"All Regions & Areas"**, **"Delhi NCR (Dwarka / Okhla)"**, **"Bengaluru"**, **"Mumbai"**, etc.
   - Ensures real worker **Ankul** in Dwarka, Delhi NCR appears prominently when discoverability is enabled.
2. **Clear Navigation & Guidance**:
   - Added a direct banner and header action linking to `/employer/applicants`.
   - Explains the distinction: Discover candidates for prospective outreach, or review and invite applied workers in Applicants.
3. **Application "Invite to Discuss"**:
   - In `/employer/applicants`, employers can click "Invite" on any `applied` or `viewed` candidate to send an application-linked invitation.

---

## 4. Verification Evidence

1. **Database Proc Audit**:
   - Executed: `SELECT proname FROM pg_proc WHERE prosrc ILIKE '%trade_name%';`
   - Result: `0 rows returned`. Zero lingering references in PostgreSQL.
2. **Automated Unit & RLS Tests**:
   - Executed: `corepack pnpm --filter @workspace/fleetwala test`
   - Result: `88 passing, 0 failing`.
3. **E2E Playwright Verification**:
   - All 8 requested routes rendered cleanly with zero console exceptions.
