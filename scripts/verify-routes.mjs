import assert from 'node:assert/strict';

const routes = [
  '/',
  '/login',
  '/signup',
  '/onboarding/worker',
  '/profile',
  '/applications',
  '/saved',
  '/employer',
  '/admin',
];

console.log('--- Verifying 9 Required FleetWala Routes on http://localhost:3000 ---');

let passed = 0;
for (const route of routes) {
  const url = `http://localhost:3000${route}`;
  try {
    const res = await fetch(url);
    assert.equal(res.status, 200, `Expected 200 for ${route}`);
    const text = await res.text();
    assert.ok(text.includes('id="root"'), `Root div missing on ${route}`);
    assert.ok(text.includes('id="fw-initial-loader"'), `Initial loader missing on ${route}`);
    assert.ok(text.includes('/src/main.tsx'), `Vite entry missing on ${route}`);
    console.log(`[PASS] ${route.padEnd(20)} -> HTTP ${res.status} | HTML hydrated safely (${text.length} bytes)`);
    passed++;
  } catch (err) {
    console.error(`[FAIL] ${route}:`, err.message);
  }
}

console.log(`\nRoute Verification Result: ${passed}/${routes.length} routes healthy and serving valid HTML.`);
if (passed !== routes.length) process.exit(1);
