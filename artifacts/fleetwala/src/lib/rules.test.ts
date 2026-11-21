import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  DAILY_LIMIT, canApplyToday, countToday, defaultProfile, isLiveJob, istDay, liveGate, liveJobs, normalizeIndianPhone,
} from './rules';

test('istDay uses Asia/Kolkata calendar date', () => {
  assert.equal(istDay('2025-03-10T18:29:00Z'), '2025-03-10');
  assert.equal(istDay('2025-03-10T18:31:00Z'), '2025-03-11');
});

test('countToday counts only same IST day and same candidate', () => {
  const now = new Date('2025-03-11T04:00:00Z');
  const apps = [
    { candidate_id: 'me', created_at: '2025-03-10T18:45:00Z' },
    { candidate_id: 'me', created_at: '2025-03-10T18:00:00Z' },
    { candidate_id: 'x', created_at: '2025-03-11T01:00:00Z' },
  ];
  assert.equal(countToday(apps, 'me', now), 1);
});

test('daily limit is 20', () => {
  assert.equal(DAILY_LIMIT, 20);
  assert.equal(canApplyToday(19), true);
  assert.equal(canApplyToday(20), false);
});

test('only approved, unexpired jobs are live', () => {
  const now = new Date('2025-03-11T00:00:00Z');
  const future = '2025-04-01T00:00:00Z';
  assert.equal(isLiveJob({ status: 'approved', expires_at: future }, now), true);
  assert.equal(isLiveJob({ status: 'approved', expires_at: '2025-03-01T00:00:00Z' }, now), false);
  for (const s of ['draft', 'pending', 'paused', 'closed'] as const) {
    assert.equal(isLiveJob({ status: s, expires_at: future }, now), false);
  }
  assert.equal(liveJobs([{ status: 'approved', expires_at: future }, { status: 'pending', expires_at: future }], now).length, 1);
});

test('profile discovery defaults off', () => {
  assert.equal(defaultProfile().discoverable, false);
  assert.equal(defaultProfile({ first_name: 'Asha' }).discoverable, false);
  assert.equal(defaultProfile({ discoverable: true }).discoverable, true);
});

test('Indian phone normalization', () => {
  assert.equal(normalizeIndianPhone('98765 43210'), '+919876543210');
  assert.equal(normalizeIndianPhone('+91-98765-43210'), '+919876543210');
  assert.equal(normalizeIndianPhone('09876543210'), '+919876543210');
  assert.equal(normalizeIndianPhone('5876543210'), null);
  assert.equal(normalizeIndianPhone('98765'), null);
  assert.equal(normalizeIndianPhone('+1 415 555 0100'), null);
});

test('live gate fails closed until wired', () => {
  assert.deepEqual(liveGate({ enableFlag: true, supabaseConfigured: true }), { requested: true, showLiveData: false, blocked: true });
  assert.equal(liveGate({ enableFlag: true, supabaseConfigured: false }).requested, false);
  assert.equal(liveGate({ enableFlag: false, supabaseConfigured: true }).blocked, false);
});
