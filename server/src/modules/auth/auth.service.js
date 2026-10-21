
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('node:crypto');
const mongoose = require('mongoose');
const { readEnv } = require('../../config/env');
const { AppError } = require('../../utils/AppError');
const userRepository = require('./user.repository');
const refreshTokenRepository = require('./refresh-token.repository');

const REFRESH_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function createOpaqueRefreshToken() {
  return crypto.randomBytes(32).toString('base64url');
}

function hashRefreshToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function getAccessTokenExpirySeconds(ttl) {
  const match = /^([1-9]\d*)(s|m|h|d)$/.exec(ttl);

  if (!match) {
    throw new AppError(
      503,
      'SERVICE_UNAVAILABLE',
      'Authentication service is unavailable.',
    );
  }

  const units = { s: 1, m: 60, h: 3600, d: 86400 };
  const seconds = Number(match[1]) * units[match[2]];

  if (!Number.isSafeInteger(seconds) || seconds <= 0) {
    throw new AppError(
      503,
      'SERVICE_UNAVAILABLE',
      'Authentication service is unavailable.',
    );
  }

  return seconds;
}

function validateRegistration({ name, email, password }) {
  if (
    typeof name !== 'string' ||
    name.trim().length < 2 ||
    name.trim().length > 60
  ) {
    throw new AppError(
      400,
      'VALIDATION_ERROR',
      'Name must be between 2 and 60 characters.',
    );
  }

  if (
    typeof email !== 'string' ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
  ) {
    throw new AppError(
      400,
      'VALIDATION_ERROR',
      'A valid email address is required.',
    );
  }

  if (
    typeof password !== 'string' ||
    password.length < 8 ||
    !/[A-Za-z]/.test(password) ||
    !/[0-9]/.test(password)
  ) {
    throw new AppError(
      400,
      'VALIDATION_ERROR',
      'Password must contain at least 8 characters, including a letter and a digit.',
    );
  }

  if (Buffer.byteLength(password, 'utf8') > 72) {
    throw new AppError(
      400,
      'VALIDATION_ERROR',
      'Password must not exceed 72 bytes when encoded as UTF-8.',
    );
  }
}

async function registerUser(input) {
  validateRegistration(input);

  const name = input.name.trim();
  const email = input.email.trim().toLowerCase();
  const passwordHash = await bcrypt.hash(input.password, 12);

  try {
    const user = await userRepository.create({
      name,
      email,
      passwordHash,
      role: 'student',
      contributor: false,
    });

    return {
      id: user._id.toString(),
      name: user.name,
      email: user.email,
      role: user.role,
      contributor: user.contributor,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  } catch (error) {
    if (error.code === 11000 && error.keyPattern?.email) {
      throw new AppError(
        409,
        'EMAIL_TAKEN',
        'An account with this email already exists.',
      );
    }

    throw error;
  }
}

function signAccessToken(user, config) {
  const expiresIn = getAccessTokenExpirySeconds(config.JWT_ACCESS_TTL);
  const accessToken = jwt.sign(
    { role: user.role, contributor: user.contributor },
    config.JWT_ACCESS_SECRET,
    {
      algorithm: 'HS256',
      subject: user._id.toString(),
      expiresIn: config.JWT_ACCESS_TTL,
    },
  );

  return { accessToken, expiresIn };
}

async function createRefreshToken(userId, session = null) {
  const token = createOpaqueRefreshToken();
  const now = new Date();

  await refreshTokenRepository.create(
    {
      userId,
      tokenHash: hashRefreshToken(token),
      expiresAt: new Date(now.getTime() + REFRESH_TOKEN_TTL_MS),
      revokedAt: null,
    },
    session ? { session } : {},
  );

  return token;
}

async function loginUser(input) {
  const { email, password } = input || {};

  if (
    typeof email !== 'string' ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) ||
    typeof password !== 'string' ||
    password.length === 0 ||
    Buffer.byteLength(password, 'utf8') > 72
  ) {
    throw new AppError(
      400,
      'VALIDATION_ERROR',
      'A valid email address and password are required. Passwords must not exceed 72 UTF-8 bytes.',
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

  const user = await userRepository.findByEmail(email.trim().toLowerCase());

  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    throw new AppError(
      401,
      'INVALID_CREDENTIALS',
      'Email or password is incorrect.',
    );
  }

  const { accessToken, expiresIn } = signAccessToken(user, config);
  const refreshToken = await createRefreshToken(user._id);

  return {
    accessToken,
    tokenType: 'Bearer',
    expiresIn,
    refreshToken,
    user: {
      id: user._id.toString(),
      name: user.name,
      email: user.email,
      role: user.role,
      contributor: user.contributor,
    },
  };
}

async function refreshUserSession(rawToken) {
  if (typeof rawToken !== 'string' || rawToken.length === 0) {
    throw new AppError(401, 'INVALID_REFRESH_TOKEN', 'Refresh token is invalid.');
  }

  const config = readEnv();

  if (!config.JWT_ACCESS_SECRET) {
    throw new AppError(
      503,
      'SERVICE_UNAVAILABLE',
      'Authentication is temporarily unavailable.',
    );
  }

  const existing = await refreshTokenRepository.findByTokenHash(
    hashRefreshToken(rawToken),
  );
  const now = new Date();

  if (!existing) {
    throw new AppError(401, 'INVALID_REFRESH_TOKEN', 'Refresh token is invalid.');
  }

  if (existing.revokedAt) {
    throw new AppError(401, 'INVALID_REFRESH_TOKEN', 'Refresh token is invalid.');
  }

  if (existing.expiresAt <= now) {
    throw new AppError(401, 'INVALID_REFRESH_TOKEN', 'Refresh token is invalid.');
  }

  const session = await mongoose.startSession();
  let result;

  try {
    await session.withTransaction(async () => {
      const consumed = await refreshTokenRepository.consumeActiveToken(
        existing._id,
        new Date(),
        { session },
      );

      if (!consumed) {
        throw new AppError(
          401,
          'INVALID_REFRESH_TOKEN',
          'Refresh token is invalid.',
        );
      }

      const user = await userRepository.findById(existing.userId, { session });

      if (!user) {
        throw new AppError(
          401,
          'INVALID_REFRESH_TOKEN',
          'Refresh token is invalid.',
        );
      }

      const { accessToken, expiresIn } = signAccessToken(user, config);
      const refreshToken = await createRefreshToken(user._id, session);

      result = {
        accessToken,
        tokenType: 'Bearer',
        expiresIn,
        refreshToken,
        user: {
          id: user._id.toString(),
          name: user.name,
          email: user.email,
          role: user.role,
          contributor: user.contributor,
        },
      };
    });
  } finally {
    await session.endSession();
  }

  return result;
}

module.exports = {
  registerUser,
  loginUser,
  refreshUserSession,
};
