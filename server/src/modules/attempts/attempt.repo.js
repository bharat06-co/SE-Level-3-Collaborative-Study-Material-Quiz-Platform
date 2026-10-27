const mongoose = require('mongoose');
const { getAttemptModel } = require('./attempt.model');
function createAttemptRepository({ connection = mongoose.connection, findQuizForScoring } = {}) {
  const model = getAttemptModel(connection);
  let indexPromise;
  async function ensureIndexes() {
    // Build/verify indexes before accepting an insert, even with autoIndex disabled.
    if (!indexPromise) indexPromise = model.createIndexes().catch((error) => { indexPromise = undefined; throw error; });
    await indexPromise;
  }
  async function getQuizMetadata(ids) {
    const unique = [...new Set(ids.map(String))];
    if (!unique.length) return new Map();
    const quizzes = await connection.collection('quizzes').find(
      { _id: { $in: unique.map((id) => new mongoose.Types.ObjectId(id)) } },
      { projection: { title: 1, topic: 1 } },
    ).toArray();
    return new Map(quizzes.map((quiz) => [String(quiz._id), { title: quiz.title, topic: quiz.topic }]));
  }
  return {
    getQuizMetadata,
    async listStudentAttempts(studentId) {
      const rows = await model.find({ studentId: new mongoose.Types.ObjectId(studentId) })
        .select('_id quizId score maxScore submittedAt')
        .sort({ submittedAt: -1, _id: -1 }).lean();
      const quizzes = await getQuizMetadata(rows.map((row) => row.quizId));
      return rows.map((row) => {
        const quiz = quizzes.get(String(row.quizId));
        return { ...row, quizTitle: quiz?.title ?? 'Deleted quiz', topic: quiz?.topic ?? 'Unknown topic' };
      });
    },
    async findAttemptById(id) {
      return model.findById(id).lean();
    },
    async findPublishedQuiz(quizId) {
      if (findQuizForScoring) return findQuizForScoring(quizId);
      // Read the SAD quizzes collection; do NOT register a competing Quiz schema.
      return connection.collection('quizzes').findOne(
        { _id: new mongoose.Types.ObjectId(quizId), status: 'published' },
        { projection: { _id: 1, allowRetake: 1, questions: 1 } },
      );
    },
    async hasAttempt(quizId, studentId) {
      return Boolean(await model.exists({ quizId, studentId }));
    },
    async insertAttempt(data) {
      await ensureIndexes();
      const saved = await model.create(data);
      return { id: String(saved._id), submittedAt: saved.submittedAt };
    },
  };
}
module.exports = { createAttemptRepository };
