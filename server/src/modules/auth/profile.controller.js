
const User = require('../../models/User');
const { AppError } = require('../../utils/AppError');

const SAFE_PROFILE_FIELDS = '_id name email role contributor createdAt updatedAt';

async function getOwnProfile(req, res, next) {
  try {
    const user = await User.findById(req.auth.userId)
      .select(SAFE_PROFILE_FIELDS)
      .lean();

    if (!user) {
      throw new AppError(404, 'NOT_FOUND', 'User not found.');
    }

    return res.json({ user });
  } catch (error) {
    return next(error);
  }
}

async function updateOwnProfile(req, res, next) {
  try {
    const body = req.body;

    if (
      !body ||
      typeof body !== 'object' ||
      Array.isArray(body)
    ) {
      throw new AppError(
        400,
        'VALIDATION_ERROR',
        'Provide valid profile details.',
      );
    }

    const keys = Object.keys(body);
    const allowedFields = ['name', 'email'];

    if (
      keys.length === 0 ||
      keys.some((key) => !allowedFields.includes(key))
    ) {
      throw new AppError(
        400,
        'VALIDATION_ERROR',
        'Only name and email can be updated.',
      );
    }

    const updates = {};

    if (Object.hasOwn(body, 'name')) {
      if (
        typeof body.name !== 'string' ||
        body.name.trim().length < 2 ||
        body.name.trim().length > 60
      ) {
        throw new AppError(
          400,
          'VALIDATION_ERROR',
          'Name must be between 2 and 60 characters.',
        );
      }

      updates.name = body.name.trim();
    }

    if (Object.hasOwn(body, 'email')) {
      if (typeof body.email !== 'string') {
        throw new AppError(
          400,
          'VALIDATION_ERROR',
          'Provide a valid email address.',
        );
      }

      const email = body.email.trim().toLowerCase();

      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        throw new AppError(
          400,
          'VALIDATION_ERROR',
          'Provide a valid email address.',
        );
      }

      updates.email = email;
    }

    let user;

    try {
      user = await User.findByIdAndUpdate(
        req.auth.userId,
        { $set: updates },
        { new: true, runValidators: true },
      )
        .select(SAFE_PROFILE_FIELDS)
        .lean();
    } catch (error) {
      if (error.code === 11000) {
        throw new AppError(
          409,
          'CONFLICT',
          'That email address is already in use.',
        );
      }

      throw error;
    }

    if (!user) {
      throw new AppError(404, 'NOT_FOUND', 'User not found.');
    }

    return res.json({ user });
  } catch (error) {
    return next(error);
  }
}

module.exports = { getOwnProfile, updateOwnProfile };
