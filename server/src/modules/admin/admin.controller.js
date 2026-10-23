const mongoose = require('mongoose');
const User = require('../../models/User');
const { AppError } = require('../../utils/AppError');

const VALID_ROLES = ['student', 'educator', 'admin'];

async function listUsers(req, res, next) {
  try {
    const users = await User.find({})
      .select('_id name email role contributor createdAt updatedAt')
      .sort({ createdAt: -1 })
      .lean();

    return res.json({ users });
  } catch (error) {
    return next(error);
  }
}

async function updateUserRole(req, res, next) {
  try {
    const { id } = req.params;
    const { role, contributor } = req.body || {};

    if (!mongoose.isValidObjectId(id)) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Invalid user ID.');
    }

    if (
      role === undefined &&
      contributor === undefined
    ) {
      throw new AppError(
        400,
        'VALIDATION_ERROR',
        'Provide role or contributor to update.',
      );
    }

    if (role !== undefined && !VALID_ROLES.includes(role)) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Invalid role.');
    }

    if (
      contributor !== undefined &&
      typeof contributor !== 'boolean'
    ) {
      throw new AppError(
        400,
        'VALIDATION_ERROR',
        'Contributor must be a Boolean.',
      );
    }

    const updates = {};
    if (role !== undefined) updates.role = role;
    if (contributor !== undefined) updates.contributor = contributor;

    const user = await User.findByIdAndUpdate(
      id,
      { $set: updates },
      {
        new: true,
        runValidators: true,
      },
    )
      .select('_id name email role contributor createdAt updatedAt')
      .lean();

    if (!user) {
      throw new AppError(404, 'NOT_FOUND', 'User not found.');
    }

    return res.json({ user });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  listUsers,
  updateUserRole,
};