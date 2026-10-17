const express = require('express');
const { AppError } = require('../../utils/AppError');
const { asyncHandler } = require('../../utils/asyncHandler');
const { createLeaderboardController } = require('./leaderboard.controller');

function createLeaderboardRouter({ authenticate, controller = createLeaderboardController() }) {
  if (typeof authenticate !== 'function') throw new TypeError('Verified authenticate middleware is required.');
  const router = express.Router();
  router.use(authenticate);
  router.use((req, res, next) => req.auth?.userId ? next() : next(new AppError(401, 'UNAUTHENTICATED', 'Authentication required.')));
  router.get('/', asyncHandler(controller.get));
  return router;
}
module.exports = { createLeaderboardRouter };
