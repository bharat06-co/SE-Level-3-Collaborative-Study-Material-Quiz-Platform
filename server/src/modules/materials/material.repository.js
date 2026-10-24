const { Material } = require('../../models/Material');

function createMaterialRepository({ model = Material } = {}) {
  async function create(document) {
    return model.create(document);
  }

  async function findById(id) {
    return model.findById(id);
  }

  async function list(filter, page = 1, limit = 20, sort = { createdAt: -1 }) {
    const [items, total] = await Promise.all([
      model
        .find(filter)
        .sort({ ...sort, _id: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      model.countDocuments(filter),
    ]);
    return { items, page, limit, total };
  }

  async function updateIfVersion(id, version, updateData) {
    return model.findOneAndUpdate(
      { _id: id, __v: version },
      { $set: updateData, $inc: { __v: 1 } },
      { new: true, runValidators: true },
    );
  }

  return { create, findById, list, updateIfVersion };
}

module.exports = { createMaterialRepository };
