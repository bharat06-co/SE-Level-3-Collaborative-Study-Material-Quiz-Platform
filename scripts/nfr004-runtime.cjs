'use strict';

// Shared process helpers for the disposable NFR-004 session and browser check.
// Everything binds to loopback and uses only a temporary MongoDB replica set.
const crypto = require('node:crypto');
const net = require('node:net');
const path = require('node:path');
const { spawn } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const startupTimeoutMs = 120000;

function makeDisposablePassword() {
  return `Study${crypto.randomBytes(5).toString('hex')}`;
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
  const deadline = Date.now() + startupTimeoutMs;
  while (Date.now() < deadline) {
    if (proc.exitCode !== null || proc.signalCode !== null) {
      throw new Error(`${label} stopped before becoming ready.`);
    }
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(3000) });
      if (response.status === 200) return;
    } catch {
      // Service is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`${label} did not respond within ${startupTimeoutMs / 1000} seconds.`);
}

function startFixture({ origin, password, includeMaterial = true } = {}) {
  if (!/^http:\/\/127\.0\.0\.1:[1-9]\d{1,4}$/.test(origin || '')) {
    throw new Error('NFR-004 fixture requires a loopback frontend origin.');
  }
  if (typeof password !== 'string' || password.length < 8) {
    throw new Error('NFR-004 fixture requires a disposable password.');
  }

  return new Promise((resolve, reject) => {
    let settled = false;
    let output = '';
    let errors = '';
    const timer = setTimeout(() => {
      fail(new Error(`Disposable API startup timed out. ${errors.slice(-1200)}`));
    }, startupTimeoutMs);

    function fail(error) {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(error);
    }

    const proc = spawn(process.execPath, [path.join(root, 'scripts/nfr004-fixture-server.cjs')], {
      cwd: root,
      env: {
        ...process.env,
        NODE_ENV: 'test',
        MONGODB_URI: '',
        JWT_ACCESS_SECRET: '',
        NFR004_FRONTEND_ORIGIN: origin,
        NFR004_PASSWORD: password,
        NFR004_INCLUDE_MATERIAL: includeMaterial ? '1' : '0',
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    proc.stdout.setEncoding('utf8');
    proc.stderr.setEncoding('utf8');
    proc.stderr.on('data', (chunk) => { errors += chunk; });
    proc.stdout.on('data', (chunk) => {
      output += chunk;
      const line = output.split('\n').find((entry) => entry.startsWith('NFR004_READY '));
      if (!line || settled) return;
      try {
        const seed = JSON.parse(line.slice('NFR004_READY '.length));
        if (!/^http:\/\/127\.0\.0\.1:\d+\/api\/v1$/.test(seed.baseURL)) {
          throw new Error('Refusing a non-loopback fixture API URL.');
        }
        if (seed.origin !== origin) throw new Error('Fixture origin mismatch.');
        settled = true;
        clearTimeout(timer);
        resolve({ proc, seed });
      } catch (error) {
        fail(error);
      }
    });
    proc.on('error', fail);
    proc.on('exit', (code) => {
      fail(new Error(`Disposable API stopped early (${code}). ${errors.slice(-1200)}`));
    });
  });
}

async function startVite({ apiBaseURL, port }) {
  const origin = `http://127.0.0.1:${port}`;
  if (!/^http:\/\/127\.0\.0\.1:\d+\/api\/v1$/.test(apiBaseURL || '')) {
    throw new Error('Vite requires a loopback fixture API URL.');
  }
  const proc = spawn(process.platform === 'win32' ? 'npm.cmd' : 'npm', [
    'run', 'dev', '--workspace', 'client', '--', '--host', '127.0.0.1', '--port', String(port),
  ], {
    cwd: root,
    env: {
      ...process.env,
      DEV_API_TARGET: apiBaseURL.replace(/\/api\/v1$/, ''),
      NODE_ENV: 'test',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  await waitForHttp(origin, proc, 'Vite frontend');
  return { proc, origin };
}

async function stopProcess(proc) {
  if (!proc || proc.exitCode !== null || proc.signalCode !== null) return;
  proc.kill('SIGTERM');
  await Promise.race([
    new Promise((resolve) => proc.once('exit', resolve)),
    new Promise((resolve) => setTimeout(resolve, 10000)),
  ]);
  if (proc.exitCode === null && proc.signalCode === null) proc.kill('SIGKILL');
}

module.exports = {
  root,
  makeDisposablePassword,
  findFreePort,
  waitForHttp,
  startFixture,
  startVite,
  stopProcess,
};
