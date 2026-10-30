const { Router } = require('express');
const { asyncHandler } = require('../../utils/asyncHandler');
const { AppError } = require('../../utils/AppError');
const { rejectUnconfiguredAuthentication } = require('../attempts/attempt.auth');
const { createLeaderboardService } = require('./leaderboard.service');

function createLeaderboardRouter({ authenticate = rejectUnconfiguredAuthentication, service = createLeaderboardService() } = {}) {
  const router = Router();
  router.get('/leaderboard', authenticate, (req, res, next) => {
    if (!req.auth?.userId || !['student', 'educator', 'admin'].includes(req.auth.role)) {
      return next(new AppError(401, 'UNAUTHENTICATED', 'Authentication is required.'));
    }
    return next();
  }, asyncHandler(async (req, res) => {
    res.set('Cache-Control', 'private, no-store');
    res.json(await service.list(req.query));
  }));
  return router;
}

module.exports = { createLeaderboardRouter };
