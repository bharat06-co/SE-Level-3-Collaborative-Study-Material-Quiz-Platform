
const {
  registerUser,
  loginUser,
  refreshUserSession,
} = require('./auth.service');

const REFRESH_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: true,
  sameSite: 'strict',
  path: '/api/v1/auth',
  maxAge: 604800000,
};

function setRefreshCookie(res, token) {
  res.cookie('rt', token, REFRESH_COOKIE_OPTIONS);
}

function clearRefreshCookie(res) {
  res.clearCookie('rt', {
    httpOnly: true,
    secure: true,
    sameSite: 'strict',
    path: '/api/v1/auth',
  });
}

async function register(req, res, next) {
  try {
    const user = await registerUser(req.body || {});
    return res.status(201).json({ user });
  } catch (error) {
    return next(error);
  }
}

async function login(req, res, next) {
  try {
    const result = await loginUser(req.body || {});
    setRefreshCookie(res, result.refreshToken);

   const responseBody = { ...result };
delete responseBody.refreshToken;
    return res.status(200).json(responseBody);
  } catch (error) {
    return next(error);
  }
}

async function refresh(req, res, next) {
  try {
    const rawToken = req.cookies?.rt || readCookieHeader(req.headers.cookie, 'rt');

    const result = await refreshUserSession(rawToken);
    setRefreshCookie(res, result.refreshToken);

    const responseBody = { ...result };
delete responseBody.refreshToken;
    return res.status(200).json(responseBody);
  } catch (error) {
    clearRefreshCookie(res);
    return next(error);
  }
}

function readCookieHeader(header, name) {
  if (typeof header !== 'string') return undefined;

  for (const part of header.split(';')) {
    const separator = part.indexOf('=');
    if (separator < 0) continue;

    const key = part.slice(0, separator).trim();
    const value = part.slice(separator + 1).trim();

    if (key === name) return value;
  }

  return undefined;
}

module.exports = { register, login, refresh };
