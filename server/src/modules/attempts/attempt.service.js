const { AppError } = require('../../utils/AppError');
const { scoreAnswers } = require('./scoring.service');
function retakeNotAllowed() { return new AppError(409, 'RETAKE_NOT_ALLOWED', 'This quiz does not allow another attempt.'); }
function createAttemptService({ repository, now = () => new Date() }) {
  return {
    async submit({ quizId, studentId, answers }) {
      const quiz = await repository.findPublishedQuiz(quizId);
      if (!quiz) throw new AppError(404, 'QUIZ_NOT_AVAILABLE', 'Quiz is not available.');
      // Fail on corrupt/missing server policy; never silently permit a retake.
      if (typeof quiz.allowRetake !== 'boolean') throw new Error('Quiz retake policy is invalid.');
      if (!quiz.allowRetake && await repository.hasAttempt(quizId, studentId)) throw retakeNotAllowed();
      const scored = scoreAnswers(quiz.questions, answers);
      const submittedAt = now();
      const data = { quizId, studentId, answers: scored.storedAnswers, score: scored.score, maxScore: scored.maxScore, submittedAt };
      if (!quiz.allowRetake) data.retakeGuard = `${quizId}:${studentId}`;
      let saved;
      try { saved = await repository.insertAttempt(data); }
      catch (error) {
        if (error.code === 11000 && error.keyPattern?.retakeGuard === 1) throw retakeNotAllowed();
        throw error;
      }
      // A successful response is constructed only AFTER the acknowledged write.
      return { attemptId: saved.id, score: scored.score, maxScore: scored.maxScore, percentage: scored.percentage, submittedAt: new Date(saved.submittedAt).toISOString(), results: scored.results };
    },
  };
}
module.exports = { createAttemptService };
