const { AppError } = require('../utils/AppError');
function hasUnsafeKeys(value) {
  if (!value || typeof value !== 'object') return false;
  return Object.entries(value).some(([key, child]) => key.startsWith('$') || key.includes('.') || hasUnsafeKeys(child));
}
function rejectUnsafeKeys(req, res, next) {
  if (hasUnsafeKeys(req.body) || hasUnsafeKeys(req.query)) {
    return next(new AppError(400, 'VALIDATION_ERROR', 'Unsupported object keys.', [{ field: 'request', message: 'Operator and dotted keys are not allowed.' }]));
  }
  next();
}
module.exports = { rejectUnsafeKeys, hasUnsafeKeys };
