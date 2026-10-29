'use strict';

// TC-SEC-04 on the real app: actual auth/material endpoints, persistent
// MongoDB-memory replica set, Vite frontend and a real Chromium browser.
// Creates only disposable test users/materials; never reads the project .env.
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const net = require('node:net');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { chromium } = require('playwright');

const root = path.resolve(__dirname, '..');
const evidenceDir = path.join(root, 'test-results', 'sec004');
const timeoutMs = 120000;
const checks = [];
let apiProcess;
let viteProcess;
let browser;
let apiSeed;
let vitePort;

function record(label) {
  checks.push({ label, result: 'PASS' });
  console.log(`PASS: ${label}`);
}

function findFreePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const port = server.address().port;
      server.close(() => resolve(port));
    });
  });
}

async function waitForHttp(url, proc, label) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (proc.exitCode !== null) throw new Error(`${label} exited with ${proc.exitCode}.`);
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(3000) });
      if (res.status === 200) return;
    } catch { /* Service still starting. */ }
    await new Promise((resolve) => setTimeout(resolve, 600));
  }
  throw new Error(`${label} did not respond within ${timeoutMs / 1000} seconds.`);
}

function startDisposableApi() {
  return new Promise((resolve, reject) => {
    let settled = false;
    let output = '';
    let errors = '';
    const timer = setTimeout(() => fail(new Error(`Disposable API startup timed out. ${errors.slice(-1500)}`)), timeoutMs);
    function fail(error) {
      if (!settled) {
        settled = true;
        clearTimeout(timer);
        reject(error);
      }
    }
    apiProcess = spawn(process.execPath, [path.join(root, 'scripts/sec004-fixture-server.cjs')], {
      cwd: root,
      env: { ...process.env, MONGODB_URI: '', JWT_ACCESS_SECRET: '', NODE_ENV: 'test',
        SEC004_BROWSER_ORIGIN: `http://127.0.0.1:${vitePort}` },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    apiProcess.stdout.setEncoding('utf8');
    apiProcess.stderr.setEncoding('utf8');
    apiProcess.stderr.on('data', (chunk) => { errors += chunk; });
    apiProcess.stdout.on('data', (chunk) => {
      output += chunk;
      const line = output.split('\n').find((entry) => entry.startsWith('MATERIAL_TEST_READY '));
      if (line && !settled) {
        try {
          const seed = JSON.parse(line.slice('MATERIAL_TEST_READY '.length));
          if (!/^http:\/\/127\.0\.0\.1:\d+\/api\/v1$/.test(seed.baseURL)) {
            throw new Error('Refusing a non-loopback test API URL.');
          }
          settled = true;
          clearTimeout(timer);
          resolve(seed);
        } catch (error) { fail(error); }
      }
    });
    apiProcess.on('error', fail);
    apiProcess.on('exit', (code) => fail(new Error(`Disposable API stopped early (${code}): ${errors.slice(-1500)}`)));
  });
}

async function stop(proc) {
  if (!proc || proc.exitCode !== null || proc.signalCode !== null) return;
  proc.kill('SIGTERM');
  await Promise.race([
    new Promise((resolve) => proc.once('exit', resolve)),
    new Promise((resolve) => setTimeout(resolve, 10000)),
  ]);
  if (proc.exitCode === null && proc.signalCode === null) proc.kill('SIGKILL');
}

async function api(route, { method = 'GET', body, token } = {}) {
  const response = await fetch(`${apiSeed.baseURL}${route}`, {
    method,
    headers: {
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    signal: AbortSignal.timeout(10000),
  });
  const json = await response.json();
  return { status: response.status, json };
}

async function expectRejected(label, route, body, token, method = 'POST') {
  const answer = await api(route, { method, body, token });
  assert.equal(answer.status, 400, `${label}: HTTP status ${answer.status}: ${JSON.stringify(answer.json)}`);
  assert.equal(answer.json.error?.code, 'VALIDATION_ERROR', `${label}: unexpected error envelope`);
  assert.equal(answer.json.accessToken, undefined, `${label}: no token may be returned`);
  record(label);
}

async function main() {
  await fs.mkdir(evidenceDir, { recursive: true });
  vitePort = await findFreePort();
  apiSeed = await startDisposableApi();
  const { password, users, materials } = apiSeed;
  const materialId = materials.library.id;

  // Exercise the production HTTP boundary, not a synthetic security route.
  await expectRejected('Login rejects top-level NoSQL $gt object', '/auth/login', {
    email: { $gt: '' }, password,
  });
  await expectRejected('Login rejects nested NoSQL $ne operator', '/auth/login', {
    email: { nested: { $ne: null } }, password,
  });
  await expectRejected('Registration rejects operator email', '/auth/register', {
    name: 'Malicious Signup', email: { $ne: null }, password,
  });
  await expectRejected('Password-reset request rejects operator email', '/auth/forgot-password', {
    email: { $gt: '' },
  });

  const login = await api('/auth/login', {
    method: 'POST', body: { email: users.student, password },
  });
  assert.equal(login.status, 200, 'Valid student login must still work.');
  assert.ok(login.json.accessToken, 'Valid login must issue an access token.');
  const studentToken = login.json.accessToken;
  const ownerLogin = await api('/auth/login', {
    method: 'POST', body: { email: users.owner, password },
  });
  assert.equal(ownerLogin.status, 200);
  const ownerToken = ownerLogin.json.accessToken;
  record('Ordinary real authentication remains functional');

  const commentPath = `/materials/${materialId}/comments`;
  const commentsBefore = await api(commentPath, { token: studentToken });
  assert.equal(commentsBefore.status, 200);
  const countBefore = commentsBefore.json.total;

  await expectRejected('Comment rejects a NoSQL operator', commentPath, { content: { $gt: '' } }, studentToken);
  await expectRejected('Comment rejects nested operator objects', commentPath, {
    content: { nested: { $where: 'return true' } },
  }, studentToken);
  await expectRejected('Comment rejects prototype-pollution keys', commentPath,
    JSON.parse('{"content":"safe","__proto__":{"polluted":true}}'), studentToken);
  await expectRejected('Comment rejects dotted field names', commentPath,
    { content: 'safe', 'meta.admin': true }, studentToken);
  await expectRejected('Rating rejects a NoSQL operator', `/materials/${materialId}/rating`,
    { value: { $gt: 0 } }, studentToken, 'PUT');
  await expectRejected('Report rejects a NoSQL operator', `/materials/${materialId}/reports`,
    { reason: { $ne: null } }, studentToken);

  const invalidEdit = await api(`/materials/${materialId}`, {
    method: 'PATCH', body: { title: { $gt: '' } }, token: ownerToken,
  });
  assert.equal(invalidEdit.status, 400);
  assert.equal(invalidEdit.json.error?.code, 'VALIDATION_ERROR');
  record('Material metadata update rejects NoSQL operator');

  const commentsAfter = await api(commentPath, { token: studentToken });
  assert.equal(commentsAfter.json.total, countBefore, 'Rejected requests must not create comments.');
  const materialAfter = await api(`/materials/${materialId}`, { token: ownerToken });
  assert.equal(materialAfter.json.title, materials.library.title, 'Rejected edit must not mutate material.');
  record('Rejected injection leaves comments and material metadata unchanged');

  // Vite serves the actual React app; its proxy points only at the disposable API.
  const origin = `http://127.0.0.1:${vitePort}`;
  viteProcess = spawn(process.platform === 'win32' ? 'npm.cmd' : 'npm', [
    'run', 'dev', '--workspace', 'client', '--', '--host', '127.0.0.1', '--port', String(vitePort),
  ], {
    cwd: root,
    env: { ...process.env, DEV_API_TARGET: apiSeed.baseURL.replace(/\/api\/v1$/, ''), NODE_ENV: 'test' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  await waitForHttp(origin, viteProcess, 'Vite frontend');
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 850 } });
  const page = await context.newPage();
  const dialogs = [];
  page.on('dialog', (dialog) => {
    dialogs.push(dialog.message());
    dialog.dismiss().catch(() => {});
  });
  await page.goto(`${origin}/materials/${materialId}`, { waitUntil: 'domcontentloaded' });
  await page.getByRole('heading', { name: 'Sign in to open this material' }).waitFor();
  await page.getByLabel('Email').fill(users.student);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.getByRole('heading', { name: materials.library.title }).waitFor({ timeout: 20000 });
  record('Real Chromium signs in and loads the material detail page');

  const hostileText = [
    '<script>window.__sec004_xss = "script"</script>',
    '<img src=x onerror="window.__sec004_xss = \'image\'">',
    '<svg onload="window.__sec004_xss = \'svg\'"></svg>',
    '<a href="javascript:window.__sec004_xss = \'link\'">click</a>',
    '&lt;script&gt;window.__sec004_xss = 1&lt;/script&gt;',
  ];
  for (const payload of hostileText) {
    await page.getByLabel('Add a comment').fill(payload);
    await page.getByRole('button', { name: 'Post comment' }).click();
    const item = page.locator('.material-comments li').filter({ hasText: payload }).last();
    await item.waitFor({ state: 'visible', timeout: 20000 });
    assert.ok((await item.innerText()).includes(payload), 'The exact payload must be visible as literal text.');
    assert.equal(await item.locator('script,img,svg,a,iframe,object,embed').count(), 0,
      'Untrusted comment text must not become executable or navigable elements.');
    assert.equal(await page.evaluate(() => window.__sec004_xss), undefined,
      'Untrusted comment markup must not execute in Chromium.');
    assert.equal(dialogs.length, 0, 'Untrusted comments must never open an alert/dialog.');
    record(`Actual Chromium comments display inert text: ${hostileText.indexOf(payload) + 1}/5`);
  }

  const persisted = await api(commentPath, { token: studentToken });
  assert.equal(persisted.status, 200);
  for (const payload of hostileText) {
    assert.ok(persisted.json.items.some((item) => item.content === payload),
      'The real MongoDB-backed comments API must return exact stored markup.');
  }
  record('Five hostile comments round-trip literally through actual MongoDB-backed API');
  await page.screenshot({ path: path.join(evidenceDir, 'real-chromium-inert-comments.png') });
  await context.close();
}

(async () => {
  let failed = null;
  try {
    await main();
  } catch (error) {
    failed = { message: error.message, stack: error.stack };
    console.error('FAIL: ' + error.stack);
  } finally {
    await fs.mkdir(evidenceDir, { recursive: true });
    await fs.writeFile(path.join(evidenceDir, 'sec004-results.json'), JSON.stringify({
      timestamp: new Date().toISOString(),
      status: failed ? 'FAIL' : 'PASS',
      checks,
      failures: failed ? [failed] : [],
      environment: { node: process.version, browser: 'Playwright Chromium',
        api: 'actual Express routes + disposable MongoDB replica set',
        frontend: 'actual React via Vite; loopback only' },
      limitations: 'This is TC-SEC-04 test coverage, not a comprehensive security/penetration audit.',
    }, null, 2));
    if (browser) await browser.close().catch(() => {});
    await stop(viteProcess);
    await stop(apiProcess);
  }
  if (failed) process.exitCode = 1;
  else console.log(`SEC-004 PASS: ${checks.length} checks; details in test-results/sec004/sec004-results.json`);
  process.exit(failed ? 1 : 0);
})().catch((error) => { console.error(error); process.exitCode = 1; });
