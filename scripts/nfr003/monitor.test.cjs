'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const { promisify } = require('node:util');
const { execFile } = require('node:child_process');
const run = promisify(execFile);
const script = path.resolve(__dirname, 'monitor.cjs');
const healthy = JSON.stringify({ status: 'ok', checks: { process: 'up', database: 'connected' } });

async function fixture(fn, testFn) {
  const server = http.createServer(fn);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'nfr003-test-'));
  const url = `http://127.0.0.1:${server.address().port}/api/v1/health`;
  try { return await testFn(url, dir); }
  finally { await new Promise(resolve => server.close(resolve)); await fs.rm(dir, { recursive: true, force: true }); }
}

test('smoke records healthy responses but NEVER claims 24h acceptance', async () => {
  await fixture((_req, res) => { void _req; res.setHeader('Content-Type', 'application/json'); res.end(healthy); }, async (url, dir) => {
    const { stdout } = await run(process.execPath, [script, '--smoke', '--url', url, '--count', '4', '--interval-ms', '100', '--output-dir', dir]);
    assert.match(stdout, /SMOKE_PASS_NOT_ACCEPTANCE/);
    const s = JSON.parse(await fs.readFile(path.join(dir, 'summary.json'), 'utf8'));
    assert.equal(s.observed_probes, 4);
    assert.equal(s.healthy, 4);
    assert.equal(s.complete_window, false);
    assert.equal(s.status, 'SMOKE_PASS_NOT_ACCEPTANCE');
    assert.equal((await fs.readFile(path.join(dir, 'probes.jsonl'), 'utf8')).trim().split('\n').length, 4);
  });
});

test('failed HTTP and unhealthy JSON are counted as failed probes', async () => {
  let calls = 0;
  await fixture((_req, res) => { void _req; calls++; res.setHeader('Content-Type', 'application/json'); if(calls === 2){res.statusCode=503;res.end('{}');} else if(calls === 3){res.end('{"status":"ok"}');}else res.end(healthy); }, async (url, dir) => {
    await assert.rejects(run(process.execPath, [script, '--smoke', '--url', url, '--count', '4', '--interval-ms', '100', '--output-dir', dir]));
    const s = JSON.parse(await fs.readFile(path.join(dir, 'summary.json'), 'utf8'));
    assert.equal(s.healthy, 2);
    assert.equal(s.failed, 2);
    assert.equal(s.status, 'SMOKE_FAIL');
  });
});

test('cannot claim 24-hour acceptance from a short insecure run', async () => {
  await fixture((_req, res) => { void _req; res.end(healthy); }, async (url, dir) => {
    await assert.rejects(run(process.execPath, [script, '--url', url, '--approval-ref', 'faculty-approved', '--start-at', '2026-11-01T09:00:00Z', '--output-dir', dir]), /HTTPS|start/i);
    await assert.rejects(run(process.execPath, [script, '--smoke', '--url', url, '--approval-ref', 'faculty-approved', '--output-dir', dir]), /Smoke mode/i);
  });
});
