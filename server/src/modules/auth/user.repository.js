
const User = require('../../models/User');

async function create(userData) {
  return User.create(userData);
}

async function findByEmail(email) {
  return User.findOne({ email }).select('+passwordHash');
}

module.exports = { create, findByEmail };
