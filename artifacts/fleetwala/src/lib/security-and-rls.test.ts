import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';
import {
  DAILY_LIMIT,
  PRD_PRICING,
  anonymizedCandidateProjection,
  canApplyToday,
  defaultProfile,
  hasProhibitedFee,
  isAllowedRegistrationRole,
  isLiveJob,
  isValidAppStatusTransition,
  istDay,
} from './rules';
import { toDbExperience, fromDbExperience, toDbVehicle, fromDbVehicle } from './repo';

// Connect using staging credentials if present in environment
const url = process.env.VITE_SUPABASE_URL || 'https://jigbzsaaowtyaqhreplg.supabase.co';
const key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_DMZUfsE7ZVRronZL7fDyew_F3TdP2RB';

const anonClient = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});

test('RLS Negative: Unauthenticated SELECT on public.jobs is blocked or restricted', async () => {
  const { data, error } = await anonClient.from('jobs').select('*');
  // Under RLS, anon role without active verified employer or published state either returns 0 rows or permission denied
  if (error) {
    assert.equal(error.code, '42501', 'Must fail with 42501 permission denied if revoked');
  } else {
    // If empty result returned due to RLS filter
    assert.equal(Array.isArray(data), true);
    assert.equal(data.length, 0, 'Anon role must never see draft or unverified employer jobs');
  }
});

test('RLS Negative: Unauthenticated EXECUTE on public.is_admin is denied', async () => {
  const { data, error } = await anonClient.rpc('is_admin');
  assert.notEqual(error, null, 'Unauthenticated user must be denied execution of is_admin RPC');
  assert.equal(error?.code, '42501', 'Must return 42501 permission denied');
});

test('RLS Negative: Unauthenticated EXECUTE on apply_to_job is denied', async () => {
  const dummyJobId = '00000000-0000-0000-0000-000000000001';
  const { data, error } = await anonClient.rpc('apply_to_job', { p_job_id: dummyJobId });
  assert.notEqual(error, null, 'Unauthenticated user must not be able to execute apply_to_job');
  // Either 42501 permission denied or Authentication required exception
  assert.equal(
    error?.code === '42501' || error?.message?.includes('Authentication required'),
    true,
    'Must enforce authentication'
  );
});

test('RLS Negative: Unauthenticated EXECUTE on submit_job is denied', async () => {
  const dummyJobId = '00000000-0000-0000-0000-000000000001';
  const { data, error } = await anonClient.rpc('submit_job', { p_job_id: dummyJobId });
  assert.notEqual(error, null, 'Unauthenticated user cannot execute submit_job');
  assert.equal(
    error?.code === '42501' || error?.message?.includes('Not authorized') || error?.message?.includes('Authentication'),
    true
  );
});

test('RLS Negative: Unauthenticated EXECUTE on review_job is denied', async () => {
  const dummyJobId = '00000000-0000-0000-0000-000000000001';
  const { data, error } = await anonClient.rpc('review_job', {
    p_job_id: dummyJobId,
    p_approve: true,
    p_reason: 'Testing',
  });
  assert.notEqual(error, null, 'Unauthenticated user cannot execute review_job');
  assert.equal(
    error?.code === '42501' || error?.message?.includes('Administrator access required'),
    true
  );
});

test('RLS Negative: Direct anonymous INSERT into public.employers is blocked', async () => {
  const { data, error } = await anonClient.from('employers').insert({
    legal_name: 'Malicious Corp',
    employer_type: 'company',
  });
  assert.notEqual(error, null, 'Direct insert into employers by anon role must be strictly rejected');
});

test('RLS Negative: Direct anonymous INSERT into public.workers is blocked', async () => {
  const { data, error } = await anonClient.from('workers').insert({
    full_name: 'Fake Worker',
    city: 'Bengaluru',
  });
  assert.notEqual(error, null, 'Direct insert into workers by anon role must be strictly rejected');
});

test('RLS Negative: Direct anonymous EXECUTE on save_worker_profile is denied', async () => {
  const { data, error } = await anonClient.rpc('save_worker_profile', {
    p_full_name: 'Fake Worker',
    p_city: 'Bengaluru',
    p_address_line: 'Area',
    p_experience_band: 'fresher',
    p_vehicle_type: 'none',
  });
  assert.notEqual(error, null, 'Unauthenticated user cannot execute save_worker_profile');
});

test('RLS Negative: Direct anonymous UPDATE on public.workers is blocked', async () => {
  const { data, error } = await anonClient.from('workers').update({ full_name: 'Hacked' }).eq('city', 'Bengaluru');
  assert.notEqual(error, null, 'Direct update on workers by anon role must be strictly rejected');
});

test('Security: Admin role cannot be assumed or assigned via client-side registration', () => {
  assert.equal(isAllowedRegistrationRole('admin'), false);
  assert.equal(isAllowedRegistrationRole('administrator'), false);
  assert.equal(isAllowedRegistrationRole('root'), false);
  assert.equal(isAllowedRegistrationRole('worker'), true);
  assert.equal(isAllowedRegistrationRole('employer'), true);
});

test('Privacy: Candidate discovery projection strictly strips sensitive PII', () => {
  const rawCandidate = {
    first_name: 'Sunil',
    city: 'Bengaluru',
    area: 'Yeshwanthpur',
    experience: '1-3 years',
    vehicle: 'Motorcycle',
    phone: '+919876543210',
    email: 'sunil@gmail.com',
    address: 'Flat 101, Secret Lane, Yeshwanthpur',
    aadhaar_number: '1234-5678-9012',
    driving_licence_doc: 'worker-private-documents/uuid/licence.pdf',
    discoverable: true,
    available: true,
  };

  const safeView = anonymizedCandidateProjection(rawCandidate);

  // Allowed public attributes
  assert.equal(safeView.first_name, 'Sunil');
  assert.equal(safeView.city, 'Bengaluru');
  assert.equal(safeView.area, 'Yeshwanthpur');
  assert.equal(safeView.experience, '1-3 years');
  assert.equal(safeView.vehicle, 'Motorcycle');

  // Strictly prohibited PII attributes
  assert.equal('phone' in safeView, false);
  assert.equal('email' in safeView, false);
  assert.equal('address' in safeView, false);
  assert.equal('aadhaar_number' in safeView, false);
  assert.equal('driving_licence_doc' in safeView, false);
});

test('Privacy: Default worker profile discoverability is false', () => {
  const p = defaultProfile();
  assert.equal(p.discoverable, false, 'Candidate discoverability MUST default to false');
});

test('Business Logic: 20 applications per worker per IST calendar day limit', () => {
  assert.equal(DAILY_LIMIT, 20);
  for (let count = 0; count < 20; count++) {
    assert.equal(canApplyToday(count), true, `Application #${count + 1} must be permitted`);
  }
  assert.equal(canApplyToday(20), false, 'Application #21 must be refused');
  assert.equal(canApplyToday(25), false, 'Application #26 must be refused');
});

test('Business Logic: IST day transitions at 18:30:00 UTC (Midnight IST)', () => {
  // 18:29:59 UTC = 23:59:59 IST
  assert.equal(istDay('2026-11-22T18:29:59Z'), '2026-11-22');
  // 18:30:01 UTC = 00:00:01 IST next day
  assert.equal(istDay('2026-11-22T18:30:01Z'), '2026-11-23');
});

test('Repository: Two-way Experience band mapping handles all check constraint values', () => {
  assert.equal(toDbExperience('Fresher'), 'fresher');
  assert.equal(toDbExperience('0–1 year'), 'fresher');
  assert.equal(toDbExperience('1–3 years'), '1-3');
  assert.equal(toDbExperience('3+ years'), '3-5');

  assert.equal(fromDbExperience('fresher'), 'Fresher');
  assert.equal(fromDbExperience('1-3'), '1–3 years');
  assert.equal(fromDbExperience('3-5'), '3+ years');
  assert.equal(fromDbExperience('5+'), '3+ years');
  assert.equal(fromDbExperience(null), 'Fresher');
});

test('Repository: Two-way Vehicle type mapping handles all check constraint values', () => {
  assert.equal(toDbVehicle('Two-wheeler'), 'motorcycle');
  assert.equal(toDbVehicle('Bicycle'), 'bicycle');
  assert.equal(toDbVehicle('E-bike'), 'ev');
  assert.equal(toDbVehicle('None needed'), 'none');

  assert.equal(fromDbVehicle('motorcycle'), 'Two-wheeler');
  assert.equal(fromDbVehicle('scooter'), 'Two-wheeler');
  assert.equal(fromDbVehicle('ev'), 'E-bike');
  assert.equal(fromDbVehicle('bicycle'), 'Bicycle');
  assert.equal(fromDbVehicle('none'), 'None needed');
  assert.equal(fromDbVehicle(null), 'Two-wheeler');
});

test('Pricing Integrity: Official PRD baseline pricing configuration', () => {
  assert.equal(PRD_PRICING.JOB_POSTING_INR, 99);
  assert.equal(PRD_PRICING.CANDIDATE_UNLOCK_INR, 10);
});
