const MaterialRevision = require('../../models/MaterialRevision');

function createRevisionRepository({ model = MaterialRevision } = {}) {
  async function nextVersion(materialId) {
    const latest = await model.findOne({ materialId })
      .sort({ versionNo: -1 })
      .select('versionNo')
      .lean();
    return (latest?.versionNo || 0) + 1;
  }

  async function create(revision) {
    return model.create(revision);
  }

  async function listByMaterial(materialId) {
    return model.find({ materialId }).sort({ versionNo: -1 }).lean();
  }

  async function remove(id) {
    return model.deleteOne({ _id: id });
  }

  return { nextVersion, create, listByMaterial, remove };
}

module.exports = { createRevisionRepository };
