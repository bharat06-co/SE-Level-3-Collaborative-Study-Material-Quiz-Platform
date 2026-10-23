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

describe('FR-030–032 with production auth/quiz wiring and real MongoDB', () => {
  let mongo;
  let app;
  let Attempt;
  let accountNumber = 0;
  const keys = ['MONGODB_URI', 'JWT_ACCESS_SECRET', 'JWT_ACCESS_TTL'];
  const previous = Object.fromEntries(keys.map(key => [key, process.env[key]]));
  const quizBody = {
    title: 'Integrated scoring', topic: 'dbms', allowRetake: false,
    questions: [
      { type: 'mcq', text: 'Choose A', options: ['A', 'B'], answerKey: 0 },
      { type: 'true_false', text: 'False is valid', answerKey: false },
      { type: 'mcq', text: 'Leave this blank', options: ['A', 'B'], answerKey: 1 },
    ],
  };

  beforeAll(async () => {
    mongo = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
    process.env.MONGODB_URI = mongo.getUri();
    process.env.JWT_ACCESS_SECRET = 'isolated-attempt-integration-'.repeat(4);
    process.env.JWT_ACCESS_TTL = '15m';
    await mongoose.connect(mongo.getUri());
    Attempt = getAttemptModel();
    await Promise.all([User.init(), RefreshToken.init(), Quiz.init(), Attempt.init()]);
    app = createApp(createAuthenticatedFeatures());
  });
  afterAll(async () => {
    await mongoose.disconnect();
    if (mongo) await mongo.stop();
    for (const key of keys) {
      if (previous[key] === undefined) delete process.env[key];
      else process.env[key] = previous[key];
    }
  });
  beforeEach(async () => {
    await Promise.all([Attempt.deleteMany({}), Quiz.deleteMany({}), RefreshToken.deleteMany({}), User.deleteMany({})]);
  });

  async function account(role = 'student') {
    const email = `attempt-${++accountNumber}@example.com`;
    const registration = await request(app).post('/api/v1/auth/register')
      .send({ name: 'Integration User', email, password: 'Study1234' });
    expect(registration.status).toBe(201);
    const user = await User.findOne({ email });
    if (role !== 'student') await User.findByIdAndUpdate(user._id, { role });
    const login = await request(app).post('/api/v1/auth/login').send({ email, password: 'Study1234' });
    expect(login.status).toBe(200);
    return { user, bearer: `Bearer ${login.body.accessToken}` };
  }
  async function publishedQuiz() {
    const author = await account('educator');
    const created = await request(app).post('/api/v1/quizzes')
      .set('Authorization', author.bearer).send(quizBody);
    expect(created.status).toBe(201);
    const published = await request(app).post(`/api/v1/quizzes/${created.body.id}/publish`)
      .set('Authorization', author.bearer);
    expect(published.status).toBe(200);
    return { author, quiz: created.body };
  }

  test('register/login → public quiz → submit → authoritative stored score and feedback', async () => {
    const { quiz } = await publishedQuiz();
    const student = await account();
    const read = await request(app).get(`/api/v1/quizzes/${quiz.id}`).set('Authorization', student.bearer);
    expect(read.status).toBe(200);
    expect(JSON.stringify(read.body)).not.toMatch(/answerKey|correctAnswer/);
    const url = `/api/v1/quizzes/${quiz.id}/attempts`;
    const submitted = await request(app).post(url).set('Authorization', student.bearer).send({
      answers: [
        { questionId: quiz.questions[0].id, response: 0 },
        { questionId: quiz.questions[1].id, response: false },
      ],
      score: 999, studentId: 'aaaaaaaaaaaaaaaaaaaaaaaa',
    });
    expect(submitted.status).toBe(201);
    expect(submitted.body).toMatchObject({ score: 2, maxScore: 3, percentage: 66.7 });
    expect(submitted.body.results[2]).toMatchObject({ unanswered: true, correctAnswer: 1 });
    const stored = await Attempt.findById(submitted.body.attemptId).lean();
    expect(String(stored.studentId)).toBe(String(student.user._id));
    expect(stored.score).toBe(2);
    expect(stored.answers[1]).toMatchObject({ response: false, correctAnswer: false, isCorrect: true });
    const freshConnection = await mongoose.createConnection(mongo.getUri()).asPromise();
    try {
      expect(await freshConnection.collection('attempts').countDocuments({ _id: stored._id })).toBe(1);
    } finally { await freshConnection.close(); }
    const replay = await request(app).post(url).set('Authorization', student.bearer).send({ answers: [] });
    expect(replay.status).toBe(409);
    expect(replay.body.error.code).toBe('RETAKE_NOT_ALLOWED');
    expect(await Attempt.countDocuments()).toBe(1);
  });

  test('concurrent no-retake submissions across production-configured apps persist once', async () => {
    const { quiz } = await publishedQuiz();
    const student = await account();
    const secondApp = createApp(createAuthenticatedFeatures());
    const replies = await Promise.all(Array.from({ length: 6 }, (_, index) =>
      request(index % 2 ? app : secondApp).post(`/api/v1/quizzes/${quiz.id}/attempts`)
        .set('Authorization', student.bearer).send({ answers: [] })));
    expect(replies.filter(reply => reply.status === 201)).toHaveLength(1);
    expect(replies.filter(reply => reply.status === 409)).toHaveLength(5);
    expect(await Attempt.countDocuments()).toBe(1);
  });

  test('missing/invalid auth, educator role, unknown answers and unpublished quizzes write nothing', async () => {
    const { quiz, author } = await publishedQuiz();
    const student = await account();
    const url = `/api/v1/quizzes/${quiz.id}/attempts`;
    expect((await request(app).post(url).send({ answers: [] })).status).toBe(401);
    expect((await request(app).post(url).set('Authorization', 'Bearer forged').send({ answers: [] })).status).toBe(401);
    expect((await request(app).post(url).set('Authorization', author.bearer).send({ answers: [] })).status).toBe(403);
    expect((await request(app).post(url).set('Authorization', student.bearer)
      .send({ answers: [{ questionId: 'not-in-quiz', response: 0 }] })).status).toBe(400);
    await request(app).post(`/api/v1/quizzes/${quiz.id}/unpublish`).set('Authorization', author.bearer);
    const unavailable = await request(app).post(url).set('Authorization', student.bearer).send({ answers: [] });
    expect(unavailable.status).toBe(404);
    expect(unavailable.body.error.code).toBe('QUIZ_NOT_AVAILABLE');
    expect(await Attempt.countDocuments()).toBe(0);
  });

  test('same JWT follows current database role and student contributors can attempt', async () => {
    const { quiz } = await publishedQuiz();
    const student = await account();
    const url = `/api/v1/quizzes/${quiz.id}/attempts`;
    await User.findByIdAndUpdate(student.user._id, { role: 'educator' });
    expect((await request(app).post(url).set('Authorization', student.bearer).send({ answers: [] })).status).toBe(403);
    await User.findByIdAndUpdate(student.user._id, { role: 'student', contributor: true });
    expect((await request(app).post(url).set('Authorization', student.bearer).send({ answers: [] })).status).toBe(201);
  });
});