'use strict';
// NFR-007: real HTTP 201s, 100 concurrent submissions and post-API-restart reads.
// ONLY the isolated compose.acceptance.yaml MongoDB may be used.
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const mongoose = require('/app/node_modules/mongoose');

const uri = process.env.MONGODB_URI;
const api = process.env.NFR_API_URL || 'http://api:3000';
const dbName = 'team1_nfr_acceptance';
if (uri !== `mongodb://mongo:27017/${dbName}?replicaSet=rs0` || api !== 'http://api:3000') {
  throw new Error('Refusing to run outside the dedicated NFR acceptance Docker network/database.');
}
const phase = process.argv[2];
if (!['prepare', 'verify'].includes(phase)) throw new Error('Specify prepare or verify.');

async function json(method, path, payload, token) {
  const response = await fetch(`${api}${path}`, {
    method,
    headers: { ...(payload ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    ...(payload ? { body: JSON.stringify(payload) } : {}),
    signal: AbortSignal.timeout(120000),
  });
  let body;
  try { body = await response.json(); } catch { body = {}; }
  return { status: response.status, body };
}
async function ready() {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      const response = await json('GET', '/api/v1/health');
      if (response.status === 200 && response.body.checks?.database === 'connected') return;
    } catch { /* restart window */ }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error('API did not become healthy after 60 checks.');
}
async function login(email, password) {
  const response = await json('POST', '/api/v1/auth/login', { email, password });
  assert.equal(response.status, 200, 'Real API login must succeed');
  assert.equal(typeof response.body.accessToken, 'string');
  return response.body.accessToken;
}
async function main() {
  await ready();
  const conn = await mongoose.createConnection(uri, { serverSelectionTimeoutMS: 20000 }).asPromise();
  try {
    const db = conn.db;
    const markers = db.collection('nfr_acceptance_markers');
    const existing = await markers.findOne({ _id: 'nfr007' });
    if (phase === 'prepare') {
      assert.equal(existing, null, 'A prior run exists: use a fresh Compose project or docker compose down -v for this test project only.');
      const runId = randomUUID().replace(/-/g, '');
      const email = `nfr-${runId}@example.test`;
      const password = 'NfrOnlyDisposable2026!'; // dedicated disposable test database only
      const user = await json('POST', '/api/v1/auth/register', { name: 'NFR Validation Student', email, password });
      assert.equal(user.status, 201, 'Real registration must succeed');
      const token = await login(email, password);
      const student = await db.collection('users').findOne({ email });
      assert.ok(student?._id, 'Registered student must be persisted');
      const quizId = new mongoose.Types.ObjectId();
      const questionId = new mongoose.Types.ObjectId();
      await db.collection('quizzes').insertOne({
        _id: quizId, title: 'NFR isolated verification quiz', topic: 'nfr-verification',
        authorId: new mongoose.Types.ObjectId(), status: 'published', allowRetake: true,
        questions: [{ _id: questionId, text: 'Is a passing test reproducible?', type: 'true_false', answerKey: true }],
        createdAt: new Date(), updatedAt: new Date(), __v: 0,
      });
      const url = `/api/v1/quizzes/${quizId}/attempts`;
      const payload = { answers: [{ questionId: String(questionId), response: true }] };
      const initial = await json('POST', url, payload, token);
      assert.equal(initial.status, 201, 'Initial acknowledged attempt must be HTTP 201');
      assert.equal(initial.body.score, 1);
      const parallel = await Promise.all(Array.from({ length: 100 }, () => json('POST', url, payload, token)));
      const statuses = parallel.reduce((counts, item) => { counts[item.status] = (counts[item.status] || 0) + 1; return counts; }, {});
      assert.equal(statuses[201], 100, `Exactly 100 parallel submissions must return 201; statuses: ${JSON.stringify(statuses)}`);
      assert.equal(Object.keys(statuses).length, 1, 'No failed parallel requests allowed');
      const batchIds = parallel.map((item) => item.body.attemptId);
      assert.equal(new Set(batchIds).size, 100, '100 distinct attempt IDs expected');
      const batchCount = await db.collection('attempts').countDocuments({ _id: { $in: batchIds.map((id) => new mongoose.Types.ObjectId(id)) } });
      assert.equal(batchCount, 100, 'Exactly 100 concurrently submitted records must be stored');
      assert.equal(await db.collection('attempts').countDocuments({ studentId: student._id, quizId }), 101, 'One baseline plus 100 concurrent records expected');
      await markers.insertOne({ _id: 'nfr007', email, studentId: student._id, quizId,
        firstAttemptId: new mongoose.Types.ObjectId(initial.body.attemptId), batchIds: batchIds.map((id) => new mongoose.Types.ObjectId(id)),
        createdAt: new Date() });
      console.log(JSON.stringify({ phase, checkedAt: new Date().toISOString(), http201: 101, parallel201: 100, parallelStored: batchCount, total: 101, testDatabase: dbName }));
      console.log(`NFR_QUIZ_ID=${quizId}`);
      console.log('NEXT: restart only the acceptance API container, then run verify.');
    } else {
      assert.ok(existing, 'Prepare phase evidence marker was not found after API restart');
      const stored = await db.collection('attempts').findOne({ _id: existing.firstAttemptId });
      assert.ok(stored, 'Acknowledged 201 attempt must survive the API container restart');
      assert.equal(stored.score, 1);
      assert.equal(String(stored.studentId), String(existing.studentId));
      assert.equal(await db.collection('attempts').countDocuments({ _id: { $in: existing.batchIds } }), 100);
      assert.equal(await db.collection('attempts').countDocuments({ studentId: existing.studentId, quizId: existing.quizId }), 101);
      const token = await login(existing.email, 'NfrOnlyDisposable2026!');
      const history = await json('GET', '/api/v1/attempts/me', undefined, token);
      assert.equal(history.status, 200, 'History must be readable via restarted API');
      assert.equal(history.body.items.length, 101, 'History must include all acknowledged attempts');
      assert.ok(history.body.items.some((item) => item.id === String(existing.firstAttemptId)), 'First attempt must be present in history');
      const progress = await json('GET', '/api/v1/analytics/me/progress', undefined, token);
      assert.equal(progress.status, 200);
      assert.equal(progress.body.timeline.length, 101);
      console.log(JSON.stringify({ phase, checkedAt: new Date().toISOString(), first201Persisted: true, batchPersisted: 100,
        afterRestartHistory: history.body.items.length, afterRestartTimeline: progress.body.timeline.length, testDatabase: dbName }));
      console.log(`NFR_QUIZ_ID=${existing.quizId}`);
      console.log('PASS NFR-007: API restart persisted a 201 attempt; 100 parallel valid 201s created exactly 100 records.');
    }
  } finally { await conn.close(); }
}
main().catch((error) => { console.error(`FAIL NFR-007 ${phase}: ${error.message}`); process.exitCode = 1; });
