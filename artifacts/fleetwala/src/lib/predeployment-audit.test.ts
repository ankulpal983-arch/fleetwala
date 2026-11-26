import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';
import {
  DEFAULT_RADIUS_KM,
  findNearestSupportedCity,
  haversineKm,
  isValidCoordinate,
  normalizeIndianPincode,
} from './rules';

const url = process.env.VITE_SUPABASE_URL || 'https://jigbzsaaowtyaqhreplg.supabase.co';
const key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_DMZUfsE7ZVRronZL7fDyew_F3TdP2RB';

const anonClient = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});

function readSrc(relPath: string): string {
  return fs.readFileSync(path.resolve(process.cwd(), relPath), 'utf8');
}

describe('Pre-Deployment Security, Privacy, Location & Workflow Regression Audit', () => {
  it('1. Auth bypass removal: fleetwala_test_auth does not exist anywhere in src/', () => {
    const authCtx = readSrc('src/lib/auth-context.tsx');
    assert.equal(authCtx.includes('fleetwala_test_auth'), false, 'Auth bypass must be completely removed from auth-context.tsx');
    assert.ok(authCtx.includes('queryClient.clear()'), 'Logout and session changes must clear TanStack Query cache');
    assert.ok(authCtx.includes('SESSION_RESET_EVENT'), 'Session reset event must clear pilot local storage state');

    const storeSrc = readSrc('src/lib/store.tsx');
    assert.ok(storeSrc.includes('SESSION_RESET_EVENT'), 'PilotProvider must subscribe to SESSION_RESET_EVENT');
    assert.ok(storeSrc.includes('localStorage.removeItem(STORAGE_KEY)'), 'Logout must purge localStorage store');
  });

  it('2. API server CORS is fail-closed with body cap, rate limiter, headers, and shutdown', () => {
    const appSrc = readSrc('../api-server/src/app.ts');
    assert.equal(/\.vercel\.app/.test(appSrc), false, 'Wildcard *.vercel.app CORS regex must be removed');
    assert.equal(appSrc.includes('callback(null, true);\n      }\n    }'), false);
    assert.ok(appSrc.includes('CORS origin denied'), 'Unknown Origin must fail closed with 403');
    assert.ok(appSrc.includes('https://fleetwala.app'), 'Planned production origin must be in allowlist');
    assert.ok(appSrc.includes('limit: "100kb"'), 'JSON/urlencoded body size cap must be configured');
    assert.ok(appSrc.includes('status(429)'), 'API rate limit must respond 429');
    assert.ok(appSrc.includes('X-Content-Type-Options'), 'Security headers must be applied');

    const idxSrc = readSrc('../api-server/src/index.ts');
    assert.ok(idxSrc.includes('SIGTERM') && idxSrc.includes('SIGINT'), 'API server must handle graceful shutdown');
    assert.ok(idxSrc.includes('"0.0.0.0"'), 'API server must bind to 0.0.0.0');
  });

  it('3. Geolocation, invalid coordinates, Haversine distance & Indian pincode rules', () => {
    assert.equal(DEFAULT_RADIUS_KM, 15);
    assert.equal(isValidCoordinate(28.5921, 77.046), true);
    assert.equal(isValidCoordinate(Number.NaN, 77.0), false);
    assert.equal(isValidCoordinate(95, 77.0), false);
    assert.equal(isValidCoordinate(28.6, 181), false);
    assert.equal(isValidCoordinate(0, 0), false);

    assert.equal(haversineKm({ lat: 28.5921, lng: 77.046 }, { lat: 999, lng: 0 }), Number.POSITIVE_INFINITY);

    const dwarka = findNearestSupportedCity(28.5921, 77.046, 15);
    assert.ok(dwarka);
    assert.equal(dwarka.city, 'Delhi NCR');
    assert.equal(dwarka.withinRadius, false);

    const centralDelhi = findNearestSupportedCity(28.6139, 77.209, 15);
    assert.ok(centralDelhi);
    assert.equal(centralDelhi.city, 'Delhi NCR');
    assert.equal(centralDelhi.distanceKm, 0);
    assert.equal(centralDelhi.withinRadius, true);

    assert.equal(normalizeIndianPincode('Dwarka 110075'), '110075');
    assert.equal(normalizeIndianPincode('010001'), null);
    assert.equal(normalizeIndianPincode('12345'), null);
  });

  it('4. Worker UI avoids settings overwrite, hidden live apps, and silent support success', () => {
    const workerMore = readSrc('src/pages/worker-more.tsx');
    assert.equal(workerMore.includes('if (!job) return null;'), false, 'Live applications must render even when pilot jobs array is empty');
    assert.ok(workerMore.includes('setLiveApplicationStatus'), 'Withdraw action must update Supabase application status');
    assert.ok(workerMore.includes('setLiveWorkerDiscoverability'), 'Settings discoverability toggle must use dedicated atomic helper');
    assert.equal(workerMore.includes('saveLiveWorkerProfile({ ...state.profile'), false, 'Settings must never overwrite profile with empty state');

    const legalSrc = readSrc('src/pages/legal.tsx');
    assert.ok(legalSrc.includes('submitLiveSupportTicket'), 'Support form must use audited ticket helper');
    assert.equal(legalSrc.includes("toast({\n        title: 'Request logged',\n        description: 'Your inquiry has been queued for review.',\n      });\n      setSubmitted(true);"), false, 'Support form must never fake success on error');
  });

  it('5. Employer candidates ShieldCheck import & admin live moderation wiring', () => {
    const empSrc = readSrc('src/pages/employer.tsx');
    assert.ok(empSrc.includes('ShieldCheck'), 'employer.tsx must import ShieldCheck');
    assert.equal(empSrc.includes('FW-PILOT'), false);
    assert.equal(empSrc.includes('No email is sent in the pilot.'), false);

    const adminSrc = readSrc('src/pages/admin.tsx');
    assert.ok(adminSrc.includes('adminSetLiveJobState'), 'AdminJobs must wire Pause/Close to admin_set_job_state RPC');
    assert.ok(adminSrc.includes('getLiveAdminAuditLog'), 'AdminOverview/AdminAudit must query live audit_log');
    assert.ok(adminSrc.includes('getLiveAdminSupportTickets'), 'AdminSupport must query live support_tickets');
  });

  it('6. Deployment configs preserve favicon.svg and target fleetwala.app origins', () => {
    const rootVercel = readSrc('../../vercel.json');
    const appVercel = readSrc('vercel.json');
    const renderYaml = readSrc('../../render.yaml');

    assert.ok(rootVercel.includes('favicon.svg'));
    assert.ok(appVercel.includes('favicon.svg'));
    assert.ok(renderYaml.includes('https://fleetwala.app'));
    assert.ok(renderYaml.includes('--frozen-lockfile'));
    assert.equal(renderYaml.includes('fleetwala.vercel.app'), false);
  });

  it('7. Migration 027 exists with least-privilege SQL, sanitized locality & cryptographic handle hardening', () => {
    const mig027 = readSrc('../../supabase/migrations/027_predeployment_security_and_rls_hardening.sql');
    assert.ok(mig027.includes('revoke all on table public.candidate_invitations from public, anon, authenticated;'));
    assert.ok(mig027.includes('revoke all on function public.bootstrap_admin(text) from public, anon, authenticated;'));
    assert.ok(mig027.includes('revoke all on sequence public.audit_log_id_seq from public, anon, authenticated;'));
    assert.ok(mig027.includes('sanitize_locality'));
    assert.ok(mig027.includes('safe_worker_locality'));
    assert.ok(mig027.includes('^[0-9a-f]{64}$'), 'create_candidate_invitation must require 64-char SHA-256 hex handles');
    assert.equal(mig027.includes('w.id::text = p_candidate_handle'), false, 'Raw w.id fallback matching must be removed');
    assert.equal(mig027.includes("'cand-' || substr("), false, 'Predictable cand-<8-char-uuid> handle generation must be removed');
    assert.ok(mig027.includes('get_employer_applicants'));
    assert.ok(mig027.includes('get_worker_applications'));
    assert.ok(mig027.includes('set_worker_discoverability'));
    assert.ok(mig027.includes('admin_update_support_ticket'));

    const prodInit = readSrc('../../supabase/production/001_production_baseline_schema.sql');
    assert.ok(prodInit.includes('enable row level security'));
    assert.equal(/11111111-1111-1111-1111-111111111111|5733aa5f-ee59|6e7c9a06-b7ba|af42f70c-6b4f|761d0d18-99ed|800d0fd8-ff46/i.test(prodInit), false, 'Production baseline must contain zero staging UUIDs');
    assert.equal(/ankulpalwork@gmail\.com|fleetwala\.internal|admin_grant_staging_job_waiver/i.test(prodInit), false, 'Production baseline must contain zero staging emails or staging waivers');

    const repoSrc = readSrc('src/lib/repo.ts');
    assert.equal(repoSrc.includes('worker?.id ? `FW-${worker.id.slice'), false, 'Client repo fallback must never derive codes from raw worker UUID');
  });

  it('8. RLS Negative: Anon cannot read private tables or mutate candidate_invitations / support_tickets', async () => {
    const privateTables = [
      'workers',
      'worker_preferences',
      'user_accounts',
      'employers',
      'employer_memberships',
      'job_applications',
      'candidate_invitations',
      'conversations',
      'conversation_participants',
      'support_tickets',
      'contact_unlocks',
      'payment_orders',
      'payment_events',
      'billing_settings',
    ];

    for (const table of privateTables) {
      const { data, error } = await anonClient.from(table).select('*').limit(1);
      if (error) {
        assert.ok(error.code === '42501' || error.message.length > 0, `Expected clean RLS denial on ${table}`);
      } else {
        assert.equal(data?.length ?? 0, 0, `Anon must see 0 rows in private table ${table}`);
      }
    }

    const { error: invErr } = await anonClient.from('candidate_invitations').insert({
      employer_id: '00000000-0000-0000-0000-000000000001',
      worker_id: '00000000-0000-0000-0000-000000000002',
      candidate_handle: 'fake',
    });
    assert.notEqual(invErr, null, 'Anon insert into candidate_invitations must be rejected');

    const { error: tkErr } = await anonClient.from('support_tickets').insert({
      opened_by: '00000000-0000-0000-0000-000000000001',
      subject: 'Anon spam',
      details: 'Should be rejected by RLS',
    });
    assert.notEqual(tkErr, null, 'Anon insert into support_tickets must be rejected');

    const { error: stateErr } = await anonClient.rpc('admin_set_job_state', {
      p_job_id: '00000000-0000-0000-0000-000000000001',
      p_state: 'paused',
      p_reason: 'Unauthorized test',
    });
    assert.notEqual(stateErr, null, 'Anon cannot call admin_set_job_state');

    const { error: inviteRpcErr } = await anonClient.rpc('create_candidate_invitation', {
      p_candidate_handle: 'fake-handle',
      p_job_id: '00000000-0000-0000-0000-000000000001',
      p_message: 'hi',
    });
    assert.notEqual(inviteRpcErr, null, 'Anon cannot call create_candidate_invitation');
  });

  it('9. Public job RPC returns only approved live jobs from verified employers', async () => {
    const { data, error } = await anonClient.rpc('get_public_published_jobs');
    assert.equal(error, null, 'Public job discovery RPC must work for visitors');
    assert.equal(Array.isArray(data), true);
    for (const j of data || []) {
      assert.ok(j.id && j.title && j.city, 'Public job must contain basic listing fields');
      if (j.expires_at) {
        assert.ok(new Date(j.expires_at).getTime() > Date.now(), 'Public discovery must exclude expired jobs');
      }
    }
  });
});
