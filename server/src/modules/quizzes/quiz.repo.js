const { Quiz } = require('./quiz.model');

const quizRepo = {
  create: (data) => Quiz.create(data),
  findById: (id) => Quiz.findById(id).lean(),
  updateById: (id, data) => Quiz.findByIdAndUpdate(id, data, { new: true, runValidators: true }).lean(),
  deleteById: (id) => Quiz.findByIdAndDelete(id).lean(),
  list: async (filter, page, limit) => {
    const [items, total] = await Promise.all([
      Quiz.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
      Quiz.countDocuments(filter),
    ]);
    return { items, page, limit, total };
  },
};
module.exports = { quizRepo };
