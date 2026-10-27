
const { createAuthenticate } = require('../middleware/authenticate');
const { createAdminRouter } = require('../modules/admin/admin.routes');
const { createProfileRouter } = require('../modules/auth/profile.routes');
const { createQuizService } = require('../modules/quizzes/quiz.service');
const { createAttemptRepository } = require('../modules/attempts/attempt.repo');

function createAuthenticatedFeatures() {
  const authenticate = createAuthenticate();
  const quizService = createQuizService();

  return {
    quizAuthenticate: authenticate,

    registerRoutes(app) {
      app.use('/api/v1/admin', createAdminRouter({ authenticate }));
      app.use('/api/v1/profile', createProfileRouter({ authenticate }));
    },

    attempts: {
      authenticate,
      repository: createAttemptRepository({
        findQuizForScoring: quizService.getQuizForScoring,
      }),
    },
  };
}

module.exports = { createAuthenticatedFeatures };