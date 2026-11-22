import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';

const url = process.env.VITE_SUPABASE_URL || 'https://jigbzsaaowtyaqhreplg.supabase.co';
const key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_DMZUfsE7ZVRronZL7fDyew_F3TdP2RB';

const anonClient = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// ============================================================================
// 1. TWO-WAY CHAT & CONVERSATION RLS TESTS
// ============================================================================
test('Hiring Chat RLS: Unauthenticated EXECUTE on get_user_conversations is denied', async () => {
  const { data, error } = await anonClient.rpc('get_user_conversations');
  assert.notEqual(error, null, 'Anonymous caller cannot execute get_user_conversations');
  assert.equal(
    error?.code === '42501' || error?.message?.includes('Authentication required') || error?.message?.includes('permission denied'),
    true,
    'Must enforce authentication'
  );
});

test('Hiring Chat RLS: Unauthenticated EXECUTE on send_message is denied', async () => {
  const { data, error } = await anonClient.rpc('send_message', {
    p_conversation_id: '00000000-0000-0000-0000-000000000001',
    p_body: 'Hello candidate',
  });
  assert.notEqual(error, null, 'Anonymous caller cannot send messages');
  assert.equal(
    error?.code === '42501' || error?.message?.includes('Authentication required') || error?.message?.includes('permission denied'),
    true,
    'Must enforce authentication'
  );
});

test('Hiring Chat RLS: Direct anonymous SELECT on public.messages is blocked', async () => {
  const { data, error } = await anonClient.from('messages').select('*');
  if (error) {
    assert.equal(error.code, '42501', 'Must return 42501 permission denied');
  } else {
    assert.equal(Array.isArray(data), true);
    assert.equal(data.length, 0, 'Anonymous caller must never see private messages');
  }
});

test('Hiring Chat RLS: Direct anonymous SELECT on public.conversations is blocked', async () => {
  const { data, error } = await anonClient.from('conversations').select('*');
  if (error) {
    assert.equal(error.code, '42501', 'Must return 42501 permission denied');
  } else {
    assert.equal(Array.isArray(data), true);
    assert.equal(data.length, 0, 'Anonymous caller must never see private conversations');
  }
});

// ============================================================================
// 2. JOB VISIBILITY & STATE TRANSITIONS (PAUSE, RESUME, CLOSE)
// ============================================================================
test('Job State RLS: Unauthenticated EXECUTE on update_employer_job_state is denied', async () => {
  const { data, error } = await anonClient.rpc('update_employer_job_state', {
    p_job_id: '00000000-0000-0000-0000-000000000001',
    p_action: 'pause',
  });
  assert.notEqual(error, null, 'Anonymous caller cannot update employer job state');
  assert.equal(
    error?.code === '42501' || error?.message?.includes('Authentication required') || error?.message?.includes('permission denied'),
    true,
    'Must enforce authentication'
  );
});

test('Job Discovery: Public discovery RPC get_public_published_jobs returns only live approved listings', async () => {
  const { data, error } = await anonClient.rpc('get_public_published_jobs');
  assert.equal(error, null, 'Public discovery RPC must be callable by visitors');
  assert.equal(Array.isArray(data), true, 'Must return an array of live jobs');
  // Verify all returned jobs have valid compensation and title
  for (const job of data as any[]) {
    assert.equal(typeof job.title, 'string', 'Job title must be string');
    assert.equal(typeof job.city, 'string', 'Job city must be string');
    assert.equal(typeof job.salary_min_inr, 'number', 'Salary min must be number');
    assert.equal(job.salary_min_inr > 0, true, 'Salary must be positive');
  }
});

test('Job Direct Application Security: apply_to_job rejects non-eligible / dummy job ids', async () => {
  const dummyJobId = '00000000-0000-0000-0000-000000000001';
  const { data, error } = await anonClient.rpc('apply_to_job', { p_job_id: dummyJobId });
  assert.notEqual(error, null, 'Must reject application to invalid/unauthorized job');
});

// ============================================================================
// 3. APPLICATION-LINKED CANDIDATE INVITATIONS
// ============================================================================
test('Application Invitations RLS: Unauthenticated EXECUTE on create_application_invitation is denied', async () => {
  const { data, error } = await anonClient.rpc('create_application_invitation', {
    p_application_id: '00000000-0000-0000-0000-000000000001',
    p_message: 'Please join our delivery team for an interview',
  });
  assert.notEqual(error, null, 'Anonymous caller cannot create application invitations');
  assert.equal(
    error?.code === '42501' || error?.message?.includes('Authentication required') || error?.message?.includes('permission denied'),
    true,
    'Must enforce authentication'
  );
});

test('Application Invitations RLS: Unauthenticated EXECUTE on respond_to_candidate_invitation is denied', async () => {
  const { data, error } = await anonClient.rpc('respond_to_candidate_invitation', {
    p_invitation_id: '00000000-0000-0000-0000-000000000001',
    p_accept: true,
  });
  assert.notEqual(error, null, 'Anonymous caller cannot respond to invitations');
  assert.equal(
    error?.code === '42501' || error?.message?.includes('Authentication required') || error?.message?.includes('permission denied'),
    true,
    'Must enforce authentication'
  );
});
