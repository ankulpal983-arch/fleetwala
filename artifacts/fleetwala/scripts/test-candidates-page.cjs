const { spawn } = require('child_process');
const http = require('http');

async function testCandidatesBrowser() {
  const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  const userDataDir = 'C:\\Users\\ankul\\AppData\\Local\\Temp\\chrome-qa-profile-candidates';
  const chrome = spawn(chromePath, [
    '--headless=new',
    '--remote-debugging-port=9223',
    '--user-data-dir=' + userDataDir,
    '--disable-gpu',
    '--no-sandbox',
    '--disable-extensions',
    '--window-size=1280,900',
    'about:blank'
  ]);

  let versionData = null;
  for (let i = 0; i < 20; i++) {
    await new Promise(r => setTimeout(r, 400));
    try {
      versionData = await new Promise((resolve, reject) => {
        const req = http.get('http://127.0.0.1:9223/json/version', res => {
          let body = '';
          res.on('data', chunk => body += chunk);
          res.on('end', () => resolve(JSON.parse(body)));
        });
        req.on('error', reject);
      });
      break;
    } catch (e) {}
  }

  const targets = await new Promise(r => {
    http.get('http://127.0.0.1:9223/json', res => {
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

  const errors = [];
  ws.onmessage = (evt) => {
    const data = JSON.parse(evt.data);
    if (data.method === 'Runtime.consoleAPICalled' && data.params.type === 'error') {
      const text = data.params.args.map(a => a.value || a.description || JSON.stringify(a)).join(' ');
      errors.push(text);
    }
    if (data.method === 'Runtime.exceptionThrown') {
      const desc = data.params.exceptionDetails.exception?.description || data.params.exceptionDetails.text;
      errors.push('[EXCEPTION] ' + desc);
    }
  };

  await send('Runtime.enable');
  await send('Page.enable');

  await send('Page.navigate', { url: 'http://localhost:3000/' });
  await new Promise(r => setTimeout(r, 1000));

  await send('Page.navigate', { url: 'http://localhost:3000/employer/candidates' });
  await new Promise(r => setTimeout(r, 2000));

  const textRes = await send('Runtime.evaluate', { expression: 'document.body.innerText' });
  const innerText = textRes?.result?.value || '';

  const htmlRes = await send('Runtime.evaluate', { expression: 'document.getElementById("root")?.innerHTML || ""' });
  const innerHTML = htmlRes?.result?.value || '';

  console.log('--- CANDIDATE ROUTE GUARD VERIFICATION (NO AUTH BYPASS) ---');
  console.log('1. Unauthenticated access blocked by Employer Workspace Required guard:', innerText.includes('Employer Workspace Required'));
  console.log('2. Protected candidate roster not exposed unauthenticated:', !innerText.includes('Privacy Protection:') && !innerHTML.includes('data-testid="select-candidate-city"'));
  console.log('3. DOM rendered length:', innerHTML.length);
  console.log('4. Errors logged count:', errors.length);
  if (errors.length > 0) {
    console.log('   Errors detail:', errors);
  }
  console.log('5. No ShieldCheck error:', !errors.some(e => e.includes('ShieldCheck')));
  console.log('6. No ReferenceError:', !errors.some(e => e.includes('ReferenceError')));

  ws.close();
  chrome.kill();

  const success = innerText.includes('Employer Workspace Required') &&
                  !innerText.includes('Privacy Protection:') &&
                  !innerHTML.includes('data-testid="select-candidate-city"') &&
                  errors.length === 0;
  console.log('\nOverall Verification Status:', success ? 'PASS' : 'FAIL');
  process.exit(success ? 0 : 1);
}

testCandidatesBrowser().catch(err => {
  console.error('Test error:', err);
  process.exit(1);
});
