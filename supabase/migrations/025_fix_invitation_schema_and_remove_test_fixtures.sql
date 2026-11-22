-- Migration 025: Fix Invitation Schema (Resolve e.trade_name) and Remove Antigravity Test Fixtures
-- Target Project: jigbzsaaowtyaqhreplg (Supabase PostgreSQL)
-- Preserves Flipkart employer, Delhi NCR job, and Worker Ankul with 100% integrity

BEGIN;

-- ============================================================================
-- 1. PRE-CHECK: VERIFY GENUINE ENTITIES EXIST BEFORE ANY ACTION
-- ============================================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.employers 
    WHERE id = 'af42f70c-6b4f-48da-9cf4-d2707543602d' 
      AND legal_name = 'flipkart'
  ) THEN
    RAISE EXCEPTION 'PRE-CHECK FAILED: Genuine Flipkart employer record missing';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.jobs 
    WHERE id = '3595cdb6-1298-4100-be01-b0d148d38b6e' 
      AND employer_id = 'af42f70c-6b4f-48da-9cf4-d2707543602d'
  ) THEN
    RAISE EXCEPTION 'PRE-CHECK FAILED: Genuine Flipkart job record missing';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.workers 
    WHERE id = '761d0d18-99ed-42cd-b117-71a593be4747' 
      AND full_name = 'Ankul'
  ) THEN
    RAISE EXCEPTION 'PRE-CHECK FAILED: Genuine worker Ankul record missing';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.job_applications 
    WHERE id = '6ed9e756-16af-4c98-be68-d693c8592c76' 
      AND job_id = '3595cdb6-1298-4100-be01-b0d148d38b6e'
      AND worker_id = '761d0d18-99ed-42cd-b117-71a593be4747'
  ) THEN
    RAISE EXCEPTION 'PRE-CHECK FAILED: Genuine application record missing';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.conversations 
    WHERE id = 'e8fa2e36-faac-47e0-b786-2762a9934cc4'
  ) THEN
    RAISE EXCEPTION 'PRE-CHECK FAILED: Genuine conversation record missing';
  END IF;
END $$;

-- ============================================================================
-- 2. REPAIR CANDIDATE INVITATION RPCS (REMOVE e.trade_name REFERENCE)
-- ============================================================================

-- A. Create Candidate Invitation RPC
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

  -- 1. Verify caller is an active employer member using legal_name
  SELECT m.employer_id, e.legal_name INTO v_employer_id, v_employer_name
  FROM public.employer_memberships m
  JOIN public.employers e ON e.id = m.employer_id
  WHERE m.user_id = v_uid AND m.state = 'active'
  LIMIT 1;

  IF v_employer_id IS NULL THEN
    RAISE EXCEPTION 'Active employer membership required to invite candidates' USING errcode = '42501';
  END IF;

  -- 2. If job_id is provided, verify it belongs to this employer
  IF p_job_id IS NOT NULL THEN
    SELECT * INTO v_job FROM public.jobs WHERE id = p_job_id AND employer_id = v_employer_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Specified job listing does not belong to your organization';
    END IF;
  END IF;

  -- 3. Resolve worker by handle (supports SHA256 digest, raw UUID, or FW-cand format)
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

  -- 6. Insert notification for worker using valid notification schema (kind, payload)
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

  -- 7. Audit log
  INSERT INTO public.audit_log (actor_id, action, entity_type, entity_id, details)
  VALUES (v_uid, 'candidate_invite_sent', 'candidate_invitation', v_invitation_id::text, jsonb_build_object(
    'employer_id', v_employer_id,
    'candidate_handle', p_candidate_handle,
    'job_id', p_job_id
  ));

  RETURN v_invitation_id;
END;
$$;

REVOKE ALL ON FUNCTION public.create_candidate_invitation(text, uuid, text) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_candidate_invitation(text, uuid, text) TO authenticated;

-- B. Get Worker Candidate Invitations RPC (Fix e.trade_name -> e.legal_name)
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
  IF v_worker_id IS NULL THEN
    RETURN;
  END IF;

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

REVOKE ALL ON FUNCTION public.get_worker_candidate_invitations() FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_worker_candidate_invitations() TO authenticated;

-- C. Get Employer Candidate Invitations RPC (Ensure e.legal_name)
CREATE OR REPLACE FUNCTION public.get_employer_candidate_invitations(p_job_id uuid DEFAULT NULL)
RETURNS TABLE (
  id uuid,
  candidate_handle text,
  job_id uuid,
  job_title text,
  message text,
  status text,
  created_at timestamptz,
  responded_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_employer_id uuid;
BEGIN
  IF v_uid IS NULL THEN
    RETURN;
  END IF;

  SELECT employer_id INTO v_employer_id
  FROM public.employer_memberships
  WHERE user_id = v_uid AND state = 'active'
  LIMIT 1;

  IF v_employer_id IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    i.id,
    i.candidate_handle,
    i.job_id,
    coalesce(j.title, 'General Logistics Opportunity')::text AS job_title,
    i.message,
    i.status,
    i.created_at,
    i.responded_at
  FROM public.candidate_invitations i
  LEFT JOIN public.jobs j ON j.id = i.job_id
  WHERE i.employer_id = v_employer_id
    AND (p_job_id IS NULL OR i.job_id = p_job_id)
  ORDER BY i.created_at DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.get_employer_candidate_invitations(uuid) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_employer_candidate_invitations(uuid) TO authenticated;

-- D. Enhanced Respond to Candidate Invitation RPC
CREATE OR REPLACE FUNCTION public.respond_to_candidate_invitation(
  p_invitation_id uuid,
  p_accept boolean
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_worker_id uuid;
  v_inv public.candidate_invitations%rowtype;
  v_new_status text;
  v_employer_member uuid;
  v_conv_id uuid;
  v_job_title text;
  v_app_id uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING errcode = '42501';
  END IF;

  v_worker_id := public.current_worker_id();
  IF v_worker_id IS NULL THEN
    RAISE EXCEPTION 'Worker profile required' USING errcode = '42501';
  END IF;

  SELECT * INTO v_inv
  FROM public.candidate_invitations
  WHERE id = p_invitation_id AND worker_id = v_worker_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invitation not found or not addressed to you';
  END IF;

  IF v_inv.status != 'pending' THEN
    RAISE EXCEPTION 'Invitation is already %', v_inv.status;
  END IF;

  v_new_status := CASE WHEN p_accept THEN 'accepted' ELSE 'declined' END;

  UPDATE public.candidate_invitations
  SET status = v_new_status, responded_at = now()
  WHERE id = p_invitation_id;

  SELECT title INTO v_job_title FROM public.jobs WHERE id = v_inv.job_id;

  -- If accepted, ensure application is shortlisted and canonical conversation is created
  IF p_accept THEN
    IF v_inv.application_id IS NOT NULL THEN
      UPDATE public.job_applications
      SET status = 'shortlisted', updated_at = now()
      WHERE id = v_inv.application_id AND status IN ('applied', 'reviewing');

      INSERT INTO public.application_status_history (application_id, old_status, new_status, changed_by)
      VALUES (v_inv.application_id, 'applied', 'shortlisted', v_uid);

      v_conv_id := public.ensure_application_conversation(v_inv.application_id);
    ELSIF v_inv.job_id IS NOT NULL THEN
      -- Create or link application for standalone candidate invite
      SELECT id INTO v_app_id FROM public.job_applications
      WHERE job_id = v_inv.job_id AND worker_id = v_inv.worker_id
      LIMIT 1;

      IF v_app_id IS NULL THEN
        INSERT INTO public.job_applications (job_id, worker_id, status)
        VALUES (v_inv.job_id, v_inv.worker_id, 'shortlisted')
        RETURNING id INTO v_app_id;

        INSERT INTO public.application_status_history (application_id, old_status, new_status, changed_by)
        VALUES (v_app_id, 'applied', 'shortlisted', v_uid);
      ELSE
        UPDATE public.job_applications
        SET status = 'shortlisted', updated_at = now()
        WHERE id = v_app_id AND status IN ('applied', 'reviewing');
      END IF;

      UPDATE public.candidate_invitations
      SET application_id = v_app_id
      WHERE id = p_invitation_id;

      v_conv_id := public.ensure_application_conversation(v_app_id);
    END IF;
  END IF;

  -- Notify employer team members using valid schema (user_id, kind, payload)
  FOR v_employer_member IN
    SELECT user_id FROM public.employer_memberships
    WHERE employer_id = v_inv.employer_id AND state = 'active'
  LOOP
    INSERT INTO public.notifications (user_id, kind, payload)
    VALUES (
      v_employer_member,
      CASE WHEN p_accept THEN 'invitation_accepted' ELSE 'invitation_declined' END,
      jsonb_build_object(
        'invitation_id', p_invitation_id,
        'application_id', coalesce(v_inv.application_id, v_app_id),
        'job_id', v_inv.job_id,
        'job_title', coalesce(v_job_title, 'Opening'),
        'status', v_new_status
      )
    );
  END LOOP;

  INSERT INTO public.audit_log (actor_id, action, entity_type, entity_id, details)
  VALUES (
    v_uid,
    'candidate_invitation_responded',
    'candidate_invitation',
    p_invitation_id::text,
    jsonb_build_object('response', v_new_status, 'application_id', coalesce(v_inv.application_id, v_app_id))
  );
END;
$$;

REVOKE ALL ON FUNCTION public.respond_to_candidate_invitation(uuid, boolean) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.respond_to_candidate_invitation(uuid, boolean) TO authenticated;

-- ============================================================================
-- 3. CLEAN UP ANTIGRAVITY STAGING TEST FIXTURES
-- ============================================================================

-- Staging IDs to purge:
-- Test Employers:
--   '6e7c9a06-b7ba-4a76-bb3c-25e9b410639f' (Ghar-Tak Parcels Staging Pvt Ltd)
--   '480c9331-a3fc-4a8b-b636-f91472965708' (Bengaluru Fast-Fleet Logistics)
-- Test Jobs:
--   'ad8adc97-e06f-45e7-a5b5-fdb7b517f4d1' (Express Parcel Delivery Partner)
--   '41552fab-d004-4c2e-84e9-10197df8afea' (Hub Sorter - Whitefield Warehouse)
--   '179be734-84bd-434e-9569-b96a5906cf52' (hiring in flipkart under Ghar-Tak)
--   '6157b3c8-018c-4187-ba4c-cb6ec40d91a2' (Express Delivery Partner - Electronic City)
-- Test Applications:
--   '1e25c9a6-2bf9-4b28-9be9-c12243d95111'
--   '9bb44841-0d97-4dda-a86b-fc2b259e2048'
--   'ea4fbf95-faa7-456d-b949-79d6b19a06f5'
--   '2083c668-47cd-4073-ae6d-0237ce4e1290'
-- Test Conversations:
--   'ef7261e2-379a-4f18-9372-7398a19247ae'
--   '153d2a7a-57d9-40a2-a1e7-1446697cf575'
-- Synthetic Worker:
--   '800d0fd8-ff46-4482-927f-8ccb03b14ac0' (Ramesh Kumar, user 33333333-3333-3333-3333-333333333333)

-- Step 3.1: Clean test messages
DELETE FROM public.messages
WHERE conversation_id IN (
  'ef7261e2-379a-4f18-9372-7398a19247ae',
  '153d2a7a-57d9-40a2-a1e7-1446697cf575'
)
AND conversation_id NOT IN ('e8fa2e36-faac-47e0-b786-2762a9934cc4');

-- Step 3.2: Clean test conversation participants
DELETE FROM public.conversation_participants
WHERE conversation_id IN (
  'ef7261e2-379a-4f18-9372-7398a19247ae',
  '153d2a7a-57d9-40a2-a1e7-1446697cf575'
)
AND conversation_id NOT IN ('e8fa2e36-faac-47e0-b786-2762a9934cc4');

-- Step 3.3: Clean test conversations
DELETE FROM public.conversations
WHERE id IN (
  'ef7261e2-379a-4f18-9372-7398a19247ae',
  '153d2a7a-57d9-40a2-a1e7-1446697cf575'
)
AND id NOT IN ('e8fa2e36-faac-47e0-b786-2762a9934cc4');

-- Step 3.4: Clean test invitations referencing test employers or test jobs
DELETE FROM public.candidate_invitations
WHERE employer_id IN (
  '6e7c9a06-b7ba-4a76-bb3c-25e9b410639f',
  '480c9331-a3fc-4a8b-b636-f91472965708'
)
OR job_id IN (
  'ad8adc97-e06f-45e7-a5b5-fdb7b517f4d1',
  '41552fab-d004-4c2e-84e9-10197df8afea',
  '179be734-84bd-434e-9569-b96a5906cf52',
  '6157b3c8-018c-4187-ba4c-cb6ec40d91a2'
)
OR worker_id = '800d0fd8-ff46-4482-927f-8ccb03b14ac0';

-- Step 3.5: Clean application status history for test applications
DELETE FROM public.application_status_history
WHERE application_id IN (
  '1e25c9a6-2bf9-4b28-9be9-c12243d95111',
  '9bb44841-0d97-4dda-a86b-fc2b259e2048',
  'ea4fbf95-faa7-456d-b949-79d6b19a06f5',
  '2083c668-47cd-4073-ae6d-0237ce4e1290'
)
AND application_id NOT IN ('6ed9e756-16af-4c98-be68-d693c8592c76');

-- Step 3.6: Clean test job applications
DELETE FROM public.job_applications
WHERE id IN (
  '1e25c9a6-2bf9-4b28-9be9-c12243d95111',
  '9bb44841-0d97-4dda-a86b-fc2b259e2048',
  'ea4fbf95-faa7-456d-b949-79d6b19a06f5',
  '2083c668-47cd-4073-ae6d-0237ce4e1290'
)
AND id NOT IN ('6ed9e756-16af-4c98-be68-d693c8592c76');

-- Step 3.7: Clean job status history for test jobs
DELETE FROM public.job_status_history
WHERE job_id IN (
  'ad8adc97-e06f-45e7-a5b5-fdb7b517f4d1',
  '41552fab-d004-4c2e-84e9-10197df8afea',
  '179be734-84bd-434e-9569-b96a5906cf52',
  '6157b3c8-018c-4187-ba4c-cb6ec40d91a2'
)
AND job_id NOT IN ('3595cdb6-1298-4100-be01-b0d148d38b6e');

-- Step 3.8: Clean saved jobs, user reports, entitlements for test jobs
DELETE FROM public.saved_jobs
WHERE job_id IN (
  'ad8adc97-e06f-45e7-a5b5-fdb7b517f4d1',
  '41552fab-d004-4c2e-84e9-10197df8afea',
  '179be734-84bd-434e-9569-b96a5906cf52',
  '6157b3c8-018c-4187-ba4c-cb6ec40d91a2'
)
OR worker_id = '800d0fd8-ff46-4482-927f-8ccb03b14ac0';

DELETE FROM public.user_reports
WHERE job_id IN (
  'ad8adc97-e06f-45e7-a5b5-fdb7b517f4d1',
  '41552fab-d004-4c2e-84e9-10197df8afea',
  '179be734-84bd-434e-9569-b96a5906cf52',
  '6157b3c8-018c-4187-ba4c-cb6ec40d91a2'
);

DELETE FROM public.job_entitlements
WHERE job_id IN (
  'ad8adc97-e06f-45e7-a5b5-fdb7b517f4d1',
  '41552fab-d004-4c2e-84e9-10197df8afea',
  '179be734-84bd-434e-9569-b96a5906cf52',
  '6157b3c8-018c-4187-ba4c-cb6ec40d91a2'
)
OR employer_id IN (
  '6e7c9a06-b7ba-4a76-bb3c-25e9b410639f',
  '480c9331-a3fc-4a8b-b636-f91472965708'
);

-- Step 3.9: Delete test jobs
DELETE FROM public.jobs
WHERE id IN (
  'ad8adc97-e06f-45e7-a5b5-fdb7b517f4d1',
  '41552fab-d004-4c2e-84e9-10197df8afea',
  '179be734-84bd-434e-9569-b96a5906cf52',
  '6157b3c8-018c-4187-ba4c-cb6ec40d91a2'
)
AND id NOT IN ('3595cdb6-1298-4100-be01-b0d148d38b6e');

-- Step 3.10: Clean verification reviews & memberships for test employers
DELETE FROM public.employer_verification_reviews
WHERE employer_id IN (
  '6e7c9a06-b7ba-4a76-bb3c-25e9b410639f',
  '480c9331-a3fc-4a8b-b636-f91472965708'
)
AND employer_id NOT IN ('af42f70c-6b4f-48da-9cf4-d2707543602d');

DELETE FROM public.employer_memberships
WHERE employer_id IN (
  '6e7c9a06-b7ba-4a76-bb3c-25e9b410639f',
  '480c9331-a3fc-4a8b-b636-f91472965708'
)
AND employer_id NOT IN ('af42f70c-6b4f-48da-9cf4-d2707543602d');

DELETE FROM public.contact_unlocks
WHERE employer_id IN (
  '6e7c9a06-b7ba-4a76-bb3c-25e9b410639f',
  '480c9331-a3fc-4a8b-b636-f91472965708'
)
OR worker_id = '800d0fd8-ff46-4482-927f-8ccb03b14ac0';

DELETE FROM public.support_tickets
WHERE employer_id IN (
  '6e7c9a06-b7ba-4a76-bb3c-25e9b410639f',
  '480c9331-a3fc-4a8b-b636-f91472965708'
);

-- Step 3.11: Delete test employers
DELETE FROM public.employers
WHERE id IN (
  '6e7c9a06-b7ba-4a76-bb3c-25e9b410639f',
  '480c9331-a3fc-4a8b-b636-f91472965708'
)
AND id NOT IN ('af42f70c-6b4f-48da-9cf4-d2707543602d');

-- Step 3.12: Clean synthetic worker records
DELETE FROM public.worker_preferences WHERE worker_id = '800d0fd8-ff46-4482-927f-8ccb03b14ac0';
DELETE FROM public.worker_skills WHERE worker_id = '800d0fd8-ff46-4482-927f-8ccb03b14ac0';
DELETE FROM public.worker_documents WHERE worker_id = '800d0fd8-ff46-4482-927f-8ccb03b14ac0';

DELETE FROM public.workers
WHERE id = '800d0fd8-ff46-4482-927f-8ccb03b14ac0'
AND id NOT IN ('761d0d18-99ed-42cd-b117-71a593be4747', '8b91c8eb-27e2-48a1-87cf-8560777fca91');

-- Step 3.13: Clean synthetic user_accounts
DELETE FROM public.user_accounts
WHERE user_id IN (
  '33333333-3333-3333-3333-333333333333',
  '22222222-2222-2222-2222-222222222222',
  '44444444-4444-4444-4444-444444444444'
)
AND user_id NOT IN (
  '2480d144-2f7d-44dd-81d3-567d7d6d47d4',
  '6fe9dfd1-66ee-41c0-9722-b95f828aad0f',
  '5733aa5f-ee59-4ed1-bc9d-9b6deb6b07b3'
);

-- ============================================================================
-- 4. POST-CHECK: STRICT PRESERVATION AND INTEGRITY ASSERTIONS
-- ============================================================================
DO $$
DECLARE
  v_emp_count integer;
  v_job_count integer;
  v_worker_count integer;
  v_app_count integer;
  v_conv_count integer;
  v_msg_count integer;
BEGIN
  -- 1. Flipkart employer must exist and be verified
  IF NOT EXISTS (
    SELECT 1 FROM public.employers 
    WHERE id = 'af42f70c-6b4f-48da-9cf4-d2707543602d' 
      AND legal_name = 'flipkart'
      AND verification_state = 'verified'
  ) THEN
    RAISE EXCEPTION 'POST-CHECK FAILED: Genuine Flipkart employer corrupted or deleted';
  END IF;

  -- 2. Genuine job must exist and be published
  IF NOT EXISTS (
    SELECT 1 FROM public.jobs 
    WHERE id = '3595cdb6-1298-4100-be01-b0d148d38b6e' 
      AND employer_id = 'af42f70c-6b4f-48da-9cf4-d2707543602d'
      AND state = 'published'
  ) THEN
    RAISE EXCEPTION 'POST-CHECK FAILED: Genuine Flipkart job corrupted or deleted';
  END IF;

  -- 3. Real worker Ankul must exist, active and discoverable
  IF NOT EXISTS (
    SELECT 1 FROM public.workers 
    WHERE id = '761d0d18-99ed-42cd-b117-71a593be4747' 
      AND full_name = 'Ankul'
      AND discoverable = true
      AND account_state = 'active'
  ) THEN
    RAISE EXCEPTION 'POST-CHECK FAILED: Genuine worker Ankul corrupted or deleted';
  END IF;

  -- 4. Real application must exist and be hired
  IF NOT EXISTS (
    SELECT 1 FROM public.job_applications 
    WHERE id = '6ed9e756-16af-4c98-be68-d693c8592c76' 
      AND job_id = '3595cdb6-1298-4100-be01-b0d148d38b6e'
      AND worker_id = '761d0d18-99ed-42cd-b117-71a593be4747'
      AND status = 'hired'
  ) THEN
    RAISE EXCEPTION 'POST-CHECK FAILED: Genuine application corrupted or deleted';
  END IF;

  -- 5. Real conversation and messages must exist
  IF NOT EXISTS (
    SELECT 1 FROM public.conversations 
    WHERE id = 'e8fa2e36-faac-47e0-b786-2762a9934cc4'
      AND application_id = '6ed9e756-16af-4c98-be68-d693c8592c76'
  ) THEN
    RAISE EXCEPTION 'POST-CHECK FAILED: Genuine conversation corrupted or deleted';
  END IF;

  SELECT count(*) INTO v_msg_count 
  FROM public.messages 
  WHERE conversation_id = 'e8fa2e36-faac-47e0-b786-2762a9934cc4';

  IF v_msg_count < 2 THEN
    RAISE EXCEPTION 'POST-CHECK FAILED: Messages under genuine conversation were lost (found %)', v_msg_count;
  END IF;

  -- 6. Verify that test employers and jobs are completely gone
  SELECT count(*) INTO v_emp_count 
  FROM public.employers 
  WHERE id IN ('6e7c9a06-b7ba-4a76-bb3c-25e9b410639f', '480c9331-a3fc-4a8b-b636-f91472965708');

  IF v_emp_count > 0 THEN
    RAISE EXCEPTION 'POST-CHECK FAILED: Test employers still remain (% rows)', v_emp_count;
  END IF;

  SELECT count(*) INTO v_job_count 
  FROM public.jobs 
  WHERE id IN (
    'ad8adc97-e06f-45e7-a5b5-fdb7b517f4d1',
    '41552fab-d004-4c2e-84e9-10197df8afea',
    '179be734-84bd-434e-9569-b96a5906cf52',
    '6157b3c8-018c-4187-ba4c-cb6ec40d91a2'
  );

  IF v_job_count > 0 THEN
    RAISE EXCEPTION 'POST-CHECK FAILED: Test jobs still remain (% rows)', v_job_count;
  END IF;

  SELECT count(*) INTO v_worker_count 
  FROM public.workers 
  WHERE id = '800d0fd8-ff46-4482-927f-8ccb03b14ac0';

  IF v_worker_count > 0 THEN
    RAISE EXCEPTION 'POST-CHECK FAILED: Synthetic worker Ramesh still remains';
  END IF;
END $$;

COMMIT;
