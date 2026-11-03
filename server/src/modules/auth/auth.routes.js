const express = require('express');
const { createLoginRateLimit } = require('../../middleware/loginRateLimit');

const {
  register,
  login,
  refresh,
  logout,
  requestPasswordResetController,
  resetPasswordController,
} = require('./auth.controller');

function createAuthRouter({ loginRateLimitOptions } = {}) {
  const router = express.Router();

  router.post('/register', register);
  router.post('/login', createLoginRateLimit(loginRateLimitOptions), login);
  router.post('/refresh', refresh);
  router.post('/logout', logout);

  // Request a password-reset email
  router.post('/forgot-password', requestPasswordResetController);

  // Submit the reset token and new password
  router.post('/reset-password', resetPasswordController);

  return router;
}

module.exports = { createAuthRouter };