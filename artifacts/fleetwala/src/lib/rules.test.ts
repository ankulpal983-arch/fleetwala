import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  DAILY_LIMIT,
  PRD_PRICING,
  anonymizedCandidateProjection,
  canApplyToday,
  countToday,
  defaultProfile,
  hasProhibitedFee,
  isAllowedRegistrationRole,
  isLiveJob,
  isValidAppStatusTransition,
  isValidSalaryRange,
  istDay,
  liveGate,
  liveJobs,
  normalizeIndianPhone,
} from './rules';

test('istDay uses Asia/Kolkata calendar date', () => {
  assert.equal(istDay('2025-03-10T18:29:00Z'), '2025-03-10');
  assert.equal(istDay('2025-03-10T18:31:00Z'), '2025-03-11');
});

test('midnight IST reset: 23:59:59 IST vs 00:00:01 IST', () => {
  // 18:29:59 UTC is 23:59:59 IST on 2026-11-21
  const beforeMidnight = new Date('2026-11-21T18:29:59Z');
  // 18:30:01 UTC is 00:00:01 IST on 2026-11-22
  const afterMidnight = new Date('2026-11-21T18:30:01Z');

  assert.equal(istDay(beforeMidnight), '2026-11-21');
  assert.equal(istDay(afterMidnight), '2026-11-22');

  const apps = [
    { candidate_id: 'w1', created_at: beforeMidnight.toISOString() },
  ];
  // On 2026-11-21 before midnight, 1 application is used
  assert.equal(countToday(apps, 'w1', beforeMidnight), 1);
  // After midnight on 2026-11-22, count resets to 0
  assert.equal(countToday(apps, 'w1', afterMidnight), 0);
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

test('daily limit is 20: 20th succeeds, 21st refused', () => {
  assert.equal(DAILY_LIMIT, 20);
  assert.equal(canApplyToday(0), true);
  assert.equal(canApplyToday(19), true, '20th application must be permitted');
  assert.equal(canApplyToday(20), false, '21st application must be rejected');
  assert.equal(canApplyToday(21), false);
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

test('application status transitions: terminal states cannot reopen', () => {
  // Valid forward transitions
  assert.equal(isValidAppStatusTransition('applied', 'viewed'), true);
  assert.equal(isValidAppStatusTransition('viewed', 'shortlisted'), true);
  assert.equal(isValidAppStatusTransition('shortlisted', 'hired'), true);
  assert.equal(isValidAppStatusTransition('applied', 'withdrawn'), true);
  assert.equal(isValidAppStatusTransition('viewed', 'withdrawn'), true);
  assert.equal(isValidAppStatusTransition('shortlisted', 'withdrawn'), true);
  assert.equal(isValidAppStatusTransition('applied', 'rejected'), true);

  // Same status is idempotent
  assert.equal(isValidAppStatusTransition('applied', 'applied'), true);

  // Invalid: cannot reopen terminal states
  assert.equal(isValidAppStatusTransition('withdrawn', 'hired'), false);
  assert.equal(isValidAppStatusTransition('withdrawn', 'applied'), false);
  assert.equal(isValidAppStatusTransition('rejected', 'shortlisted'), false);
  assert.equal(isValidAppStatusTransition('hired', 'applied'), false);
});

test('prohibited fee detection blocks predatory job posts', () => {
  assert.equal(hasProhibitedFee('Join us today! ₹500 registration fee required.'), true);
  assert.equal(hasProhibitedFee('Security deposit of 2000 needed for delivery bag.'), true);
  assert.equal(hasProhibitedFee('Pay to join our courier network.'), true);
  assert.equal(hasProhibitedFee('Non-refundable joining fee.'), true);
  assert.equal(hasProhibitedFee('Deliver parcels with your two-wheeler. Fuel allowance included.'), false);
});

test('salary range validation: min must be positive and <= max', () => {
  assert.equal(isValidSalaryRange(15000, 25000), true);
  assert.equal(isValidSalaryRange(20000, 20000), true);
  assert.equal(isValidSalaryRange(25000, 15000), false);
  assert.equal(isValidSalaryRange(-1000, 10000), false);
  assert.equal(isValidSalaryRange(0, 10000), false);
});

test('anonymized candidate projection excludes sensitive contact PII', () => {
  const worker = {
    first_name: 'Ravi',
    city: 'Bengaluru',
    area: 'Whitefield',
    experience: '1-3 years',
    vehicle: 'Motorcycle',
    own_vehicle: true,
    available: true,
    discoverable: true,
  };
  const projected = anonymizedCandidateProjection(worker);
  assert.deepEqual(projected, {
    first_name: 'Ravi',
    city: 'Bengaluru',
    area: 'Whitefield',
    experience: '1-3 years',
    vehicle: 'Motorcycle',
    own_vehicle: true,
    available: true,
  });
  // Verify sensitive contact fields are not exposed
  assert.equal('phone' in projected, false);
  assert.equal('email' in projected, false);
  assert.equal('address' in projected, false);
});

test('liveGate with wired: true passes cleanly when configured', () => {
  assert.deepEqual(
    liveGate({ enableFlag: true, supabaseConfigured: true, wired: true }),
    { requested: true, showLiveData: true, blocked: false }
  );
});

test('pricing baseline conforms to PRD: ₹99 job post, ₹10 candidate unlock', () => {
  assert.equal(PRD_PRICING.JOB_POSTING_INR, 99);
  assert.equal(PRD_PRICING.CANDIDATE_UNLOCK_INR, 10);
});

test('admin privileges cannot be obtained via self-registration roles', () => {
  assert.equal(isAllowedRegistrationRole('worker'), true);
  assert.equal(isAllowedRegistrationRole('employer'), true);
  assert.equal(isAllowedRegistrationRole('admin'), false, 'Admin self-registration must be strictly rejected');
  assert.equal(isAllowedRegistrationRole('superuser'), false);
  assert.equal(isAllowedRegistrationRole(''), false);
});

test('candidate opt-out discoverability defaults to false', () => {
  const defaultWorker = defaultProfile();
  assert.equal(defaultWorker.discoverable, false);
  const optedInWorker = defaultProfile({ discoverable: true });
  assert.equal(optedInWorker.discoverable, true);
});

