
const { registerUser, loginUser } = require('./auth.service');

async function register(req, res, next) {
  try {
    const user = await registerUser(req.body || {});
    return res.status(201).json({ user });
  } catch (error) {
    return next(error);
  }
}

async function login(req, res, next) {
  try {
    const result = await loginUser(req.body || {});
    return res.status(200).json(result);
  } catch (error) {
    return next(error);
  }
}

module.exports = { register, login };
