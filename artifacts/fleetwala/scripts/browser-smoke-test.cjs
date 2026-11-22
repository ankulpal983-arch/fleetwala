const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');

const routesToTest = [
  { url: 'http://localhost:3000/', name: 'homepage', expectedText: 'Find local jobs' },
  { url: 'http://localhost:3000/login', name: 'login', expectedText: 'Sign in to FleetWala' },
  { url: 'http://localhost:3000/signup', name: 'signup', expectedText: 'Join FleetWala' },
  { url: 'http://localhost:3000/verify-email', name: 'verify-email', expectedText: 'Check your email' },
  { url: 'http://localhost:3000/forgot-password', name: 'forgot-password', expectedText: 'Reset your password' },
  { url: 'http://localhost:3000/onboarding/worker', name: 'onboarding-worker', expectedText: 'Worker Profile' },
  { url: 'http://localhost:3000/onboarding/employer', name: 'onboarding-employer', expectedText: 'Register Company' },
  { url: 'http://localhost:3000/employer', name: 'employer-dashboard', expectedText: 'Hiring overview' },
  { url: 'http://localhost:3000/admin', name: 'admin-portal', expectedText: 'Access Denied' }
];

async function runTestSuite() {
  const screenshotsDir = path.resolve(__dirname, '../screenshots');
  if (!fs.existsSync(screenshotsDir)) {
    fs.mkdirSync(screenshotsDir, { recursive: true });
  }

  const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  const userDataDir = 'C:\\Users\\ankul\\AppData\\Local\\Temp\\chrome-qa-profile';
  const chrome = spawn(chromePath, [
    '--headless=new',
    '--remote-debugging-port=9222',
    '--user-data-dir=' + userDataDir,
    '--disable-gpu',
    '--no-sandbox',
    '--disable-extensions',
    '--window-size=1280,800',
    'about:blank'
  ]);

  let versionData = null;
  for (let i = 0; i < 20; i++) {
    await new Promise(r => setTimeout(r, 400));
    try {
      versionData = await new Promise((resolve, reject) => {
        const req = http.get('http://127.0.0.1:9222/json/version', res => {
          let body = '';
          res.on('data', chunk => body += chunk);
          res.on('end', () => resolve(JSON.parse(body)));
        });
        req.on('error', reject);
      });
      break;
    } catch (e) {}
  }

  if (!versionData) {
    console.error('Failed to connect to Chrome');
    chrome.kill();
    process.exit(1);
  }

  const targets = await new Promise(r => {
    http.get('http://127.0.0.1:9222/json', res => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => r(JSON.parse(body)));
    });
  });

  const pageTarget = targets.find(t => t.type === 'page');
  const ws = new WebSocket(pageTarget.webSocketDebuggerUrl);
  await new Promise(r => ws.onopen = r);

  let msgId = 1;
  function send(method, params = {}) {
    const id = msgId++;
    return new Promise(resolve => {
      const handler = (evt) => {
        const data = JSON.parse(evt.data);
        if (data.id === id) {
          ws.removeEventListener('message', handler);
          resolve(data.result);
        }
      };
      ws.addEventListener('message', handler);
      ws.send(JSON.stringify({ id, method, params }));
    });
  }

  let currentErrors = [];
  ws.onmessage = (evt) => {
    const data = JSON.parse(evt.data);
    if (data.method === 'Runtime.consoleAPICalled' && data.params.type === 'error') {
      const text = data.params.args.map(a => a.value || a.description || JSON.stringify(a)).join(' ');
      currentErrors.push(text);
    }
    if (data.method === 'Runtime.exceptionThrown') {
      const desc = data.params.exceptionDetails.exception?.description || data.params.exceptionDetails.text;
      currentErrors.push('[EXCEPTION] ' + desc);
    }
  };

  await send('Runtime.enable');
  await send('Page.enable');
  await send('DOM.enable');

  const results = [];

  for (const item of routesToTest) {
    currentErrors = [];
    console.log(`\nNavigating to ${item.name} (${item.url})...`);
    await send('Page.navigate', { url: item.url });
    await new Promise(r => setTimeout(r, 1500));

    const titleRes = await send('Runtime.evaluate', { expression: 'document.title' });
    const title = titleRes?.result?.value || '';

    const bodyRes = await send('Runtime.evaluate', { expression: 'document.body.innerText' });
    const innerText = bodyRes?.result?.value || '';

    const htmlRes = await send('Runtime.evaluate', { expression: 'document.getElementById("root")?.innerHTML || ""' });
    const htmlLen = (htmlRes?.result?.value || '').length;

    // Capture screenshot
    const ss = await send('Page.captureScreenshot', { format: 'png' });
    if (ss?.data) {
      fs.writeFileSync(path.join(screenshotsDir, `${item.name}.png`), Buffer.from(ss.data, 'base64'));
    }

    const hasExpected = innerText.toLowerCase().includes(item.expectedText.toLowerCase());
    const pass = htmlLen > 200 && currentErrors.length === 0;

    results.push({
      route: item.url,
      name: item.name,
      title,
      htmlLen,
      hasExpected,
      errors: currentErrors.slice(),
      status: pass ? 'PASS' : 'FAIL'
    });

    console.log(`  -> Title: "${title}" | DOM length: ${htmlLen} | Status: ${pass ? 'PASS' : 'FAIL'}`);
    if (currentErrors.length > 0) {
      console.log(`     Errors:`, currentErrors);
    }
  }

  console.log('\n========================================');
  console.log('         BROWSER TEST SUMMARY           ');
  console.log('========================================');
  let allPass = true;
  for (const r of results) {
    console.log(`${r.status === 'PASS' ? '✅' : '❌'} [${r.status}] ${r.name.padEnd(20)} | Title: ${r.title}`);
    if (r.status !== 'PASS') allPass = false;
  }

  ws.close();
  chrome.kill();
  process.exit(allPass ? 0 : 1);
}

runTestSuite().catch(e => {
  console.error('Test suite failed:', e);
  process.exit(1);
});
