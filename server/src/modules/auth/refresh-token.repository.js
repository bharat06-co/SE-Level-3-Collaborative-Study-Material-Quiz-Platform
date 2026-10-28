const RefreshToken = require('../../models/RefreshToken');

async function create(tokenData, options = {}) {
  return RefreshToken.create([tokenData], options).then((docs) => docs[0]);
}

async function findByTokenHash(tokenHash) {
  return RefreshToken.findOne({ tokenHash });
}

async function revokeById(id, revokedAt = new Date()) {
  return RefreshToken.findOneAndUpdate(
    { _id: id, revokedAt: null },
    { $set: { revokedAt } },
    { new: true },
  );
}

async function revokeAllByUserId(userId, revokedAt = new Date(), options = {}) {
  return RefreshToken.updateMany(
    { userId, revokedAt: null },
    { $set: { revokedAt } },
    options.session ? { session: options.session } : {},
  );
}

async function consumeActiveToken(id, now = new Date(), options = {}) {
  return RefreshToken.findOneAndUpdate(
    {
      _id: id,
      revokedAt: null,
      expiresAt: { $gt: now },
    },
    { $set: { revokedAt: now } },
    { new: true, ...options },
  );
}

module.exports = {
  create,
  findByTokenHash,
  revokeById,
  revokeAllByUserId,
  consumeActiveToken,
};