
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { readEnv } = require('../../config/env');
const { AppError } = require('../../utils/AppError');
const userRepository = require('./user.repository');

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

async function loginUser(input) {
  const { email, password } = input || {};

  if (
    typeof email !== 'string' ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) ||
    typeof password !== 'string' ||
    password.length === 0
  ) {
    throw new AppError(
      400,
      'VALIDATION_ERROR',
      'A valid email address and password are required.',
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

  const accessToken = jwt.sign(
    {
      role: user.role,
      contributor: user.contributor,
    },
    config.JWT_ACCESS_SECRET,
    {
      algorithm: 'HS256',
      subject: user._id.toString(),
      expiresIn: config.JWT_ACCESS_TTL,
    },
  );

  return {
    accessToken,
    tokenType: 'Bearer',
    expiresIn: config.JWT_ACCESS_TTL,
    user: {
      id: user._id.toString(),
      name: user.name,
      email: user.email,
      role: user.role,
      contributor: user.contributor,
    },
  };
}

module.exports = { registerUser, loginUser };
