const { randomUUID } = require('node:crypto');
function requestId(req, res, next) {
  req.id = randomUUID(); // Generate our own ID, never trust arbitrary inbound text.
  res.setHeader('X-Request-ID', req.id);
  next();
}
module.exports = { requestId };
