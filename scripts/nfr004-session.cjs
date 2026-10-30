'use strict';

// Starts a disposable, loopback-only NFR-004 usability session:
// real API + real React frontend + five student accounts + one DBMS quiz.
// Press Ctrl+C to stop and remove all temporary data.
const fs = require('node:fs/promises');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const {
  root,
  makeDisposablePassword,
  findFreePort,
  startFixture,
  startVite,
  stopProcess,
} = require('./nfr004-runtime.cjs');

const evidenceDir = path.join(root, 'test-results', 'nfr004');
const verifyOnly = process.argv.includes('--verify');
let fixtureProcess;
let viteProcess;
let shuttingDown = false;

async function shutdown(code = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  await stopProcess(viteProcess);
  await stopProcess(fixtureProcess);
  process.exit(code);
}

process.once('SIGINT', () => { shutdown(0).catch(() => process.exit(1)); });
process.once('SIGTERM', () => { shutdown(0).catch(() => process.exit(1)); });

async function request(baseURL, route, { method = 'GET', token, body } = {}) {
  const response = await fetch(`${baseURL}${route}`, {
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

async function verify(seed) {
  const health = await fetch(`${seed.baseURL}/health`, { signal: AbortSignal.timeout(10000) });
  if (health.status !== 200) throw new Error(`Health check returned ${health.status}.`);

  for (const participant of seed.participants) {
    const login = await request(seed.baseURL, '/auth/login', {
      method: 'POST',
      body: { email: participant.email, password: seed.password },
    });
    if (login.status !== 200 || !login.json.accessToken) {
      throw new Error(`Participant ${participant.id} could not sign in (HTTP ${login.status}).`);
    }
    const quiz = await request(seed.baseURL, `/quizzes/${seed.quiz.id}`, { token: login.json.accessToken });
    if (quiz.status !== 200 || quiz.json.id !== seed.quiz.id) {
      throw new Error(`Participant ${participant.id} could not load the DBMS quiz (HTTP ${quiz.status}).`);
    }
    if (seed.material) {
      const material = await request(seed.baseURL, `/materials/${seed.material.id}`, { token: login.json.accessToken });
      if (material.status !== 200) {
        throw new Error(`Participant ${participant.id} could not load the material fixture (HTTP ${material.status}).`);
      }
      const query = new URLSearchParams({
        topic: material.json.topic, status: 'published', page: '1', limit: '20',
      });
      const related = await request(seed.baseURL, `/quizzes?${query}`, { token: login.json.accessToken });
      if (related.status !== 200 || !Array.isArray(related.json.items)
        || !related.json.items.some((quiz) => quiz.id === seed.quiz.id)) {
        throw new Error(`Participant ${participant.id} could not find the DBMS quiz from the material topic (HTTP ${related.status}).`);
      }
    }
  }
}

async function main() {
  await fs.mkdir(evidenceDir, { recursive: true });
  const vitePort = await findFreePort();
  const origin = `http://127.0.0.1:${vitePort}`;
  const password = makeDisposablePassword();
  const fixture = await startFixture({ origin, password });
  fixtureProcess = fixture.proc;
  const seed = fixture.seed;
  const vite = await startVite({ apiBaseURL: seed.baseURL, port: vitePort });
  viteProcess = vite.proc;

  let commit = 'unknown';
  try {
    commit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
  } catch {
    // A source archive may not include Git metadata.
  }

  const environment = {
    timestamp: new Date().toISOString(),
    commit,
    appOrigin: origin,
    quiz: seed.quiz,
    participants: seed.participants,
    author: seed.author,
    admin: seed.admin,
    material: seed.material,
    password,
    isolation: 'Disposable MongoDB replica set, loopback-only API and Vite server; no project .env or shared database.',
  };
  const environmentPath = path.join(evidenceDir, 'session-environment.json');
  await fs.writeFile(environmentPath, JSON.stringify(environment, null, 2));

  if (verifyOnly) {
    await verify(seed);
    console.log(`NFR-004 VERIFY PASS: five accounts, quiz, material and frontend are ready. Evidence: ${environmentPath}`);
    await shutdown(0);
    return;
  }

  console.log('');
  console.log('NFR-004 moderated usability session is ready.');
  console.log(`App:      ${origin}`);
  console.log(`Start:    ${seed.material ? `${origin}/materials` : `${origin}/attempt`}`);
  console.log(`Material: ${seed.material?.title || 'not seeded'} (${seed.material?.url || 'n/a'})`);
  console.log(`Quiz:     ${seed.quiz.title}`);
  console.log(`Quiz link: ${seed.quiz.url}`);
  console.log(`Quiz ID:  ${seed.quiz.id} (fallback only)`);
  console.log(`Evidence: ${environmentPath}`);
  console.log('');
  console.log('Primary task: sign in, open the material, find the quiz under the topic, and attempt it.');
  console.log('');
  console.log('Participant accounts (disposable; use a fresh private window per person):');
  for (const participant of seed.participants) {
    console.log(`  ${participant.id}: ${participant.email}`);
  }
  console.log(`Password: ${password}`);
  console.log('');
  console.log('Observer reminder: read the task card, do not coach, and mark any assistance.');
  console.log('Keep this terminal open. Press Ctrl+C to stop and delete all temporary data.');
}

main().catch(async (error) => {
  console.error(`NFR-004 session failed: ${error.message}`);
  await shutdown(1);
});
