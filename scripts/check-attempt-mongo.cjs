// Isolated real MongoDB integration check; never mounts test identities in index.js.
// Requires local/development MongoDB, not a production credential.
const assert = require('node:assert/strict');
const { randomBytes } = require('node:crypto');
const mongoose = require('mongoose');
const request = require('supertest');
const { createApp } = require('../server/src/app');
const { createAttemptRepository } = require('../server/src/modules/attempts/attempt.repo');
const { getAttemptModel } = require('../server/src/modules/attempts/attempt.model');
async function runMongoCheck(uri) {
  if (!uri || !/^mongodb(\+srv)?:\/\//.test(uri)) throw new Error('Set ATTEMPT_TEST_MONGODB_URI to a local/development MongoDB URI.');
  // Always override database name. Only this newly generated database is dropped.
  const dbName = `team1_attempt_test_${randomBytes(12).toString('hex')}`;
  const connection = await mongoose.createConnection(uri, { dbName, serverSelectionTimeoutMS: 10000 }).asPromise();
  const passed = [];
  try {
    const quizId = new mongoose.Types.ObjectId();
    const studentId = new mongoose.Types.ObjectId();
    const quizzes = connection.collection('quizzes');
    const model = getAttemptModel(connection);
    await quizzes.insertOne({ _id: quizId, status: 'published', allowRetake: false, questions: [
      { _id: 'q1', type: 'mcq', options: ['A', 'B', 'C'], answerKey: 2 },
      { _id: 'q2', type: 'true_false', answerKey: false },
      { _id: 'q3', type: 'mcq', options: ['A', 'B'], answerKey: 1 },
    ] });
    function appFor(id, role = 'student') {
      return createApp({ attempts: {
        repository: createAttemptRepository({ connection }),
        authenticate(req, res, next) { req.auth = { userId: String(id), role, contributor: false }; next(); },
      } });
    }
    const appA = appFor(studentId);
    const appB = appFor(studentId); // independent repository/Express instance, same DB
    const url = `/api/v1/quizzes/${quizId}/attempts`;
    const payload = { answers: [{ questionId: 'q1', response: 2 }, { questionId: 'q2', response: true }], score: 99 };
    const responses = await Promise.all(Array.from({ length: 6 }, (_, i) => request(i % 2 ? appA : appB).post(url).send(payload)));
    assert.equal(responses.filter((res) => res.status === 201).length, 1);
    assert.equal(responses.filter((res) => res.status === 409 && res.body.error.code === 'RETAKE_NOT_ALLOWED').length, 5);
    assert.equal(await model.countDocuments({ quizId, studentId }), 1);
    const created = responses.find((res) => res.status === 201);
    assert.equal(created.body.score, 1); assert.equal(created.body.maxScore, 3);
    assert.equal(created.body.percentage, 33.3); assert.equal(created.body.results[2].unanswered, true);
    passed.push('Six simultaneous no-retake submissions across two app instances: one 201, five 409, exactly one stored attempt.');
    let stored = await model.findById(created.body.attemptId).lean();
    assert.equal(stored.score, 1); assert.equal(stored.answers[0].correctAnswer, 2);
    assert.equal(String(stored.studentId), String(studentId));
    assert.equal(stored.answers[2].response, null);
    passed.push('Acknowledged MongoDB persistence stores authoritative scores, identity and historical answer/result snapshots.');
    await quizzes.updateOne({ _id: quizId }, { $set: { allowRetake: true, 'questions.0.answerKey': 0 } });
    const retakes = await Promise.all([request(appA).post(url).send(payload), request(appB).post(url).send(payload)]);
    assert.deepEqual(retakes.map((res) => res.status), [201, 201]);
    assert.equal(await model.countDocuments({ quizId, studentId }), 3);
    assert.equal(retakes[0].body.score, 0);
    stored = await model.findById(created.body.attemptId).lean();
    assert.equal(stored.score, 1); assert.equal(stored.answers[0].correctAnswer, 2);
    passed.push('Retakes remain allowed when enabled; changing quiz answer keys does not rewrite old attempt results.');
    await quizzes.updateOne({ _id: quizId }, { $set: { allowRetake: false } });
    assert.equal((await request(appA).post(url).send(payload)).status, 409);
    passed.push('Disabling retakes after earlier unrestricted attempts still rejects another submission.');
    const otherId = new mongoose.Types.ObjectId();
    const other = appFor(otherId);
    assert.equal((await request(other).post(url).send({ answers: [{ questionId: 'unknown', response: 0 }] })).status, 400);
    assert.equal((await request(other).post(url).send({ answers: [{ questionId: 'q2', response: 3 }] })).status, 400);
    assert.equal(await model.countDocuments({ studentId: otherId }), 0);
    passed.push('Unknown questions and wrong response types return 400 without storing an attempt.');
    for (const status of ['draft', 'unpublished']) {
      await quizzes.updateOne({ _id: quizId }, { $set: { status } });
      assert.equal((await request(other).post(url).send(payload)).status, 404);
    }
    assert.equal((await request(other).post(`/api/v1/quizzes/${new mongoose.Types.ObjectId()}/attempts`).send(payload)).status, 404);
    assert.equal(await model.countDocuments({ studentId: otherId }), 0);
    passed.push('Draft, unpublished and missing quizzes return 404 and create no attempts.');
    for (const role of ['educator', 'administrator']) assert.equal((await request(appFor(otherId, role)).post(url).send(payload)).status, 403);
    assert.equal((await request(createApp()).post(url).set('Authorization', 'Bearer forged').send(payload)).status, 401);
    passed.push('Role restrictions and default fail-closed authentication verified (real token integration is NOT tested).');
    const checkConnection = await mongoose.createConnection(uri, { dbName, serverSelectionTimeoutMS: 10000 }).asPromise();
    try {
      assert.equal((await checkConnection.collection('attempts').findOne({ _id: new mongoose.Types.ObjectId(created.body.attemptId) })).score, 1);
    } finally { await checkConnection.close(); }
    passed.push('Stored attempt readable through a fresh independent database connection (not a container-restart reliability test).');
    console.log(passed.map((message) => `PASS: ${message}`).join('\n'));
    console.log('LIMITATION: this database harness does not test real JWT authentication or the browser. Complete real auth/quiz-route integration separately.');
    return passed;
  } finally {
    try { await connection.dropDatabase(); } finally { await connection.close(); }
  }
}
if (require.main === module) runMongoCheck(process.env.ATTEMPT_TEST_MONGODB_URI).catch(() => {
  console.error('Attempt MongoDB integration check failed. Verify the local test DB, permissions and feature contracts. URI/credentials are not printed.');
  process.exitCode = 1;
});
module.exports = { runMongoCheck };
