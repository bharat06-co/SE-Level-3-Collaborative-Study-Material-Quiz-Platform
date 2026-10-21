
const User = require('../../models/User');

async function create(userData) {
  return User.create(userData);
}

async function findByEmail(email) {
  return User.findOne({ email }).select('+passwordHash');
}

async function findById(id, options = {}) {
  let query = User.findById(id);

  if (options.session) {
    query = query.session(options.session);
  }

  return query;
}

module.exports = { create, findByEmail, findById };
