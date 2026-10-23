const express = require('express');
const { AppError } = require('../../utils/AppError');

const {
  listUsers,
  updateUserRole,
} = require('./admin.controller');

function requireAdmin(req, res, next) {
  if (req.auth?.role !== 'admin') {
    return next(
      new AppError(403, 'FORBIDDEN', 'Admin access is required.'),
    );
  }

  return next();
}

function createAdminRouter({ authenticate }) {
  const router = express.Router();

  router.use(authenticate);
  router.use(requireAdmin);

  router.get('/users', listUsers);
  router.patch('/users/:id/role', updateUserRole);

  return router;
}

module.exports = { createAdminRouter };