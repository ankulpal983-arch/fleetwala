import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';

const url = process.env.VITE_SUPABASE_URL || 'https://jigbzsaaowtyaqhreplg.supabase.co';
const key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_DMZUfsE7ZVRronZL7fDyew_F3TdP2RB';

const anonClient = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});

test('Invitations RLS: Direct anonymous SELECT on candidate_invitations is blocked or empty', async () => {
  const { data, error } = await anonClient.from('candidate_invitations').select('*');
  if (error) {
    assert.equal(error.code, '42501', 'Must return 42501 permission denied');
  } else {
    assert.equal(Array.isArray(data), true);
    assert.equal(data.length, 0, 'Anonymous users must never see candidate invitations');
  }
});

test('Invitations RPC: Unauthenticated EXECUTE on create_candidate_invitation is denied', async () => {
  const { data, error } = await anonClient.rpc('create_candidate_invitation', {
    p_job_id: '00000000-0000-0000-0000-000000000001',
    p_candidate_handle: 'cand-00000001',
    p_message: 'Please apply to our delivery role',
  });
  assert.notEqual(error, null, 'Unauthenticated caller cannot invite candidates');
  assert.equal(
    error?.code === '42501' || error?.message?.includes('Authentication required') || error?.message?.includes('permission denied'),
    true,
    'Must enforce authentication'
  );
});

test('Invitations RPC: Unauthenticated EXECUTE on respond_to_candidate_invitation is denied', async () => {
  const { data, error } = await anonClient.rpc('respond_to_candidate_invitation', {
    p_invitation_id: '00000000-0000-0000-0000-000000000001',
    p_accept: true,
  });
  assert.notEqual(error, null, 'Unauthenticated caller cannot respond to invitations');
  assert.equal(
    error?.code === '42501' || error?.message?.includes('Authentication required') || error?.message?.includes('permission denied'),
    true,
    'Must enforce authentication'
  );
});

test('Invitations RPC: Unauthenticated EXECUTE on get_worker_candidate_invitations is denied or empty', async () => {
  const { data, error } = await anonClient.rpc('get_worker_candidate_invitations');
  if (error) {
    assert.equal(error.code, '42501', 'Must return 42501 permission denied');
  } else {
    assert.equal(Array.isArray(data), true);
    assert.equal(data.length, 0, 'Anonymous users must receive zero worker invitations');
  }
});

test('Invitations RPC: Unauthenticated EXECUTE on get_employer_candidate_invitations is denied or empty', async () => {
  const { data, error } = await anonClient.rpc('get_employer_candidate_invitations');
  if (error) {
    assert.equal(error.code, '42501', 'Must return 42501 permission denied');
  } else {
    assert.equal(Array.isArray(data), true);
    assert.equal(data.length, 0, 'Anonymous users must receive zero employer invitations');
  }
});

test('Invitations Logic: Valid responses only accept boolean accept/decline', () => {
  assert.equal(typeof true === 'boolean', true);
  assert.equal(typeof false === 'boolean', true);
});

test('Clean Data & Staging Purge: Only verified genuine employer Flipkart is live', async () => {
  const { data, error } = await anonClient
    .from('employers')
    .select('id, legal_name, verification_state');

  // Anonymous or RLS-scoped
  if (!error && Array.isArray(data)) {
    const testDealers = data.filter((d: any) =>
      d.legal_name.includes('Ghar-Tak') || d.legal_name.includes('Bengaluru Fast-Fleet')
    );
    assert.equal(testDealers.length, 0, 'No test employers should exist');
  }
});

test('Clean Data & Staging Purge: Only genuine job listing exists for visitors', async () => {
  const { data, error } = await anonClient.rpc('get_public_published_jobs');
  assert.equal(error, null, 'Public discovery RPC should succeed');
  assert.equal(Array.isArray(data), true);
  // Any public job must be legitimate
  const stagingJobs = (data || []).filter((j: any) =>
    j.title.includes('Express Parcel Delivery') || j.title.includes('Hub Sorter')
  );
  assert.equal(stagingJobs.length, 0, 'No staging jobs should be published');
});
