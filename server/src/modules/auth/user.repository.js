
const User = require('../../models/User');

async function create(userData) {
  return User.create(userData);
}

module.exports = { create };
