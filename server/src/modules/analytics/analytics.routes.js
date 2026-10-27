const { Router } = require('express');
const { asyncHandler } = require('../../utils/asyncHandler');
const { rejectUnconfiguredAuthentication, requireStudent } = require('../attempts/attempt.auth');
const { createAttemptRepository } = require('../attempts/attempt.repo');
const { createProgressService } = require('./progress.service');

function createAnalyticsRouter({ authenticate = rejectUnconfiguredAuthentication, repository } = {}) {
  const router = Router();
  const service = createProgressService({ repository: repository || createAttemptRepository() });
  router.get('/analytics/me/progress', authenticate, requireStudent, asyncHandler(async (req, res) => {
    res.set('Cache-Control', 'private, no-store');
    res.json(await service.getForStudent(req.attemptStudentId));
  }));
  return router;
}

module.exports = { createAnalyticsRouter };
