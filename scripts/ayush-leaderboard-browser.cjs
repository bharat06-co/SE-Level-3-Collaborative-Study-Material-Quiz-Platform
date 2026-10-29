'use strict';

// TC-LB-09 against the real React app, Express auth and a disposable MongoDB.
// Install the temporary runner with npm install --no-save --package-lock=false playwright@1.56.1.
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const net = require('node:net');
const path = require('node:path');
const { spawn } = require('node:child_process');
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const { MongoMemoryReplSet } = require('mongodb-memory-server');
const { chromium } = require('playwright');
const { createApp } = require('../server/src/app');
const { createAuthenticatedFeatures } = require('../server/src/config/features');
const User = require('../server/src/models/User');
const { Quiz } = require('../server/src/modules/quizzes/quiz.model');
const { getAttemptModel } = require('../server/src/modules/attempts/attempt.model');

const root = path.resolve(__dirname, '..');
const results = path.join(root, 'test-results', 'leaderboard');
let mongo;
let apiServer;
let vite;
let browser;

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
  for (let i = 0; i < 100; i += 1) {
    try {
      if ((await fetch(url, { signal: AbortSignal.timeout(2000) })).status === 200) return;
    } catch { /* Server is starting. */ }
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
  throw new Error(`App did not start: ${url}`);
}

async function main() {
  await fs.mkdir(results, { recursive: true });
  mongo = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  process.env.MONGODB_URI = mongo.getUri();
  process.env.JWT_ACCESS_SECRET = 'leaderboard-browser-secret-'.repeat(4);
  process.env.JWT_ACCESS_TTL = '15m';
  await mongoose.connect(mongo.getUri(), { serverSelectionTimeoutMS: 15000 });
  const password = 'Study1234';
  const passwordHash = await bcrypt.hash(password, 10);
  const users = await User.create(['Alice', 'Bob', 'Charlie'].map((name) => ({
    name, email: `${name.toLowerCase()}-browser@example.test`, passwordHash, role: 'student',
  })));
  const author = await User.create({
    name: 'Educator', email: 'educator-browser@example.test', passwordHash, role: 'educator',
  });
  const question = [{ text: 'Choose B', type: 'mcq', options: ['A', 'B'], answerKey: 1 }];
  const [first, second] = await Quiz.create([
    { title: 'First database quiz', topic: 'DBMS', authorId: author._id, status: 'published', questions: question },
    { title: 'Second database quiz', topic: 'dbms', authorId: author._id, status: 'published', questions: question },
  ]);
  const Attempt = getAttemptModel();
  const rows = [
    [first, users[0], 5], [first, users[0], 8], [first, users[1], 8], [first, users[2], 6],
    [second, users[0], 6], [second, users[1], 2],
  ];
  await Attempt.create(rows.map(([quiz, user, score], index) => ({
    quizId: quiz._id, studentId: user._id, answers: [], score, maxScore: 10,
    submittedAt: new Date(Date.UTC(2026, 9, 29, 0, index)),
  })));

  const vitePort = await freePort();
  const app = createApp({ ...createAuthenticatedFeatures(), origins: [`http://127.0.0.1:${vitePort}`] });
  apiServer = await new Promise((resolve) => {
    const server = app.listen(0, '127.0.0.1', () => resolve(server));
  });
  const apiPort = apiServer.address().port;
  vite = spawn('npm', ['run', 'dev', '--workspace', 'client', '--', '--host', '127.0.0.1', '--port', String(vitePort), '--strictPort'], {
    cwd: root,
    env: { ...process.env, DEV_API_TARGET: `http://127.0.0.1:${apiPort}` },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  await waitFor(`http://127.0.0.1:${vitePort}/`);
  browser = await chromium.launch({ channel: 'chrome', headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 850 } });
  page.on('response', (response) => {
    if (response.status() >= 400) console.error(`HTTP ${response.status()} ${new URL(response.url()).pathname}`);
  });
  await page.goto(`http://127.0.0.1:${vitePort}/leaderboard`, { waitUntil: 'domcontentloaded' });
  await page.getByLabel('Email').fill('alice-browser@example.test');
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.getByLabel('Quiz ID').waitFor({ timeout: 10000 }).catch(async (error) => {
    console.error((await page.locator('body').innerText()).slice(0, 1500));
    await page.screenshot({ path: path.join(results, 'login-failure.png') });
    throw error;
  });
  await page.getByLabel('Quiz ID').fill(String(first._id));
  await page.getByRole('button', { name: 'Show leaderboard' }).click();
  await page.getByRole('region', { name: 'Quiz leaderboard results' }).locator('tbody tr').first().waitFor();
  const quizRows = (await page.getByRole('region', { name: 'Quiz leaderboard results' }).locator('tbody tr').allTextContents())
    .map((row) => row.replace(/\s+/g, ''));
  assert.equal(quizRows.length, 3);
  assert.ok(quizRows[0].includes('1Alice8'));
  assert.ok(quizRows[1].includes('1Bob8'));
  assert.ok(quizRows[2].includes('3Charlie6'));

  await page.getByRole('button', { name: 'Topic leaderboard' }).click();
  await page.getByLabel('Topic').fill('dBmS');
  await page.getByRole('button', { name: 'Show leaderboard' }).click();
  await page.getByRole('region', { name: 'Topic leaderboard results' }).locator('tbody tr').first().waitFor();
  const topicRows = (await page.getByRole('region', { name: 'Topic leaderboard results' }).locator('tbody tr').allTextContents())
    .map((row) => row.replace(/\s+/g, ''));
  assert.equal(topicRows.length, 3);
  assert.ok(topicRows[0].includes('1Alice140'));
  assert.ok(topicRows[1].includes('2Bob100'));
  assert.ok(topicRows[2].includes('3Charlie60'));
  const screenshot = path.join(results, 'chrome-quiz-and-topic.png');
  await page.screenshot({ path: screenshot, fullPage: true });
  console.log(JSON.stringify({ result: 'PASS', case: 'TC-LB-09', browser: browser.version(), screenshot }));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
}).finally(async () => {
  if (browser) await browser.close();
  if (vite && vite.exitCode === null) vite.kill('SIGTERM');
  if (apiServer) await new Promise((resolve) => apiServer.close(resolve));
  if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
  if (mongo) await mongo.stop();
});
