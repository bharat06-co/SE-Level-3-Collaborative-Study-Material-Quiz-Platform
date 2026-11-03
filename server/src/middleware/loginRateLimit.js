const { AppError } = require('../utils/AppError');

// Per-app, per-IP failed-login window. Reserve in-flight attempts before bcrypt
// so concurrent requests cannot all pass the limit check. No credentials stored.
function createLoginRateLimit({ now = Date.now, maxEntries = 10000 } = {}) {
  const windowMs = 15 * 60 * 1000;
  const limit = 10;
  const entries = new Map();

  return function loginRateLimit(req, res, next) {
    const timestamp = now();
    const key = req.ip; // Express honours only the app's explicit trust-proxy policy.
    let entry = entries.get(key);
    if (entry && timestamp >= entry.resetAt) {
      entries.delete(key);
      entry = undefined;
    }
    if (!entry) {
      for (const [ip, value] of entries) {
        if (timestamp >= value.resetAt) entries.delete(ip);
      }
      // Bound memory without evicting active failure windows and failing open.
      if (entries.size >= maxEntries) {
        res.set('Retry-After', String(Math.ceil(windowMs / 1000)));
        return next(new AppError(429, 'RATE_LIMITED', 'Too many login attempts. Try again later.'));
      }
      entry = { count: 0, resetAt: timestamp + windowMs };
      entries.set(key, entry);
    }
    if (entry.count >= limit) {
      res.set('Retry-After', String(Math.max(1, Math.ceil((entry.resetAt - timestamp) / 1000))));
      return next(new AppError(429, 'RATE_LIMITED', 'Too many login attempts. Try again later.'));
    }
    entry.count++;
    let settled = false;
    function settle() {
      if (settled) return;
      settled = true;
      // Only credential failures consume the window; successful login and
      // validation/service failures release their reservation. An aborted login
      // stays counted conservatively because its credential result is unknown.
      if (res.writableFinished && res.statusCode !== 401) {
        entry.count--;
        if (entry.count === 0 && entries.get(key) === entry) entries.delete(key);
      }
    }
    res.once('finish', settle);
    res.once('close', settle);
    next();
  };
}

module.exports = { createLoginRateLimit };
