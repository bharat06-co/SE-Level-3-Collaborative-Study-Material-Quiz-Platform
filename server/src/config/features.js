const { createAuthenticate } = require('../middleware/authenticate');
const { createQuizService } = require('../modules/quizzes/quiz.service');
const { createAttemptRepository } = require('../modules/attempts/attempt.repo');

// The same configuration is used by normal startup and authenticated integration tests.
function createAuthenticatedFeatures() {
  const authenticate = createAuthenticate();
  const quizService = createQuizService();
  return {
    quizAuthenticate: authenticate,
    attempts: {
      authenticate,
      repository: createAttemptRepository({ findQuizForScoring: quizService.getQuizForScoring }),
    },
  };
}
module.exports = { createAuthenticatedFeatures };
