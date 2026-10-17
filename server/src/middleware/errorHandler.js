const { AppError } = require('../utils/AppError');
function errorHandler(logger) {
  return (err, req, res, next) => {
    if (res.headersSent) return next(err);
    let known = err instanceof AppError ? err : null;
    if (err.type === 'entity.parse.failed') known = new AppError(400, 'VALIDATION_ERROR', 'Request body must be valid JSON.');
    if (err.type === 'entity.too.large') known = new AppError(413, 'FILE_TOO_LARGE', 'Request body exceeds the allowed size.');
    if (!known) {
      // Log stack frames, not arbitrary error messages or request bodies, which may contain secrets.
      logger.error({ requestId: req.id, errorName: err.name, stack: String(err.stack || '').split('\n').slice(1).join('\n') }, 'Unexpected request failure');
    }
    res.status(known ? known.statusCode : 500).json({ error: {
      code: known ? known.code : 'INTERNAL_ERROR',
      message: known ? known.message : 'An unexpected error occurred.',
      details: known ? known.details : [],
      requestId: req.id,
    } });
  };
}
module.exports = { errorHandler };
