
const jwt = require('jsonwebtoken');
const { readEnv } = require('../config/env');
const { AppError } = require('../utils/AppError');
const userRepository = require('../modules/auth/user.repository');

function createAuthenticate({ findUserById = userRepository.findById } = {}) {
  return async function authenticate(req, res, next) {
    try {
      const authorization = req.get('authorization');

      if (typeof authorization !== 'string') {
        throw new AppError(
          401,
          'UNAUTHENTICATED',
          'Authentication is required.',
        );
      }

      const match = /^Bearer ([^\s]+)$/i.exec(authorization);

      if (!match) {
        throw new AppError(
          401,
          'UNAUTHENTICATED',
          'Authentication is required.',
        );
      }

      const config = readEnv();

      if (!config.JWT_ACCESS_SECRET) {
        throw new AppError(
          503,
          'SERVICE_UNAVAILABLE',
          'Authentication is temporarily unavailable.',
        );
      }

      let payload;

      try {
        payload = jwt.verify(match[1], config.JWT_ACCESS_SECRET, {
          algorithms: ['HS256'],
        });
      } catch {
        throw new AppError(
          401,
          'TOKEN_INVALID',
          'Authentication token is invalid or expired.',
        );
      }

      if (
        !payload ||
        typeof payload !== 'object' ||
        typeof payload.sub !== 'string' ||
        !/^[a-f\d]{24}$/i.test(payload.sub) ||
        typeof payload.exp !== 'number' ||
        !Number.isFinite(payload.exp)
      ) {
        throw new AppError(
          401,
          'TOKEN_INVALID',
          'Authentication token is invalid or expired.',
        );
      }

      const user = await findUserById(payload.sub);

      if (
        !user ||
        !['student', 'educator', 'admin'].includes(user.role) ||
        typeof user.contributor !== 'boolean'
      ) {
        throw new AppError(
          401,
          'TOKEN_INVALID',
          'Authentication is no longer valid.',
        );
      }

      req.auth = {
        userId: user._id.toString(),
        role: user.role,
        contributor: user.contributor,
      };

      return next();
    } catch (error) {
      return next(error);
    }
  };
}

module.exports = {
  createAuthenticate,
};
