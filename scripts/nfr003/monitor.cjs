#!/usr/bin/env node
'use strict';
// NFR-003 / TC-AVL-01. One HTTPS GET per 30-second slot for 24 hours.
// Uses only Node.js built-ins. Does NOT create a deployment, modify data, or use application credentials.
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const { performance } = require('node:perf_hooks');
const { setTimeout: sleep } = require('node:timers/promises');

const FULL_COUNT = 2880;
const FULL_INTERVAL_MS = 30000;
const MIN_SUCCESS = 2852; // ceil(0.99 * 2880)
const TIMEOUT_MS = 5000;

function fail(message) { throw new Error(message); }
function parseArgs(argv) {
  const parsed = {};
  const flags = new Set(['--smoke']);
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    if (flags.has(k)) { parsed[k] = true; continue; }
    if (!['--url', '--approval-ref', '--start-at', '--output-dir', '--count', '--interval-ms'].includes(k)) {
      fail('Unknown argument ' + k);
    }
    if (!argv[i + 1] || argv[i + 1].startsWith('--')) fail('Missing value for ' + k);
    if (parsed[k] !== undefined) fail('Duplicate ' + k);
    parsed[k] = argv[++i];
  }
  const smoke = parsed['--smoke'] === true;
  if (!parsed['--url']) fail('Required: --url https://host/api/v1/health');
  let target;
  try { target = new URL(parsed['--url']); } catch { fail('Invalid URL'); }
  if (target.username || target.password || target.search || target.hash || target.pathname !== '/api/v1/health') {
    fail('URL must be a credential-free /api/v1/health endpoint with no query or fragment');
  }
  if (smoke) {
    if (!['http:', 'https:'].includes(target.protocol) || !['127.0.0.1', 'localhost', '[::1]'].includes(target.hostname)) {
      fail('Smoke mode is restricted to a local loopback health endpoint');
    }
    if (parsed['--approval-ref'] || parsed['--start-at']) fail('Smoke mode must not use faculty approval/start arguments');
  } else if (target.protocol !== 'https:') {
    fail('Full 24h acceptance requires HTTPS. Use --smoke ONLY for local testing.');
  }
  const count = smoke ? Number(parsed['--count'] ?? 4) : FULL_COUNT;
  const intervalMs = smoke ? Number(parsed['--interval-ms'] ?? 200) : FULL_INTERVAL_MS;
  if (!Number.isSafeInteger(count) || count < 1 || count > (smoke ? 20 : FULL_COUNT)) fail('Invalid count');
  if (!Number.isSafeInteger(intervalMs) || intervalMs < (smoke ? 50 : FULL_INTERVAL_MS) || intervalMs > FULL_INTERVAL_MS) fail('Invalid interval');
  if (!smoke && (parsed['--count'] || parsed['--interval-ms'])) fail('Acceptance count/interval cannot be overridden');
  let startAt;
  let approvalRef = null;
  if (smoke) {
    startAt = Date.now() + 100;
  } else {
    approvalRef = parsed['--approval-ref'];
    if (!approvalRef || !/^[\w .@:/#-]{3,160}$/.test(approvalRef)) {
      fail('Required --approval-ref (non-sensitive identifier of faculty approval, 3-160 characters)');
    }
    const v = parsed['--start-at'];
    if (!v || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,3})?Z$/.test(v)) {
      fail('Required --start-at in UTC ISO format, e.g. 2026-11-02T09:00:00Z');
    }
    startAt = Date.parse(v);
    if (!Number.isFinite(startAt) || new Date(startAt).toISOString().slice(0,19) !== v.slice(0,19)) fail('Invalid --start-at calendar timestamp');
    if (Date.now() - startAt > 5000) fail('Start time is over five seconds in the past; do not backdate an acceptance window');
    if (startAt - Date.now() > 7 * 86400000) fail('Start must be within the next seven days');
  }
  const outputDir = path.resolve(parsed['--output-dir'] || path.join('nfr-results', 'nfr003', new Date().toISOString().replace(/[:.]/g, '-')));
  return { smoke, count, intervalMs, startAt, approvalRef, outputDir, target: target.toString() };
}

async function probe(url) {
  const began = performance.now();
  try {
    const response = await fetch(url, { method: 'GET', cache: 'no-store', redirect: 'manual', signal: AbortSignal.timeout(TIMEOUT_MS) });
    if (response.status !== 200) return { ok: false, status: response.status, reason: 'HTTP_' + response.status, latency_ms: Math.round(performance.now() - began) };
    let json;
    try { json = await response.json(); } catch { return { ok: false, status: response.status, reason: 'INVALID_JSON', latency_ms: Math.round(performance.now() - began) }; }
    const ok = json?.status === 'ok' && json?.checks?.process === 'up' && json?.checks?.database === 'connected';
    return { ok, status: response.status, reason: ok ? 'HEALTHY' : 'UNHEALTHY_BODY', latency_ms: Math.round(performance.now() - began) };
  } catch (error) {
    return { ok: false, status: null, reason: error?.name === 'TimeoutError' ? 'TIMEOUT' : 'NETWORK_OR_TLS_ERROR', latency_ms: Math.round(performance.now() - began) };
  }
}

async function main() {
  const config = parseArgs(process.argv.slice(2));
  await fsp.mkdir(config.outputDir, { recursive: true });
  const jsonl = path.join(config.outputDir, 'probes.jsonl');
  const summaryPath = path.join(config.outputDir, 'summary.json');
  // Exclusive create prevents accidental overwrite of existing evidence.
  const file = fs.createWriteStream(jsonl, { flags: 'wx' });
  const hash = crypto.createHash('sha256');
  let successes = 0;
  let recorded = 0;
  let interrupted = false;
  const signalHandler = () => { interrupted = true; };
  process.on('SIGINT', signalHandler);
  process.on('SIGTERM', signalHandler);
  const startMonotonic = performance.now() + Math.max(0, config.startAt - Date.now());
  let firstSampleMs = null;
  console.log(`${config.smoke ? 'SMOKE' : 'ACCEPTANCE'} NFR-003 scheduled start ${new Date(config.startAt).toISOString()} count ${config.count} interval ${config.intervalMs}ms`);
  try {
    for (let i = 0; i < config.count; i++) {
      if (interrupted) break;
      const planned = startMonotonic + i * config.intervalMs;
      const wait = planned - performance.now();
      if (wait > 0) await sleep(wait);
      if (interrupted) break;
      const latenessMs = performance.now() - planned;
      const record = {
        index: i + 1,
        scheduled_at_utc: new Date(config.startAt + i * config.intervalMs).toISOString(),
        observed_at_utc: new Date().toISOString(),
        ...((latenessMs > Math.max(500, Math.min(5000, config.intervalMs * 0.5)))
          ? { ok: false, status: null, reason: 'MISSED_SCHEDULED_SLOT', latency_ms: null }
          : await probe(config.target)),
      };
      if (firstSampleMs === null) firstSampleMs = Date.now();
      const line = JSON.stringify(record) + '\n';
      if (!file.write(line)) await new Promise(resolve => file.once('drain', resolve));
      hash.update(line);
      recorded++;
      if (record.ok) successes++;
      if (config.smoke || (i + 1) % 60 === 0) console.log(`NFR-003 ${recorded}/${config.count}, healthy=${successes}, last=${record.reason}`);
    }
    // The 2880 slots cover [start, start+24h); wait until the window actually ends.
    if (!config.smoke && !interrupted) {
      const remaining = startMonotonic + FULL_COUNT * FULL_INTERVAL_MS - performance.now();
      if (remaining > 0) await sleep(remaining);
    }
  } finally {
    await new Promise((resolve, reject) => { file.once('error', reject); file.end(resolve); });
    process.off('SIGINT', signalHandler);
    process.off('SIGTERM', signalHandler);
  }
  const endedAtMs = Date.now();
  const completeWindow = !config.smoke && !interrupted && recorded === FULL_COUNT && endedAtMs >= config.startAt + 86400000;
  const pass = config.smoke ? recorded === config.count && successes === config.count
    : completeWindow && successes >= MIN_SUCCESS;
  const summary = {
    test: 'TC-AVL-01', mode: config.smoke ? 'SMOKE_NOT_ACCEPTANCE' : '24H_ACCEPTANCE',
    target: config.target, faculty_approval_reference: config.approvalRef,
    scheduled_start_utc: new Date(config.startAt).toISOString(),
    scheduled_end_utc: new Date(config.startAt + config.count * config.intervalMs).toISOString(),
    recorded_end_utc: new Date(endedAtMs).toISOString(),
    interval_seconds: config.intervalMs / 1000, expected_probes: config.count,
    observed_probes: recorded, healthy: successes, failed: recorded - successes,
    missing_probes: config.count - recorded,
    availability_percent: Number((100 * successes / config.count).toFixed(4)),
    min_successes_for_99_percent: config.smoke ? null : MIN_SUCCESS,
    complete_window: completeWindow, interrupted,
    status: config.smoke ? (pass ? 'SMOKE_PASS_NOT_ACCEPTANCE' : 'SMOKE_FAIL') : (pass ? 'PASS' : 'FAIL'),
    evidence_sha256: hash.digest('hex'),
    notes: config.smoke ? 'Short CI/local validation. It is NOT 24-hour evidence.' : 'No retries. One sample per scheduled 30-second slot; missing slots count as failures.',
  };
  await fsp.writeFile(summaryPath, JSON.stringify(summary, null, 2) + '\n', { flag: 'wx' });
  console.log(`NFR-003 ${summary.status}: ${successes}/${config.count} healthy; ${summary.availability_percent}%`);
  console.log(`Evidence: ${config.outputDir}`);
  if (!pass) process.exitCode = 1;
}

main().catch(error => {
  console.error('NFR-003 ERROR: ' + error.message);
  process.exitCode = 1;
});
