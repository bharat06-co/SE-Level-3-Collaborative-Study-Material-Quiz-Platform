const express = require('express');
const { asyncHandler } = require('../../utils/asyncHandler');

function createModerationRouter({ reportService, authMiddleware } = {}) {
  if (!reportService) throw new Error('Moderation router requires a configured report service.');
  if (!authMiddleware) throw new Error('Moderation router requires an auth middleware.');

  const router = express.Router();

  router.post('/materials/:id/reports', authMiddleware, asyncHandler(async (req, res) => {
    const report = await reportService.createReport(req.auth, req.params.id, req.body);
    return res.status(201).json(report);
  }));

  router.get('/admin/reports', authMiddleware, asyncHandler(async (req, res) => {
    const result = await reportService.listReports(req.auth, req.query);
    return res.json(result);
  }));

  router.patch('/admin/reports/:id', authMiddleware, asyncHandler(async (req, res) => {
    const report = await reportService.decideReport(req.auth, req.params.id, req.body);
    if (req.log && typeof req.log.info === 'function') {
      req.log.info({
        event: 'report.decision',
        reportId: report.id,
        decision: req.body?.decision,
        reviewerId: req.auth.userId,
      }, 'Report decision recorded');
    }
    return res.json(report);
  }));

  return router;
}

module.exports = { createModerationRouter };
