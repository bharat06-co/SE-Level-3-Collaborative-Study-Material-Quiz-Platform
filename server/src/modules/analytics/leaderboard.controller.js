const { createLeaderboardService } = require('./leaderboard.service');

function createLeaderboardController(service = createLeaderboardService()) {
  return {
    async get(req, res) { res.json(await service.get(req.query)); },
  };
}
module.exports = { createLeaderboardController };
