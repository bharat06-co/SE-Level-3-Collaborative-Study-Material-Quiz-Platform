const mongoose = require('mongoose');
const { Quiz } = require('../src/modules/quizzes/quiz.model');
const { createLeaderboardService } = require('../src/modules/analytics/leaderboard.service');

// Run with TEST_MONGODB_URI pointing to an isolated MongoDB 7 test instance.
const mongoDescribe = process.env.TEST_MONGODB_URI ? describe : describe.skip;

mongoDescribe('real MongoDB leaderboard aggregation', () => {
  beforeAll(async () => {
    await mongoose.connect(process.env.TEST_MONGODB_URI, { dbName: `ayush_leaderboard_${Date.now()}` });
  });

  afterAll(async () => {
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  });

  test('mathematically equal fractional topic totals tie after aggregation', async () => {
    const authorId = new mongoose.Types.ObjectId();
    const [first, second] = await Quiz.create([
      { title: 'First quiz', topic: 'fractional', authorId, status: 'published', questions: [{ text: 'Answer?', type: 'true_false', answerKey: true }] },
      { title: 'Second quiz', topic: 'fractional', authorId, status: 'published', questions: [{ text: 'Answer?', type: 'true_false', answerKey: false }] },
    ]);
    const a = new mongoose.Types.ObjectId();
    const b = new mongoose.Types.ObjectId();
    await mongoose.connection.db.collection('attempts').insertMany([
      { quizId: first._id, studentId: a, score: 1, maxScore: 3 },
      { quizId: second._id, studentId: a, score: 2, maxScore: 3 },
      { quizId: first._id, studentId: b, score: 3, maxScore: 3 },
    ]);
    const result = await createLeaderboardService().get({ topic: 'fractional' });
    expect(result.items).toHaveLength(2);
    expect(result.items.map(({ rank, score }) => [rank, score])).toEqual([[1, 100], [1, 100]]);
    expect(new Set(result.items.map(({ studentId }) => studentId))).toEqual(new Set([String(a), String(b)]));
  });
});
