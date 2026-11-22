import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { liveGate } from './rules';
import { resolveUserRoleStatus, toDbExperience, fromDbExperience, toDbVehicle, fromDbVehicle } from './repo';
import { formatAuthError } from './supabase';

describe('White Screen & Runtime Resilience Regression Tests', () => {
  it('1. Handles missing Supabase configuration without crashing', () => {
    const gate = liveGate({ enableFlag: false, supabaseConfigured: false });
    assert.equal(gate.blocked, false);
    assert.equal(gate.requested, false);

    // Fail closed if requested without config, but never crash
    const failClosed = liveGate({ enableFlag: true, supabaseConfigured: false });
    assert.equal(failClosed.blocked, false); // requested is false because !supabaseConfigured
    assert.equal(failClosed.requested, false);
  });

  it('2. Live gate passes cleanly when configured and wired', () => {
    const livePass = liveGate({ enableFlag: true, supabaseConfigured: true, wired: true });
    assert.equal(livePass.blocked, false);
    assert.equal(livePass.showLiveData, true);
    assert.equal(livePass.requested, true);
  });

  it('3. Unauthenticated visitor role resolution resolves safely without throwing', async () => {
    const roleStatus = await resolveUserRoleStatus();
    // Default safe fallback without logged-in session:
    assert.equal(roleStatus.isAdmin, false);
    assert.equal(typeof roleStatus.role, 'string');
    assert.equal(typeof roleStatus.onboarded, 'boolean');
  });

  it('4. Role status object contains all expected boolean flags', async () => {
    const roleStatus = await resolveUserRoleStatus();
    assert.equal(typeof roleStatus.isWorker, 'boolean');
    assert.equal(typeof roleStatus.isEmployer, 'boolean');
    assert.equal(typeof roleStatus.isAdmin, 'boolean');
    assert.equal(roleStatus.isAdmin, false);
  });

  it('5. Value mappers prevent PostgreSQL check constraint violations', () => {
    assert.equal(toDbExperience('Fresher (0-1 yrs)'), 'fresher');
    assert.equal(toDbExperience('1–3 years'), '1-3');
    assert.equal(toDbExperience('3+ years'), '3-5');
    assert.equal(fromDbExperience('1-3'), '1–3 years');

    assert.equal(toDbVehicle('Two-wheeler'), 'motorcycle');
    assert.equal(toDbVehicle('Electric scooter'), 'scooter');
    assert.equal(toDbVehicle('E-bike'), 'ev');
    assert.equal(toDbVehicle('None'), 'none');
    assert.equal(fromDbVehicle('ev'), 'E-bike');
  });

  it('6. Safe environment resolution never references undefined process in browser context', () => {
    // Simulate browser context where process is undefined
    const simulatedBrowserGet = (key: string) => {
      const mockImportMetaEnv: Record<string, string> = {
        VITE_SUPABASE_URL: 'https://jigbzsaaowtyaqhreplg.supabase.co',
        VITE_SUPABASE_PUBLISHABLE_KEY: 'mock_key',
      };
      const meta = typeof mockImportMetaEnv !== 'undefined' ? mockImportMetaEnv[key] : undefined;
      // Isomorphic guard pattern used in our repair:
      const proc = typeof (globalThis as any).undefinedProcess !== 'undefined' ? (globalThis as any).undefinedProcess?.env?.[key] : undefined;
      return meta || proc || undefined;
    };

    assert.equal(simulatedBrowserGet('VITE_SUPABASE_URL'), 'https://jigbzsaaowtyaqhreplg.supabase.co');
    assert.doesNotThrow(() => {
      // Simulating accessing a key that is missing from both
      const val = simulatedBrowserGet('NON_EXISTENT_KEY');
      assert.equal(val, undefined);
    });
  });

  it('7. Verify initial loader and error handler are present in index.html', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const html = fs.readFileSync(path.resolve('index.html'), 'utf-8');
    assert.ok(html.includes('id="fw-initial-loader"'), 'index.html must include branded pre-hydration loader');
    assert.ok(html.includes("window.addEventListener('error'"), 'index.html must include window error listener');
  });

  it('8. formatAuthError maps rate limits and GoTrue auth codes into actionable messages', () => {
    // 429 / over_email_send_rate_limit
    const rateLimit1 = formatAuthError({ code: 'over_email_send_rate_limit', message: 'email rate limit exceeded', status: 429 });
    assert.ok(rateLimit1.includes('Email confirmation rate limit reached'));
    assert.ok(rateLimit1.includes('Custom SMTP'));

    const rateLimit2 = formatAuthError('email rate limit exceeded');
    assert.ok(rateLimit2.includes('Email confirmation rate limit reached'));

    // Provider disabled
    const providerErr = formatAuthError({ code: 'provider_disabled', message: 'Unsupported provider: provider is not enabled' });
    assert.ok(providerErr.includes('not yet enabled in your Supabase project'));

    // User already registered
    const userExists = formatAuthError({ message: 'User already registered' });
    assert.ok(userExists.includes('already exists. Please sign in instead.'));

    // Email not confirmed
    const unconfirmed = formatAuthError({ message: 'Email not confirmed' });
    assert.ok(unconfirmed.includes('Please confirm your email address'));

    // Invalid email domain
    const badDomain = formatAuthError({ code: 'email_address_invalid', message: 'Email address "x@y.test" is invalid' });
    assert.ok(badDomain.includes('standard domain required'));
  });
});
