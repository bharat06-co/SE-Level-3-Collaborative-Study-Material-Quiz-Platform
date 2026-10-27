const { AppError } = require('../../utils/AppError');
const { objectId } = require('./attempt.schemas');

function historyRow(row) {
  return {
    id: String(row._id),
    quizId: String(row.quizId),
    quizTitle: row.quizTitle,
    topic: row.topic,
    score: row.score,
    maxScore: row.maxScore,
    submittedAt: new Date(row.submittedAt).toISOString(),
  };
}

function createAttemptHistoryService({ repository }) {
  return {
    async list(studentId) {
      const records = await repository.listStudentAttempts(studentId);
      return { items: records.map(historyRow) };
    },
    async detail(studentId, id) {
      if (!objectId.safeParse(id).success) {
        throw new AppError(400, 'VALIDATION_ERROR', 'Invalid attempt ID.', [
          { field: 'id', message: 'Must be a 24-character MongoDB ID.' },
        ]);
      }
      const row = await repository.findAttemptById(id.toLowerCase());
      if (!row) throw new AppError(404, 'NOT_FOUND', 'Attempt not found.');
      if (String(row.studentId) !== studentId) {
        throw new AppError(403, 'FORBIDDEN', 'You cannot view another student’s attempt.');
      }
      const metadata = await repository.getQuizMetadata([row.quizId]);
      const quiz = metadata.get(String(row.quizId));
      return {
        ...historyRow({ ...row, quizTitle: quiz?.title ?? 'Deleted quiz', topic: quiz?.topic ?? 'Unknown topic' }),
        answers: (row.answers || []).map(({ questionId, response, isCorrect, unanswered, correctAnswer }) => ({
          questionId, response, isCorrect, unanswered, correctAnswer,
        })),
      };
    },
  };
}

module.exports = { createAttemptHistoryService };
