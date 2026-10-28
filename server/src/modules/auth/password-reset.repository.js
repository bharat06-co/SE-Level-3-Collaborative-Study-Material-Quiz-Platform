const PasswordResetToken = require('../../models/PasswordResetToken');

async function create(tokenData, options = {}) {
  return PasswordResetToken.create([tokenData], options.session ? { session: options.session } : {});
}

async function findByTokenHash(tokenHash, options = {}) {
  let query = PasswordResetToken.findOne({ tokenHash });

  if (options.session) {
    query = query.session(options.session);
  }

  return query;
}

async function consumeActiveToken(tokenHash, now = new Date(), options = {}) {
  const query = PasswordResetToken.findOneAndUpdate(
    {
      tokenHash,
      usedAt: null,
      expiresAt: { $gt: now },
    },
    {
      $set: { usedAt: now },
    },
    {
      new: true,
      ...(options.session ? { session: options.session } : {}),
    },
  );

  return query;
}

module.exports = {
  create,
  findByTokenHash,
  consumeActiveToken,
};