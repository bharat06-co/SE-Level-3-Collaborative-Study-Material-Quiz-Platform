const { Router } = require('express');
const { asyncHandler } = require('../../utils/asyncHandler');
const { validateSubmission } = require('./attempt.schemas');
const { rejectUnconfiguredAuthentication, requireStudent } = require('./attempt.auth');
const { createAttemptController } = require('./attempt.controller');
const { createAttemptService } = require('./attempt.service');
const { createAttemptRepository } = require('./attempt.repo');
const { createAttemptHistoryService } = require('./attempt.history');
function createAttemptRouter({ authenticate = rejectUnconfiguredAuthentication, repository, service } = {}) {
  const router = Router();
  const attemptRepository = repository || createAttemptRepository();
  const submissionService = service || createAttemptService({ repository: attemptRepository });
  const historyService = createAttemptHistoryService({ repository: attemptRepository });
  router.get('/attempts/me', authenticate, requireStudent, asyncHandler(async (req, res) => {
    res.set('Cache-Control', 'private, no-store');
    res.json(await historyService.list(req.attemptStudentId));
  }));
  router.get('/attempts/:id', authenticate, requireStudent, asyncHandler(async (req, res) => {
    res.set('Cache-Control', 'private, no-store');
    res.json(await historyService.detail(req.attemptStudentId, req.params.id));
  }));
  router.post('/quizzes/:quizId/attempts', authenticate, requireStudent, validateSubmission, asyncHandler(createAttemptController(submissionService)));
  return router;
}
module.exports = { createAttemptRouter };
