const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryReplSet } = require('mongodb-memory-server');
const { createApp } = require('../src/app');
const { createAuthenticatedFeatures } = require('../src/config/features');
const User = require('../src/models/User');
const RefreshToken = require('../src/models/RefreshToken');
const { Quiz } = require('../src/modules/quizzes/quiz.model');
const { getAttemptModel } = require('../src/modules/attempts/attempt.model');

jest.setTimeout(120000);

describe('FR-033/034: authenticated attempts history, ownership and progress', () => {
  let repl, app, Attempt;
  let counter = 0;
  const envNames = ['MONGODB_URI', 'JWT_ACCESS_SECRET', 'JWT_ACCESS_TTL'];
  const oldEnv = Object.fromEntries(envNames.map((key) => [key, process.env[key]]));
  beforeAll(async () => {
    repl = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
    process.env.MONGODB_URI = repl.getUri();
    process.env.JWT_ACCESS_SECRET = 'sprint2-isolated-integration-test-'.repeat(4);
    process.env.JWT_ACCESS_TTL = '15m';
    await mongoose.connect(repl.getUri());
    Attempt = getAttemptModel();
    await Promise.all([User.init(), RefreshToken.init(), Quiz.init(), Attempt.init()]);
    app = createApp(createAuthenticatedFeatures());
  });
  afterAll(async () => {
    await mongoose.disconnect();
    if (repl) await repl.stop();
    for (const key of envNames) {
      if (oldEnv[key] === undefined) delete process.env[key];
      else process.env[key] = oldEnv[key];
    }
  });
  beforeEach(async () => {
    await Promise.all([User.deleteMany({}), RefreshToken.deleteMany({}), Quiz.deleteMany({}), Attempt.deleteMany({})]);
  });
  async function login(role = 'student') {
    const email = `history${++counter}@example.com`;
    const registered = await request(app).post('/api/v1/auth/register')
      .send({ name: 'Test Account', email, password: 'Study1234' });
    expect(registered.status).toBe(201);
    const user = await User.findOne({ email });
    if (role !== 'student') await User.findByIdAndUpdate(user._id, { role });
    const res = await request(app).post('/api/v1/auth/login').send({ email, password: 'Study1234' });
    expect(res.status).toBe(200);
    return { user, bearer: `Bearer ${res.body.accessToken}` };
  }
  async function quiz(topic = 'dbms', title = 'Database Quiz') {
    return Quiz.create({
      title, topic, status: 'published', authorId: new mongoose.Types.ObjectId(), allowRetake: true,
      questions: [{ type: 'true_false', text: 'True?', answerKey: true }],
    });
  }
  async function attempt(student, q, score, maxScore, date) {
    return Attempt.create({
      quizId: q._id, studentId: student.user._id, score, maxScore,
      submittedAt: new Date(date), answers: [{ questionId: String(q.questions[0]._id), response: true, isCorrect: true, unanswered: false, correctAnswer: true }],
    });
  }
  const iso = (day) => `2026-10-${String(day).padStart(2, '0')}T08:00:00.000Z`;
  test('TC-ATT-08/10: own history newest-first; own detail, another student 403, educator 403', async () => {
    const s1 = await login(); const s2 = await login(); const educator = await login('educator');
    const q = await quiz();
    const a1 = await attempt(s1, q, 1, 3, iso(1));
    await attempt(s1, q, 2, 3, iso(2));
    await attempt(s1, q, 3, 3, iso(3));
    const a2 = await attempt(s2, q, 1, 3, iso(4));
    const history = await request(app).get('/api/v1/attempts/me').set('Authorization', s1.bearer);
    expect(history.status).toBe(200);
    expect(history.headers['cache-control']).toContain('no-store');
    expect(history.body.items).toHaveLength(3);
    expect(history.body.items.map((row) => row.score)).toEqual([3, 2, 1]);
    expect(history.body.items[0]).toMatchObject({ quizTitle: 'Database Quiz', score: 3, maxScore: 3, submittedAt: iso(3) });
    expect(JSON.stringify(history.body)).not.toMatch(/correctAnswer|answerKey|passwordHash|studentId/);
    const detail = await request(app).get(`/api/v1/attempts/${a1.id}`).set('Authorization', s1.bearer);
    expect(detail.status).toBe(200);
    expect(detail.body).toMatchObject({ score: 1, maxScore: 3, submittedAt: iso(1), answers: [expect.objectContaining({ isCorrect: true, correctAnswer: true })] });
    const before = await Attempt.findById(a2._id).lean();
    const denied = await request(app).get(`/api/v1/attempts/${a2.id}`).set('Authorization', s1.bearer);
    expect(denied.status).toBe(403);
    expect(denied.body.error.code).toBe('FORBIDDEN');
    expect(await Attempt.findById(a2._id).lean()).toEqual(before);
    expect((await request(app).get('/api/v1/attempts/me').set('Authorization', educator.bearer)).status).toBe(403);
  });
  test('TC-ATT-11/12: empty history, 401 auth, malformed 400, unknown 404, score stable after quiz edit', async () => {
    const student = await login();
    const empty = await request(app).get('/api/v1/attempts/me').set('Authorization', student.bearer);
    expect(empty.status).toBe(200);
    expect(empty.body).toEqual({ items: [] });
    expect((await request(app).get('/api/v1/attempts/me')).status).toBe(401);
    expect((await request(app).get('/api/v1/attempts/not-id').set('Authorization', student.bearer)).status).toBe(400);
    expect((await request(app).get(`/api/v1/attempts/${new mongoose.Types.ObjectId()}`).set('Authorization', student.bearer)).status).toBe(404);
    const q = await quiz();
    await attempt(student, q, 2, 3, iso(1));
    q.questions[0].answerKey = false;
    await q.save();
    const history = await request(app).get('/api/v1/attempts/me').set('Authorization', student.bearer);
    expect(history.body.items[0]).toMatchObject({ score: 2, maxScore: 3 });
  });
  test('TC-ANL-01–04: per-quiz best score by topic, timeline and student isolation', async () => {
    const s1 = await login(); const s2 = await login(); const educator = await login('educator');
    const q1 = await quiz('DBMS', 'Keys'); const q2 = await quiz('dbms', 'Joins'); const q3 = await quiz('OS', 'Processes');
    await attempt(s1, q1, 2, 5, iso(1));
    await attempt(s1, q1, 4, 5, iso(2));
    await attempt(s1, q2, 3, 5, iso(3));
    await attempt(s1, q3, 1, 2, iso(4));
    await attempt(s2, q3, 2, 2, iso(5));
    const response = await request(app).get('/api/v1/analytics/me/progress').set('Authorization', s1.bearer);
    expect(response.status).toBe(200);
    expect(response.body.topics).toEqual([
      { topic: 'dbms', quizzesAttempted: 2, averageBestPct: 70 },
      { topic: 'os', quizzesAttempted: 1, averageBestPct: 50 },
    ]);
    expect(response.body.timeline).toHaveLength(4);
    expect(response.body.timeline.map((row) => row.submittedAt)).toEqual([iso(1), iso(2), iso(3), iso(4)]);
    expect(JSON.stringify(response.body)).not.toContain(String(s2.user._id));
    expect((await request(app).get('/api/v1/analytics/me/progress').set('Authorization', educator.bearer)).status).toBe(403);
    expect((await request(app).get('/api/v1/analytics/me/progress')).status).toBe(401);
  });
  test('TC-ANL-06: a real POST submission appears in history and progress', async () => {
    const student = await login();
    const q = await quiz('dbms', 'Live submission');
    const submitted = await request(app).post(`/api/v1/quizzes/${q.id}/attempts`)
      .set('Authorization', student.bearer)
      .send({ answers: [{ questionId: String(q.questions[0]._id), response: true }] });
    expect(submitted.status).toBe(201);
    expect(submitted.body).toMatchObject({ score: 1, maxScore: 1 });
    const history = await request(app).get('/api/v1/attempts/me').set('Authorization', student.bearer);
    expect(history.status).toBe(200);
    expect(history.body.items).toHaveLength(1);
    expect(history.body.items[0]).toMatchObject({ quizTitle: 'Live submission', score: 1, maxScore: 1 });
    const progress = await request(app).get('/api/v1/analytics/me/progress').set('Authorization', student.bearer);
    expect(progress.status).toBe(200);
    expect(progress.body.topics).toEqual([{ topic: 'dbms', quizzesAttempted: 1, averageBestPct: 100 }]);
    expect(progress.body.timeline).toHaveLength(1);
  });
  test('TC-ANL-02: empty progress for new student', async () => {
    const s = await login();
    const response = await request(app).get('/api/v1/analytics/me/progress').set('Authorization', s.bearer);
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ topics: [], timeline: [] });
  });
});
