'use strict';

// TC-PORT-01: real React/Vite + Express/Mongo fixture in available browsers.
// Install test browsers with: npx playwright install firefox webkit
// Branded Chrome/Edge must be installed separately on the host.
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const net = require('node:net');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { chromium, firefox, webkit } = require('playwright');

const root = path.resolve(__dirname, '..');
const evidenceDir = path.join(root, 'test-results', 'nfr006');
const browsers = [
  { name: 'Chrome', engine: chromium, options: { channel: 'chrome' } },
  { name: 'Edge', engine: chromium, options: process.env.NFR006_EDGE_PATH
    ? { executablePath: process.env.NFR006_EDGE_PATH, args: ['--disable-gpu'] }
    : { channel: 'msedge' } },
  { name: 'Firefox', engine: firefox, options: {} },
  { name: 'WebKit', engine: webkit, options: {} },
];
let api;
let vite;

async function freePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const port = server.address().port;
      server.close(() => resolve(port));
    });
  });
}

async function waitFor(url) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    try {
      if ((await fetch(url, { signal: AbortSignal.timeout(1500) })).status === 200) return;
    } catch { /* Starting. */ }
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
  throw new Error(`UI did not start at ${url}`);
}

async function startFixture(origin) {
  api = spawn(process.execPath, [path.join(root, 'scripts/sec004-fixture-server.cjs')], {
    cwd: root,
    env: { ...process.env, NODE_ENV: 'test', MONGODB_URI: '', JWT_ACCESS_SECRET: '', SEC004_BROWSER_ORIGIN: origin },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  return new Promise((resolve, reject) => {
    let output = '';
    let errors = '';
    const timeout = setTimeout(() => reject(new Error(`API fixture timeout: ${errors}`)), 60000);
    api.stderr.on('data', (data) => { errors += data; });
    api.stdout.on('data', (data) => {
      output += data;
      const line = output.split('\n').find((part) => part.startsWith('MATERIAL_TEST_READY '));
      if (line) {
        clearTimeout(timeout);
        resolve(JSON.parse(line.slice('MATERIAL_TEST_READY '.length)));
      }
    });
    api.once('error', reject);
    api.once('exit', (code) => reject(new Error(`API fixture exited ${code}: ${errors}`)));
  });
}

async function signIn(page, { email, password, button }) {
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: button }).click();
}

async function verifyRegistrationApi(page, browserName) {
  const email = `nfr006-${browserName.toLowerCase()}@example.com`;
  const response = await page.evaluate(async ({ nextEmail }) => {
    const result = await fetch('/api/v1/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'NFR006 Browser User', email: nextEmail, password: 'Browser1234' }),
    });
    return { status: result.status, body: await result.json() };
  }, { nextEmail: email });
  assert.equal(response.status, 201, `${browserName}: registration API status`);
  assert.equal(response.body.user.email, email, `${browserName}: registration API identity`);
  return email;
}

async function verifyMaterials(page, config, origin, fixture, suffix, clickOptions) {
  await page.goto(`${origin}/materials`, { waitUntil: 'domcontentloaded' });
  await page.getByRole('heading', { name: 'Sign in to browse materials' }).waitFor();

  await page.getByLabel('Email').fill('invalid');
  await page.getByLabel('Password').fill('short');
  await page.getByRole('button', { name: 'Sign in' }).click(clickOptions);
  await page.getByRole('alert').first().waitFor();

  await signIn(page, {
    email: fixture.users.owner,
    password: fixture.password,
    button: 'Sign in',
  });
  await page.getByRole('link', { name: fixture.materials.library.title }).waitFor();
  await page.getByRole('link', { name: fixture.materials.library.title }).click(clickOptions);
  await page.getByRole('heading', { name: fixture.materials.library.title }).waitFor();
  await page.getByRole('heading', { name: 'Comments' }).waitFor();

  await page.goto(`${origin}/materials`, { waitUntil: 'domcontentloaded' });
  await signIn(page, {
    email: fixture.users.owner,
    password: fixture.password,
    button: 'Sign in',
  });
  const upload = page.getByRole('form', { name: 'Upload material' });
  const title = `NFR006 ${config.name} upload ${suffix}`;
  await upload.getByLabel('Title').fill(title);
  await upload.getByLabel('Description').fill('Cross-browser upload acceptance evidence.');
  await upload.getByLabel('Category').fill('Notes');
  await upload.getByLabel('Topic').fill('browser compatibility');
  await upload.getByLabel('Tags').fill('nfr006, compatibility');
  await upload.getByLabel('Visibility').selectOption('public');
  await upload.getByLabel('File', { exact: true }).setInputFiles({
    name: 'nfr006.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from('%PDF-1.7\nNFR006 browser acceptance\n'),
  });
  await upload.getByLabel('I have the rights to share this file.').check();
  await upload.getByRole('button', { name: 'Upload material' }).click(clickOptions);
  await page.getByRole('link', { name: title }).waitFor();
  await page.getByRole('link', { name: title }).click(clickOptions);
  await page.getByRole('button', { name: 'Edit material' }).click(clickOptions);
  const edit = page.getByRole('form', { name: 'Edit material' });
  const editedTitle = `${title} edited`;
  await edit.getByLabel('Title').fill(editedTitle);
  await edit.getByRole('button', { name: 'Save changes' }).click(clickOptions);
  await page.getByRole('heading', { name: editedTitle }).waitFor();
}

async function createAndPublishQuiz(page, config, origin, fixture, suffix, clickOptions) {
  await page.goto(`${origin}/quizzes`, { waitUntil: 'domcontentloaded' });
  await page.getByRole('heading', { name: 'Quiz authoring' }).waitFor();
  await signIn(page, {
    email: fixture.users.owner,
    password: fixture.password,
    button: 'Sign in to author quizzes',
  });
  const editor = page.getByRole('form', { name: 'Quiz editor' });
  await editor.getByRole('button', { name: 'Save draft' }).click(clickOptions);
  await editor.getByRole('alert').first().waitFor();

  const title = `NFR006 ${config.name} quiz ${suffix}`;
  await editor.getByLabel('Title').fill(title);
  await editor.getByLabel('Topic').fill('browser compatibility');
  await editor.getByRole('button', { name: 'Add question' }).click(clickOptions);
  const question = editor.getByRole('group', { name: 'Question 1' });
  await question.getByLabel('Question text').fill('Which result confirms this browser flow?');
  await question.getByLabel('Option 1', { exact: true }).fill('Pass');
  await question.getByLabel('Option 2', { exact: true }).fill('Fail');
  await question.getByLabel('Correct option').selectOption('0');
  await editor.getByRole('button', { name: 'Save draft' }).click(clickOptions);
  await page.getByRole('status').filter({ hasText: 'Quiz saved.' }).waitFor();
  const quizId = (await page.locator('.quiz-editor code').textContent()).trim();
  assert.match(quizId, /^[0-9a-f]{24}$/i, `${config.name}: created quiz ID`);

  await editor.getByLabel('Title').fill(`${title} edited`);
  await editor.getByRole('button', { name: 'Save changes' }).click(clickOptions);
  await page.getByRole('status').filter({ hasText: 'Quiz saved.' }).waitFor();
  await page.getByRole('button', { name: 'Publish' }).click(clickOptions);
  await page.getByRole('status').filter({ hasText: 'Quiz published.' }).waitFor();
  return quizId;
}

async function verifyAttemptAndLeaderboard(page, origin, fixture, quizId, clickOptions) {
  await page.goto(`${origin}/attempt`, { waitUntil: 'domcontentloaded' });
  await signIn(page, { email: fixture.users.student, password: fixture.password, button: 'Sign in' });
  await page.getByLabel('Published quiz ID').fill(quizId);
  await page.getByRole('button', { name: 'Open quiz' }).click(clickOptions);
  await page.locator('input[type="radio"]').first().check();
  await page.getByRole('button', { name: 'Submit attempt' }).click(clickOptions);
  await page.getByRole('heading', { name: 'Your results' }).waitFor();
  await page.getByText('1/1', { exact: true }).waitFor();

  await page.goto(`${origin}/leaderboard`, { waitUntil: 'domcontentloaded' });
  await signIn(page, { email: fixture.users.student, password: fixture.password, button: 'Sign in' });
  await page.getByLabel('Quiz ID').fill(quizId);
  await page.getByRole('button', { name: 'Show leaderboard' }).click(clickOptions);
  await page.getByRole('region', { name: 'Quiz leaderboard results' }).waitFor();
  await page.getByRole('cell', { name: 'SEC004 Student' }).waitFor();
  await page.getByRole('button', { name: 'Topic leaderboard' }).click(clickOptions);
  await page.getByLabel('Topic').fill('browser compatibility');
  await page.getByRole('button', { name: 'Show leaderboard' }).click(clickOptions);
  await page.getByRole('region', { name: 'Topic leaderboard results' }).waitFor();
}

async function verifyPasswordResetPages(page, origin, email, clickOptions) {
  await page.goto(`${origin}/forgot-password`, { waitUntil: 'domcontentloaded' });
  await page.getByLabel('Email address').fill(email);
  await page.getByRole('button', { name: 'Send reset link' }).click(clickOptions);
  await page.getByRole('status').waitFor();

  await page.goto(`${origin}/reset-password`, { waitUntil: 'domcontentloaded' });
  await page.getByLabel('New password', { exact: true }).fill('Browser5678');
  await page.getByLabel('Confirm new password').fill('Browser5678');
  await page.getByRole('button', { name: 'Reset password' }).click(clickOptions);
  await page.getByRole('alert').filter({ hasText: 'invalid or missing its token' }).waitFor();
}

async function smoke(config, origin, fixture) {
  let browser;
  try {
    browser = await config.engine.launch({ ...config.options, headless: true });
  } catch (error) {
    return { browser: config.name, result: 'UNAVAILABLE', reason: error.message.split('\n')[0] };
  }
  const browserProcess = browser._connection.toImpl(browser).options.browserProcess;
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  page.setDefaultTimeout(10000);
  const errors = [];
  const consoleErrors = [];
  const serverErrors = [];
  const clickOptions = config.name === 'Edge' && process.env.NFR006_EDGE_PATH ? { force: true } : {};
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    const location = message.location().url || '';
    if (message.type() === 'error' && !location.endsWith('/favicon.ico')) {
      consoleErrors.push(`${message.text()}${location ? ` (${location})` : ''}`);
    }
  });
  page.on('response', (response) => {
    if (response.status() >= 500) serverErrors.push(`HTTP ${response.status()} ${new URL(response.url()).pathname}`);
  });
  try {
    console.log(`Running ${config.name} ${browser.version()}`);
    await page.goto(origin, { waitUntil: 'domcontentloaded' });
    await page.getByRole('heading', { name: 'Collaborative Study Material & Quiz Platform' }).waitFor();
    await page.getByText('API and MongoDB are connected.').waitFor();
    const registeredEmail = await verifyRegistrationApi(page, config.name);
    const suffix = `${Date.now()}-${config.name.toLowerCase()}`;
    await verifyMaterials(page, config, origin, fixture, suffix, clickOptions);
    const quizId = await createAndPublishQuiz(page, config, origin, fixture, suffix, clickOptions);
    await verifyAttemptAndLeaderboard(page, origin, fixture, quizId, clickOptions);
    await verifyPasswordResetPages(page, origin, registeredEmail, clickOptions);

    assert.deepEqual(errors, [], `${config.name}: uncaught page errors`);
    assert.deepEqual(consoleErrors, [], `${config.name}: browser console errors`);
    assert.deepEqual(serverErrors, [], `${config.name}: server errors`);
    const screenshot = path.join(evidenceDir, `${config.name.toLowerCase()}.png`);
    await page.screenshot({ path: screenshot, fullPage: true });
    return { browser: config.name, version: browser.version(), result: 'PASS', checks: [
      'home and navigation', 'registration API and login validation',
      'material list/detail/upload/edit', 'quiz create/edit/publish',
      'student attempt and result', 'quiz and topic leaderboards',
      'forgot/reset-password pages', 'no page, console or HTTP 5xx errors',
    ], screenshot };
  } catch (error) {
    console.error(`${config.name}: ${error.message.split('\n')[0]}`);
    const screenshot = path.join(evidenceDir, `${config.name.toLowerCase()}-failure.png`);
    await page.screenshot({ path: screenshot, fullPage: true, timeout: 5000 }).catch(() => {});
    return { browser: config.name, version: browser.version(), result: 'FAIL', reason: error.message, screenshot };
  } finally {
    // Some branded browser builds keep background processes open after the
    // automation connection closes. Bound cleanup keeps CI deterministic.
    const closed = await Promise.race([
      browser.close().then(() => true),
      new Promise((resolve) => setTimeout(() => resolve(false), 5000)),
    ]);
    if (!closed) await browserProcess.kill();
  }
}

async function main() {
  await fs.mkdir(evidenceDir, { recursive: true });
  const port = await freePort();
  const origin = `http://127.0.0.1:${port}`;
  const fixture = await startFixture(origin);
  vite = spawn('npm', ['run', 'dev', '--workspace', 'client', '--', '--host', '127.0.0.1', '--port', String(port), '--strictPort'], {
    cwd: root,
    env: { ...process.env, DEV_API_TARGET: fixture.baseURL.replace(/\/api\/v1$/, '') },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  await waitFor(origin);
  const results = [];
  for (const config of browsers.filter(({ name }) => !process.env.NFR006_BROWSERS || process.env.NFR006_BROWSERS.split(',').includes(name))) {
    results.push(await smoke(config, origin, fixture));
  }
  await fs.writeFile(path.join(evidenceDir, 'results.json'), JSON.stringify(results, null, 2));
  console.log(JSON.stringify(results, null, 2));
  if (results.some((item) => item.result === 'FAIL'
    || (process.env.NFR006_REQUIRE_ALL === '1' && item.result !== 'PASS'))) process.exitCode = 1;
}

main().catch((error) => { console.error(error); process.exitCode = 1; }).finally(async () => {
  if (vite && vite.exitCode === null) vite.kill('SIGTERM');
  if (api && api.exitCode === null) api.kill('SIGTERM');
  // Vite/npm and branded browsers may retain background handles after their
  // disposable processes receive SIGTERM. The result and evidence are already
  // flushed at this point, so terminate the runner with its recorded status.
  await new Promise((resolve) => setTimeout(resolve, 500));
  process.exit(process.exitCode || 0);
});
