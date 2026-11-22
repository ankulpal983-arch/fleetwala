const { spawn } = require('child_process');
const http = require('http');

async function testBrowserLogin() {
  const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  const userDataDir = 'C:\\Users\\ankul\\AppData\\Local\\Temp\\chrome-login-test';
  const chrome = spawn(chromePath, [
    '--headless=new',
    '--remote-debugging-port=9222',
    '--user-data-dir=' + userDataDir,
    '--disable-gpu',
    '--no-sandbox',
    'about:blank'
  ]);

  for (let i = 0; i < 20; i++) {
    await new Promise(r => setTimeout(r, 300));
    try {
      await new Promise((res, rej) => {
        const req = http.get('http://127.0.0.1:9222/json/version', r => res(true));
        req.on('error', rej);
      });
      break;
    } catch (e) {}
  }

  const targets = await new Promise(r => {
    http.get('http://127.0.0.1:9222/json', res => {
      let b = '';
      res.on('data', c => b += c);
      res.on('end', () => r(JSON.parse(b)));
    });
  });

  const page = targets.find(t => t.type === 'page');
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise(r => ws.onopen = r);

  let id = 1;
  const send = (method, params = {}) => new Promise(res => {
    const curId = id++;
    const handler = evt => {
      const d = JSON.parse(evt.data);
      if (d.id === curId) {
        ws.removeEventListener('message', handler);
        res(d.result);
      }
    };
    ws.addEventListener('message', handler);
    ws.send(JSON.stringify({ id: curId, method, params }));
  });

  const networkRequests = [];
  ws.onmessage = evt => {
    const d = JSON.parse(evt.data);
    if (d.method === 'Network.requestWillBeSent') {
      if (d.params.request.url.includes('supabase.co')) {
        networkRequests.push(d.params.request.method + ' ' + d.params.request.url);
      }
    }
  };

  await send('Page.enable');
  await send('Runtime.enable');
  await send('Network.enable');

  console.log('\n--- A. Testing Login Page in Real Chrome ---');
  await send('Page.navigate', { url: 'http://localhost:3000/login' });
  await new Promise(r => setTimeout(r, 2000));

  const bannerCheckLogin = await send('Runtime.evaluate', {
    expression: 'document.body.innerText.includes("Supabase is not configured")',
    returnByValue: true
  });
  console.log('Does Login show "Supabase is not configured" warning?:', bannerCheckLogin.result.value);

  console.log('\n--- B. Testing Signup Page in Real Chrome ---');
  await send('Page.navigate', { url: 'http://localhost:3000/signup' });
  await new Promise(r => setTimeout(r, 2000));

  const bannerCheckSignup = await send('Runtime.evaluate', {
    expression: 'document.body.innerText.includes("Supabase is not configured")',
    returnByValue: true
  });
  console.log('Does Signup show "Supabase is not configured" warning?:', bannerCheckSignup.result.value);

  // Fill in login form to trigger real Supabase call
  console.log('\n--- C. Submitting Login to Trigger Real Network Request to Supabase ---');
  await send('Page.navigate', { url: 'http://localhost:3000/login' });
  await new Promise(r => setTimeout(r, 1500));

  await send('Runtime.evaluate', {
    expression: `(() => {
      const emailInput = document.querySelector('input[type="email"]');
      const passInput = document.querySelector('input[type="password"]');
      const setVal = (el, val) => {
        const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
        nativeSetter.call(el, val);
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
      };
      setVal(emailInput, 'test_qa@fleetwala.in');
      setVal(passInput, 'WrongPassword999!');
      const submitBtn = document.querySelector('button[type="submit"]');
      submitBtn.click();
    })()`
  });

  console.log('Waiting 3 seconds for Supabase response...');
  await new Promise(r => setTimeout(r, 3000));

  console.log('--- SUPABASE NETWORK REQUESTS CAPTURED ---');
  console.log(networkRequests.join('\n') || 'None');

  const errorText = await send('Runtime.evaluate', {
    expression: `(() => {
      const err = document.querySelector('[role="alert"]') || document.querySelector('.text-destructive');
      return err ? err.innerText : 'NO_ERROR_ELEMENT';
    })()`,
    returnByValue: true
  });
  console.log('--- UI ERROR DISPLAYED IN BROWSER ---');
  console.log(errorText.result.value);

  // Test Signup form submission
  console.log('\n--- D. Submitting Signup to Trigger Real Network Request to Supabase ---');
  await send('Page.navigate', { url: 'http://localhost:3000/signup' });
  await new Promise(r => setTimeout(r, 1500));

  const signupRequests = [];
  const oldHandler = ws.onmessage;
  ws.onmessage = evt => {
    const d = JSON.parse(evt.data);
    if (d.method === 'Network.requestWillBeSent') {
      if (d.params.request.url.includes('supabase.co')) {
        signupRequests.push(d.params.request.method + ' ' + d.params.request.url);
      }
    }
  };

  await send('Runtime.evaluate', {
    expression: `(() => {
      const nameInput = document.getElementById('signup-name');
      const emailInput = document.getElementById('signup-email');
      const passInput = document.getElementById('signup-password');
      const confirmInput = document.getElementById('signup-confirm-password');
      const termsBox = document.getElementById('agree-terms');

      const setVal = (el, val) => {
        const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
        nativeSetter.call(el, val);
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
      };

      setVal(nameInput, 'Verification User');
      setVal(emailInput, 'qa_signup_user@fleetwala.in');
      setVal(passInput, 'ValidPass123!');
      setVal(confirmInput, 'ValidPass123!');
      if (termsBox && !termsBox.checked) {
        termsBox.click();
      }
      setTimeout(() => {
        const submitBtn = document.querySelector('button[data-testid="button-signup-submit"]');
        if (submitBtn) submitBtn.click();
      }, 300);
    })()`
  });

  console.log('Waiting 4 seconds for Supabase Signup response...');
  await new Promise(r => setTimeout(r, 4000));

  console.log('--- SUPABASE SIGNUP NETWORK REQUESTS CAPTURED ---');
  console.log(signupRequests.join('\n') || 'None');

  const signupUiMsg = await send('Runtime.evaluate', {
    expression: `(() => {
      const err = document.querySelector('[role="alert"]') || document.querySelector('.text-destructive');
      return err ? err.innerText : 'NO_ERROR_ELEMENT';
    })()`,
    returnByValue: true
  });
  console.log('--- SIGNUP UI MESSAGE IN BROWSER ---');
  console.log(signupUiMsg.result.value);

  ws.close();
  chrome.kill();
  process.exit(0);
}

testBrowserLogin().catch(e => {
  console.error(e);
  process.exit(1);
});
