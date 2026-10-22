const express = require('express');
const { asyncHandler } = require('../../utils/asyncHandler');
const { createQuizController } = require('./quiz.controller');
const { AppError } = require('../../utils/AppError');

function createQuizRouter({ authenticate, controller = createQuizController() }) {
  if (typeof authenticate !== 'function') throw new TypeError('Verified authenticate middleware is required.');
  const router = express.Router();
  router.use(authenticate);
  router.use((req, res, next) => {
    if (!req.auth?.userId || !['student', 'educator', 'admin'].includes(req.auth.role)) {
      return next(new AppError(401, 'UNAUTHENTICATED', 'Authentication required.'));
    }
    next();
  });
  router.post('/', asyncHandler(controller.create));
  router.get('/', asyncHandler(controller.list));
  router.get('/:id', asyncHandler(controller.get));
  router.put('/:id', asyncHandler(controller.update));
  router.delete('/:id', asyncHandler(controller.remove));
  router.post('/:id/publish', asyncHandler(controller.publish));
  router.post('/:id/unpublish', asyncHandler(controller.unpublish));
  return router;
}
module.exports = { createQuizRouter };
