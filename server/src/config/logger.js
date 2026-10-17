const pino = require('pino');
function createLogger(level = 'info') {
  return pino({ level, redact: { paths: ['password', 'passwordHash', 'token', 'accessToken', 'refreshToken', 'answerKey', 'req.headers.authorization', 'req.headers.cookie', 'res.headers["set-cookie"]'], censor: '[REDACTED]' } });
}
module.exports = { createLogger };
