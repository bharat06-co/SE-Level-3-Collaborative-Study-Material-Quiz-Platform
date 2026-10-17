const mongoose = require('mongoose');
const { Quiz } = require('../quizzes/quiz.model');

function attempts() { return mongoose.connection.db.collection('attempts'); }
function users() { return mongoose.connection.db.collection('users'); }

const leaderboardRepo = {
  findQuiz: (id) => Quiz.findById(id).lean(),
  findPublishedQuizIds: async (topic) => {
    const escaped = topic.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const quizzes = await Quiz.find({ status: 'published', topic: new RegExp(`^${escaped}$`, 'i') }, { _id: 1 }).lean();
    return quizzes.map((quiz) => quiz._id);
  },
  quizScores: async (quizId) => attempts().aggregate([
    { $match: { quizId: new mongoose.Types.ObjectId(quizId) } },
    { $group: { _id: '$studentId', score: { $max: '$score' } } },
    { $project: { _id: 0, studentId: '$_id', score: 1 } },
  ]).toArray(),
  topicScores: async (quizIds) => {
    if (!quizIds.length) return [];
    return attempts().aggregate([
      { $match: { quizId: { $in: quizIds }, maxScore: { $gt: 0 } } },
      { $group: { _id: { studentId: '$studentId', quizId: '$quizId' }, bestPercentage: { $max: { $multiply: [{ $divide: ['$score', '$maxScore'] }, 100] } } } },
      { $group: { _id: '$_id.studentId', score: { $sum: '$bestPercentage' } } },
      { $project: { _id: 0, studentId: '$_id', score: 1 } },
    ]).toArray();
  },
  studentNames: async (studentIds) => {
    if (!studentIds.length) return new Map();
    const found = await users().find({ _id: { $in: studentIds } }, { projection: { name: 1 } }).toArray();
    return new Map(found.map((user) => [String(user._id), user.name]));
  },
};
module.exports = { leaderboardRepo };
