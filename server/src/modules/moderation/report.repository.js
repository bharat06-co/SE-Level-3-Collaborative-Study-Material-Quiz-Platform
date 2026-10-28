const { MaterialReport } = require('../../models/MaterialReport');

function createReportRepository({ model = MaterialReport } = {}) {
  async function create(report) {
    return model.create(report);
  }

  async function findById(id) {
    return model.findById(id).populate('materialId', 'title');
  }

  async function findOpenByReporter(materialId, reporterId) {
    return model.findOne({ materialId, reporterId, status: 'open' });
  }

  async function countByReporterSince(reporterId, since) {
    return model.countDocuments({ reporterId, createdAt: { $gte: since } });
  }

  async function listByStatus(status) {
    return model.find({ status })
      .sort({ createdAt: 1, _id: 1 })
      .populate('materialId', 'title')
      .populate('reporterId', 'name')
      .populate('reviewerId', 'name')
      .lean();
  }

  async function countOtherBlocking(materialId, excludeId) {
    return model.countDocuments({
      materialId,
      status: { $in: ['open', 'actioned'] },
      _id: { $ne: excludeId },
    });
  }

  async function decide(id, update) {
    return model.findOneAndUpdate(
      { _id: id, status: 'open' },
      { $set: update },
      { new: true },
    ).populate('materialId', 'title');
  }

  async function remove(id) {
    return model.deleteOne({ _id: id });
  }

  return {
    create,
    findById,
    findOpenByReporter,
    countByReporterSince,
    listByStatus,
    countOtherBlocking,
    decide,
    remove,
  };
}

module.exports = { createReportRepository };
