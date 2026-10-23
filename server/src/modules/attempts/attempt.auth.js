const { AppError } = require('../../utils/AppError');
const { objectId } = require('./attempt.schemas');
// Fail closed until the real auth owner supplies verified bearer-token middleware.
// No public mock token, client header, JSON identity or development bypass is accepted.
function rejectUnconfiguredAuthentication(req, res, next) {
  next(new AppError(401, 'UNAUTHENTICATED', 'Authentication is required.'));
}
function requireStudent(req, res, next) {
  const identity = req.auth;
  if (!identity || !objectId.safeParse(identity.userId).success) {
    return next(new AppError(401, 'UNAUTHENTICATED', 'Authentication is required.'));
  }
  if (identity.role !== 'student') return next(new AppError(403, 'FORBIDDEN', 'Only students may submit quiz attempts.'));
  // A contributor is still a student. Never require contributor=false.
  req.attemptStudentId = identity.userId.toLowerCase();
  next();
}
module.exports = { rejectUnconfiguredAuthentication, requireStudent };
