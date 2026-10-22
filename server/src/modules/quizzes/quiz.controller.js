const { createQuizService } = require('./quiz.service');

function createQuizController(service = createQuizService()) {
  return {
    async create(req, res) { res.status(201).json(await service.create(req.auth, req.body)); },
    async list(req, res) { res.json(await service.list(req.auth, req.query)); },
    async get(req, res) { res.json(await service.get(req.auth, req.params.id)); },
    async update(req, res) { res.json(await service.update(req.auth, req.params.id, req.body)); },
    async remove(req, res) { await service.remove(req.auth, req.params.id); res.status(204).end(); },
    async publish(req, res) { res.json(await service.publish(req.auth, req.params.id)); },
    async unpublish(req, res) { res.json(await service.unpublish(req.auth, req.params.id)); },
  };
}
module.exports = { createQuizController };
