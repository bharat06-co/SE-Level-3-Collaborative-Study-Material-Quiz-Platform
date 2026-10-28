const express = require('express');

const {
  register,
  login,
  refresh,
  logout,
  requestPasswordResetController,
  resetPasswordController,
} = require('./auth.controller');

const router = express.Router();

router.post('/register', register);
router.post('/login', login);
router.post('/refresh', refresh);
router.post('/logout', logout);

// Request a password-reset email
router.post('/forgot-password', requestPasswordResetController);

// Submit the reset token and new password
router.post('/reset-password', resetPasswordController);

module.exports = router;