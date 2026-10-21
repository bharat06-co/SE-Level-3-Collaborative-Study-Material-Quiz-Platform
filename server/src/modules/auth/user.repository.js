
const User = require('../../models/User');

async function create(userData) {
  return User.create(userData);
}

async function findById(id) {
  return User.findById(id).select('_id role contributor');
}

module.exports = { create, findById };
