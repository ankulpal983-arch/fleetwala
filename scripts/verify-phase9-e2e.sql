-- scripts/verify-phase9-e2e.sql
-- Real end-to-end database tests for Employer Profile, Membership, Job Draft Creation, Submission, and Security

do $$
declare
  v_owner_uid uuid := '5733aa5f-ee59-4ed1-bc9d-9b6deb6b07b3';
  v_staging_org_id uuid := '6e7c9a06-b7ba-4a76-bb3c-25e9b410639f';
  v_org record;
  v_owner_job_id uuid;
  v_new_emp_uid uuid := '44444444-4444-4444-4444-444444444444';
  v_new_org_id uuid;
  v_new_org_job_id uuid;
  v_worker_uid uuid := '33333333-3333-3333-3333-333333333333';
  v_job_state text;
  v_error_caught boolean;
begin
  raise notice '=== PREPARATION: PROVISIONING TEST IDENTITIES AS POSTGRES ===';

  -- Provision new test user in auth.users and public.user_accounts as postgres
  insert into auth.users (id, email, raw_user_meta_data)
  values (v_new_emp_uid, 'new-employer-staging@fleetwala.test', '{"full_name":"Staging Employer Lead 2"}'::jsonb)
  on conflict (id) do nothing;

  insert into public.user_accounts (user_id, account_state)
  values (v_new_emp_uid, 'active')
  on conflict (user_id) do update set account_state = 'active';

  raise notice '=== TEST 1: EXISTING EMPLOYER RESOLUTION & JOB LIFECYCLE ===';
  
  -- Set auth context to owner under role authenticated
  perform set_config('request.jwt.claim.sub', v_owner_uid::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  set local role authenticated;

  -- 1. Resolve organization
  select * into v_org from public.get_current_employer_org();
  if v_org.id is null or v_org.id <> v_staging_org_id then
    raise exception 'TEST 1 FAILED: Could not resolve staging organization for owner';
  end if;
  if v_org.role <> 'owner' then
    raise exception 'TEST 1 FAILED: Owner role is not owner, got %', v_org.role;
  end if;
  raise notice 'Pass: Owner resolved organization % (%) with role %', v_org.legal_name, v_org.id, v_org.role;

  -- 2. Create real draft job
  insert into public.jobs (
    employer_id, created_by, title, category, description, city, area,
    salary_min_inr, salary_max_inr, requires_driving_licence, state, expires_at
  ) values (
    v_staging_org_id, v_owner_uid, 'Express Delivery Partner - Electronic City',
    'Delivery', 'Responsible for express last-mile parcel distribution across Electronic City Phase 1 and 2.',
    'Bengaluru', 'Electronic City', 18000, 25000, true, 'draft', now() + interval '21 days'
  ) returning id into v_owner_job_id;

  raise notice 'Pass: Created real job draft % for employer %', v_owner_job_id, v_staging_org_id;

  -- 3. Confirm draft exists in PostgreSQL
  select state into v_job_state from public.jobs where id = v_owner_job_id;
  if v_job_state <> 'draft' then
    raise exception 'TEST 1 FAILED: Job draft state is %, expected draft', v_job_state;
  end if;
  raise notice 'Pass: Job draft state confirmed in PostgreSQL as %', v_job_state;

  -- 4. Submit the draft via submit_job RPC
  perform public.submit_job(v_owner_job_id);

  select state into v_job_state from public.jobs where id = v_owner_job_id;
  if v_job_state <> 'pending_review' then
    raise exception 'TEST 1 FAILED: Expected pending_review after submission, got %', v_job_state;
  end if;
  raise notice 'Pass: Job draft successfully transitioned to %', v_job_state;

  -- 5. Confirm status history was recorded
  if not exists (select 1 from public.job_status_history where job_id = v_owner_job_id and old_state = 'draft' and new_state = 'pending_review') then
    raise exception 'TEST 1 FAILED: Status history missing for submission';
  end if;
  raise notice 'Pass: Status history correctly recorded transition';


  raise notice '=== TEST 2: CONTROLLED NEW EMPLOYER ONBOARDING & IDEMPOTENCY ===';

  -- Set auth context to new employer
  perform set_config('request.jwt.claim.sub', v_new_emp_uid::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);

  -- Call register_employer
  v_new_org_id := public.register_employer('Bengaluru Fast-Fleet Logistics', 'vendor_dsp');
  raise notice 'Pass: Registered new employer organization %', v_new_org_id;

  -- Test idempotency: Calling register_employer again returns identical ID without creating duplicate
  if public.register_employer('Bengaluru Fast-Fleet Logistics', 'vendor_dsp') <> v_new_org_id then
    raise exception 'TEST 2 FAILED: register_employer is not idempotent';
  end if;
  raise notice 'Pass: register_employer is verified idempotent (no duplicates)';

  -- Verify membership created
  if not exists (select 1 from public.employer_memberships where employer_id = v_new_org_id and user_id = v_new_emp_uid and role = 'owner' and state = 'active') then
    raise exception 'TEST 2 FAILED: Owner membership missing for new employer';
  end if;
  raise notice 'Pass: Owner membership created and active for new employer';

  -- Create job draft for new employer
  insert into public.jobs (
    employer_id, created_by, title, category, description, city, area,
    salary_min_inr, salary_max_inr, requires_driving_licence, state, expires_at
  ) values (
    v_new_org_id, v_new_emp_uid, 'Hub Sorter - Whitefield Warehouse',
    'Warehouse', 'Sorting inbound parcels and staging packages for morning hub dispatch.',
    'Bengaluru', 'Whitefield', 16000, 22000, false, 'draft', now() + interval '30 days'
  ) returning id into v_new_org_job_id;
  raise notice 'Pass: New employer created draft job %', v_new_org_job_id;


  raise notice '=== TEST 3: MULTI-TENANT & RLS SECURITY NEGATIVE CHECKS ===';

  -- 3A. Cross-Org: Employer B tries to insert a job for Employer A (staging org)
  v_error_caught := false;
  begin
    insert into public.jobs (
      employer_id, created_by, title, category, description, city, state
    ) values (
      v_staging_org_id, v_new_emp_uid, 'Malicious Cross-Org Injection',
      'Delivery', 'Attempting unauthorized job creation for another company.', 'Bengaluru', 'draft'
    );
  exception when others then
    v_error_caught := true;
  end;
  if not v_error_caught then
    raise exception 'SECURITY FAILURE: Employer B was able to insert a job for Employer A!';
  end if;
  raise notice 'Pass: Cross-organization job insertion correctly blocked by RLS';

  -- 3B. Cross-Org: Employer B tries to submit Employer A job
  v_error_caught := false;
  begin
    perform public.submit_job(v_owner_job_id);
  exception when others then
    v_error_caught := true;
  end;
  if not v_error_caught then
    raise exception 'SECURITY FAILURE: Employer B was able to submit Employer A job!';
  end if;
  raise notice 'Pass: Cross-organization job submission correctly blocked by RPC';

  -- 3C. Self-Approve: Employer tries to directly publish job draft
  v_error_caught := false;
  begin
    update public.jobs set state = 'published' where id = v_new_org_job_id;
  exception when others then
    v_error_caught := true;
  end;
  -- Even if update doesn't throw, RLS update policy restricts check (state = 'draft')
  select state into v_job_state from public.jobs where id = v_new_org_job_id;
  if v_job_state = 'published' then
    raise exception 'SECURITY FAILURE: Employer was able to self-approve and publish a job!';
  end if;
  raise notice 'Pass: Direct self-approval / publishing by employer strictly denied by RLS';

  -- 3D. Worker tries to create an employer job
  perform set_config('request.jwt.claim.sub', v_worker_uid::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  v_error_caught := false;
  begin
    insert into public.jobs (
      employer_id, created_by, title, category, description, city, state
    ) values (
      v_staging_org_id, v_worker_uid, 'Worker Unauthorized Job',
      'Delivery', 'Worker attempting to create employer job listing.', 'Bengaluru', 'draft'
    );
  exception when others then
    v_error_caught := true;
  end;
  if not v_error_caught then
    raise exception 'SECURITY FAILURE: Worker was able to insert an employer job!';
  end if;
  raise notice 'Pass: Worker user blocked from creating employer jobs';

  raise notice '=== ALL PHASE 9 REAL E2E DATABASE TESTS PASSED WITH ZERO FAILURES ===';
end $$;
