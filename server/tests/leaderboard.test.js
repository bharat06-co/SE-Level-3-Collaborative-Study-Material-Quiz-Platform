const request = require('supertest');
const { createApp } = require('../src/app');
const { createLeaderboardService, rank } = require('../src/modules/analytics/leaderboard.service');
const { createLeaderboardRouter } = require('../src/modules/analytics/leaderboard.routes');
const { createLeaderboardController } = require('../src/modules/analytics/leaderboard.controller');

const quizId = '670200000000000000000001';
const otherId = '670200000000000000000002';
const studentIds = ['670100000000000000000001', '670100000000000000000002', '670100000000000000000003'];

function fixture() {
  const quizzes = [
    { _id: quizId, status: 'published', topic: 'dbms' },
    { _id: otherId, status: 'published', topic: 'DBMS' },
    { _id: '670200000000000000000003', status: 'draft', topic: 'dbms' },
  ];
  const attempts = [
    { quizId, studentId: studentIds[0], score: 5, maxScore: 10 },
    { quizId, studentId: studentIds[0], score: 8, maxScore: 10 },
    { quizId, studentId: studentIds[1], score: 8, maxScore: 10 },
    { quizId, studentId: studentIds[2], score: 6, maxScore: 10 },
    { quizId: otherId, studentId: studentIds[0], score: 6, maxScore: 10 },
    { quizId: otherId, studentId: studentIds[1], score: 2, maxScore: 10 },
    { quizId: quizzes[2]._id, studentId: studentIds[2], score: 10, maxScore: 10 },
  ];
  const repo = {
    async findQuiz(id) { return quizzes.find((quiz) => quiz._id === id); },
    async findPublishedQuizIds(topic) {
      return quizzes.filter((quiz) => quiz.status === 'published' && quiz.topic.toLowerCase() === topic.toLowerCase()).map((quiz) => quiz._id);
    },
    async quizScores(id) {
      const best = new Map();
      attempts.filter((attempt) => attempt.quizId === id).forEach(({ studentId, score }) => best.set(studentId, Math.max(best.get(studentId) || 0, score)));
      return [...best].map(([studentId, score]) => ({ studentId, score }));
    },
    async topicScores(ids) {
      const best = new Map();
      attempts.filter((attempt) => ids.includes(attempt.quizId)).forEach(({ studentId, quizId: id, score, maxScore }) => {
        const key = `${studentId}:${id}`;
        best.set(key, Math.max(best.get(key) || 0, score / maxScore * 100));
      });
      const totals = new Map();
      for (const [key, score] of best) {
        const studentId = key.split(':')[0];
        totals.set(studentId, (totals.get(studentId) || 0) + score);
      }
      return [...totals].map(([studentId, score]) => ({ studentId, score }));
    },
    async studentNames() { return new Map(studentIds.map((id, index) => [id, `Student ${index + 1}`])); },
  };
  return createLeaderboardService(repo);
}

test('competition ranking skips ranks after ties', () => {
  expect(rank([9, 7, 7, 7, 5].map((score, i) => ({ studentId: String(i), score }))).map((item) => item.rank))
    .toEqual([1, 2, 2, 2, 5]);
});

test('quiz ranking uses best retake and ties at 1, 1, 3', async () => {
  const result = await fixture().get({ quizId });
  expect(result.mode).toBe('quiz');
  expect(result.items.map(({ rank, score }) => [rank, score])).toEqual([[1, 8], [1, 8], [3, 6]]);
});

test('topic ranking sums best percentages and excludes unpublished quizzes', async () => {
  const result = await fixture().get({ topic: 'DBMS' });
  expect(result.items.map(({ rank, score }) => [rank, score])).toEqual([[1, 140], [2, 100], [3, 60]]);
});

test('invalid selectors and unpublished quiz are rejected', async () => {
  const service = fixture();
  for (const query of [{}, { quizId: 'abc' }, { quizId, topic: 'dbms' }]) {
    await expect(service.get(query)).rejects.toMatchObject({ statusCode: 400, code: 'VALIDATION_ERROR' });
  }
  await expect(service.get({ quizId: '670200000000000000000003' })).rejects.toMatchObject({ statusCode: 404 });
  await expect(service.get({ quizId: '670200000000000000000004' })).rejects.toMatchObject({ statusCode: 404 });
});

test('HTTP endpoint requires auth and works for every role', async () => {
  const service = fixture();
  const identities = { student: 'student', contributor: 'student', educator: 'educator', admin: 'admin' };
  const app = createApp({ registerRoutes: (expressApp) => expressApp.use('/api/v1/leaderboard', createLeaderboardRouter({
    authenticate(req, res, next) { if (identities[req.get('X-Test-Role')]) req.auth = { userId: studentIds[0], role: identities[req.get('X-Test-Role')] }; next(); },
    controller: createLeaderboardController(service),
  })) });
  expect((await request(app).get(`/api/v1/leaderboard?quizId=${quizId}`)).status).toBe(401);
  for (const role of Object.keys(identities)) {
    const response = await request(app).get(`/api/v1/leaderboard?quizId=${quizId}`).set('X-Test-Role', role);
    expect(response.status).toBe(200);
    expect(response.body.items.map((row) => row.rank)).toEqual([1, 1, 3]);
  }
});
