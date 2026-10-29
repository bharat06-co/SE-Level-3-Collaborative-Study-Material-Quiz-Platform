const mongoose = require('mongoose');
const { Quiz } = require('../quizzes/quiz.model');
const { getAttemptModel } = require('../attempts/attempt.model');
const User = require('../../models/User');

function createLeaderboardRepository() {
  const Attempt = getAttemptModel();
  return {
    findPublishedQuiz(id) {
      return Quiz.findOne({ _id: id, status: 'published' }).select('_id title topic').lean();
    },
    findPublishedQuizzesByTopic(topic) {
      const escaped = topic.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      return Quiz.find({ status: 'published', topic: new RegExp(`^${escaped}$`, 'i') })
        .select('_id').lean();
    },
    listAttempts(quizIds) {
      if (!quizIds.length) return Promise.resolve([]);
      return Attempt.find({ quizId: { $in: quizIds.map((id) => new mongoose.Types.ObjectId(id)) } })
        .select('quizId studentId score maxScore').lean();
    },
    async studentNames(studentIds) {
      if (!studentIds.length) return new Map();
      const users = await User.find({ _id: { $in: studentIds } }).select('_id name').lean();
      return new Map(users.map((user) => [String(user._id), user.name]));
    },
  };
}

module.exports = { createLeaderboardRepository };
