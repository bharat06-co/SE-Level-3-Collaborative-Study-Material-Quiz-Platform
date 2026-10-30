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
  const clickOptions = config.name === 'Edge' && process.env.NFR006_EDGE_PATH ? { force: true } : {};
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('response', (response) => {
    if (response.status() >= 400) console.error(`${config.name}: HTTP ${response.status()} ${new URL(response.url()).pathname}`);
  });
  try {
    console.log(`Running ${config.name} ${browser.version()}`);
    await page.goto(origin, { waitUntil: 'domcontentloaded' });
    await page.getByRole('heading', { name: 'Collaborative Study Material & Quiz Platform' }).waitFor();
    await page.getByText('API and MongoDB are connected.').waitFor();
    console.log(`${config.name}: home ready`);

    await page.getByRole('link', { name: 'Browse study materials' }).click(clickOptions);
    await page.getByRole('heading', { name: 'Sign in to browse materials' }).waitFor();
    console.log(`${config.name}: material sign-in shown`);
    await page.getByLabel('Email').fill(fixture.users.student);
    await page.getByLabel('Password').fill(fixture.password);
    await page.getByRole('button', { name: 'Sign in' }).click(clickOptions);
    console.log(`${config.name}: material sign-in submitted`);
    await page.getByRole('link', { name: fixture.materials.library.title }).waitFor();
    await page.getByRole('link', { name: fixture.materials.library.title }).click(clickOptions);
    await page.getByRole('heading', { name: fixture.materials.library.title }).waitFor();
    await page.getByRole('heading', { name: 'Comments' }).waitFor();
    console.log(`${config.name}: material ready`);

    await page.goto(`${origin}/quizzes`, { waitUntil: 'domcontentloaded' });
    await page.getByRole('heading', { name: 'Quiz authoring' }).waitFor();
    await page.getByLabel('Email').fill(fixture.users.owner);
    await page.getByLabel('Password').fill(fixture.password);
    await page.getByRole('button', { name: 'Sign in to author quizzes' }).click(clickOptions);
    await page.getByRole('button', { name: 'New quiz' }).waitFor();
    await page.getByRole('form', { name: 'Quiz editor' }).waitFor();
    console.log(`${config.name}: quiz editor ready`);
    assert.deepEqual(errors, [], `${config.name}: uncaught page errors`);
    const screenshot = path.join(evidenceDir, `${config.name.toLowerCase()}.png`);
    await page.screenshot({ path: screenshot, fullPage: true });
    return { browser: config.name, version: browser.version(), result: 'PASS', checks: [
      'home health', 'material sign-in/list/detail', 'quiz author sign-in/editor', 'no page errors',
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
