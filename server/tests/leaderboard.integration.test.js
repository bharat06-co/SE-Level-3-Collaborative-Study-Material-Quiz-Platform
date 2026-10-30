const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const request = require('supertest');
const { MongoMemoryReplSet } = require('mongodb-memory-server');
const { createApp } = require('../src/app');
const { createAuthenticate } = require('../src/middleware/authenticate');
const User = require('../src/models/User');
const { Quiz } = require('../src/modules/quizzes/quiz.model');
const { getAttemptModel } = require('../src/modules/attempts/attempt.model');
const { competitionRanks } = require('../src/modules/analytics/leaderboard.service');

jest.setTimeout(90000);

test('competition ranking skips the positions after ties', () => {
  expect(competitionRanks([9, 7, 7, 7, 5].map((score) => ({ score })), 'score')
    .map((row) => row.rank)).toEqual([1, 2, 2, 2, 5]);
});

describe('FR-035 leaderboard with persisted attempts and verified login', () => {
  let mongo;
  let app;
  let users;
  let quizzes;
  const oldUri = process.env.MONGODB_URI;
  const oldSecret = process.env.JWT_ACCESS_SECRET;
  const oldTtl = process.env.JWT_ACCESS_TTL;

  beforeAll(async () => {
    mongo = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
    process.env.MONGODB_URI = mongo.getUri();
    process.env.JWT_ACCESS_SECRET = 'leaderboard-test-secret-'.repeat(4);
    process.env.JWT_ACCESS_TTL = '15m';
    await mongoose.connect(mongo.getUri(), { serverSelectionTimeoutMS: 15000 });
    const passwordHash = await bcrypt.hash('Study1234', 10);
    const createdUsers = await User.create([
      { name: 'Alice', email: 'alice-lb@example.com', passwordHash, role: 'student' },
      { name: 'Bob', email: 'bob-lb@example.com', passwordHash, role: 'student', contributor: true },
      { name: 'Charlie', email: 'charlie-lb@example.com', passwordHash, role: 'student' },
      { name: 'Educator', email: 'educator-lb@example.com', passwordHash, role: 'educator' },
      { name: 'Admin', email: 'admin-lb@example.com', passwordHash, role: 'admin' },
    ]);
    users = Object.fromEntries(createdUsers.map((user) => [user.name, user]));
    const question = [{ text: 'Choose B', type: 'mcq', options: ['A', 'B'], answerKey: 1 }];
    quizzes = await Quiz.create([
      { title: 'Database quiz one', topic: 'DBMS', authorId: users.Educator._id, status: 'published', questions: question },
      { title: 'Database quiz two', topic: 'dbms', authorId: users.Educator._id, status: 'published', questions: question },
      { title: 'Draft database quiz', topic: 'DbMs', authorId: users.Educator._id, status: 'draft', questions: question },
      { title: 'Other topic quiz', topic: 'OS', authorId: users.Educator._id, status: 'published', questions: question },
      { title: 'Empty quiz', topic: 'empty', authorId: users.Educator._id, status: 'published', questions: question },
    ]);
    const Attempt = getAttemptModel();
    const rows = [
      [0, 'Alice', 5], [0, 'Alice', 8], [0, 'Bob', 8], [0, 'Charlie', 6],
      [1, 'Alice', 6], [1, 'Bob', 2], [2, 'Alice', 10], [3, 'Alice', 10],
    ];
    await Attempt.create(rows.map(([quizIndex, name, score], index) => ({
      quizId: quizzes[quizIndex]._id,
      studentId: users[name]._id,
      answers: [], score, maxScore: 10,
      submittedAt: new Date(Date.UTC(2026, 9, 29, 0, index)),
    })));
    app = createApp({ attempts: { authenticate: createAuthenticate() } });
  });

  afterAll(async () => {
    try {
      if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
    } finally {
      if (mongo) await mongo.stop();
      for (const [key, value] of [['MONGODB_URI', oldUri], ['JWT_ACCESS_SECRET', oldSecret], ['JWT_ACCESS_TTL', oldTtl]]) {
        if (value === undefined) delete process.env[key];
        else process.env[key] = value;
      }
    }
  });

  async function bearer(name) {
    const response = await request(app).post('/api/v1/auth/login')
      .send({ email: `${name.toLowerCase()}-lb@example.com`, password: 'Study1234' });
    expect(response.status).toBe(200);
    return `Bearer ${response.body.accessToken}`;
  }

  test('quiz ranks each student by best score, keeps ties, and paginates global ranks', async () => {
    const student = await bearer('Alice');
    const path = '/api/v1/leaderboard';
    const query = { quizId: String(quizzes[0]._id) };
    const result = await request(app).get(path).query(query).set('Authorization', student);
    expect(result.status).toBe(200);
    expect(result.body.items.map(({ studentName, score, rank }) => [studentName, score, rank]))
      .toEqual([['Alice', 8, 1], ['Bob', 8, 1], ['Charlie', 6, 3]]);
    expect(result.body.total).toBe(3);
    expect(JSON.stringify(result.body)).not.toMatch(/answerKey|correctAnswer|passwordHash/);
    const secondPage = await request(app).get(path).query({ ...query, page: 2, limit: 2 })
      .set('Authorization', student);
    expect(secondPage.body.items.map(({ studentName, rank }) => [studentName, rank]))
      .toEqual([['Charlie', 3]]);
  });

  test('topic sums each best percentage across published quizzes with case-insensitive scope', async () => {
    const result = await request(app).get('/api/v1/leaderboard').query({ topic: 'dBmS' })
      .set('Authorization', await bearer('Bob'));
    expect(result.status).toBe(200);
    expect(result.body.items.map(({ studentName, rankingScore, rank }) => [studentName, rankingScore, rank]))
      .toEqual([['Alice', 140, 1], ['Bob', 100, 2], ['Charlie', 60, 3]]);
  });

  test('empty, invalid and unpublished quiz scopes follow the HTTP contract', async () => {
    const student = await bearer('Charlie');
    const path = '/api/v1/leaderboard';
    const empty = await request(app).get(path).query({ quizId: String(quizzes[4]._id) })
      .set('Authorization', student);
    expect(empty.status).toBe(200);
    expect(empty.body.items).toEqual([]);
    for (const query of [{}, { quizId: 'abc' }, { topic: '' }, { quizId: String(quizzes[0]._id), topic: 'dbms' }]) {
      const response = await request(app).get(path).query(query).set('Authorization', student);
      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    }
    for (const id of [String(quizzes[2]._id), new mongoose.Types.ObjectId().toString()]) {
      const response = await request(app).get(path).query({ quizId: id }).set('Authorization', student);
      expect(response.status).toBe(404);
      expect(response.body.error.code).toBe('NOT_FOUND');
    }
  });

  test('all roles see the same leaderboard, while no token is rejected', async () => {
    const path = '/api/v1/leaderboard';
    const query = { quizId: String(quizzes[0]._id) };
    expect((await request(app).get(path).query(query)).status).toBe(401);
    const lists = [];
    for (const name of ['Alice', 'Bob', 'Educator', 'Admin']) {
      const response = await request(app).get(path).query(query).set('Authorization', await bearer(name));
      expect(response.status).toBe(200);
      lists.push(response.body.items);
    }
    for (const items of lists.slice(1)) expect(items).toEqual(lists[0]);
  });
});
