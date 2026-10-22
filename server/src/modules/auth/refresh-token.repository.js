
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
  consumeActiveToken,
};
