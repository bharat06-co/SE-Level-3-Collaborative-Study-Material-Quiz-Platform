
const express = require('express');
const {
  getOwnProfile,
  updateOwnProfile,
} = require('./profile.controller');

function createProfileRouter({ authenticate }) {
  const router = express.Router();

  router.use(authenticate);
  router.get('/', getOwnProfile);
  router.patch('/', updateOwnProfile);

  return router;
}

module.exports = { createProfileRouter };
