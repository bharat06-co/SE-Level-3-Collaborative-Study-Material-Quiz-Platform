const { Router } = require('express');
const { asyncHandler } = require('../../utils/asyncHandler');
const { validateSubmission } = require('./attempt.schemas');
const { rejectUnconfiguredAuthentication, requireStudent } = require('./attempt.auth');
const { createAttemptController } = require('./attempt.controller');
const { createAttemptService } = require('./attempt.service');
const { createAttemptRepository } = require('./attempt.repo');
function createAttemptRouter({ authenticate = rejectUnconfiguredAuthentication, repository, service } = {}) {
  const router = Router();
  const submissionService = service || createAttemptService({ repository: repository || createAttemptRepository() });
  router.post('/quizzes/:quizId/attempts', authenticate, requireStudent, validateSubmission, asyncHandler(createAttemptController(submissionService)));
  return router;
}
module.exports = { createAttemptRouter };
