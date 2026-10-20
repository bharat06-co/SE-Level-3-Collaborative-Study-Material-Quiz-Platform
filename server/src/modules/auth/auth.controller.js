
const { registerUser } = require('./auth.service');

async function register(req, res, next) {
  try {
    const user = await registerUser(req.body || {});
    return res.status(201).json({ user });
  } catch (error) {
    return next(error);
  }
}

module.exports = { register };
