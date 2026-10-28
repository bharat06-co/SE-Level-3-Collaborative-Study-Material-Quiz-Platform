const Comment = require('../../models/Comment');

function createCommentRepository({ model = Comment } = {}) {
  async function create(comment) {
    const created = await model.create(comment);
    return created.populate('userId', 'name');
  }

  async function listByMaterial(materialId, page = 1, limit = 20) {
    const [items, total] = await Promise.all([
      model
        .find({ materialId })
        .sort({ createdAt: 1, _id: 1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate('userId', 'name')
        .lean(),
      model.countDocuments({ materialId }),
    ]);
    return { items, page, limit, total };
  }

  return { create, listByMaterial };
}

module.exports = { createCommentRepository };
