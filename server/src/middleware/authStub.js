const { AppError } = require('../utils/AppError');

// TEMP: Sprint 1 placeholder until the auth PR (FR-002/FR-004) supplies the
// verified request context. It never grants access and never fakes a success;
// every request is rejected until real token verification is wired in.
function authUnavailable(req, res, next) {
  // Per the agreed plan (option b): every request is rejected as
  // UNAUTHENTICATED until real token verification is wired in.
  return next(new AppError(401, 'UNAUTHENTICATED', 'Sign-in is not available yet.', [{ field: 'auth', message: 'Awaiting the shared authentication middleware.' }]));
}

module.exports = { authUnavailable };
