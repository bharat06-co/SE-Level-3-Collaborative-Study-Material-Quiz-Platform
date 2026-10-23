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
  return {
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
