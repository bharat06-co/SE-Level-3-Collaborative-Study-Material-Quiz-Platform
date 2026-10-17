const { z } = require('zod');
const { AppError } = require('../../utils/AppError');
const { parse } = require('../quizzes/quiz.schemas');
const { leaderboardRepo } = require('./leaderboard.repo');

const querySchema = z.object({
  quizId: z.string().regex(/^[0-9a-fA-F]{24}$/).optional(),
  topic: z.string().trim().min(1).optional(),
}).strict().refine((query) => Boolean(query.quizId) !== Boolean(query.topic), 'Provide exactly one quizId or topic.');

function rank(scores, names = new Map()) {
  const sorted = [...scores].sort((a, b) => b.score - a.score || String(a.studentId).localeCompare(String(b.studentId)));
  let previousScore;
  let previousRank = 0;
  return sorted.map((row, index) => {
    if (row.score !== previousScore) previousRank = index + 1;
    previousScore = row.score;
    const studentId = String(row.studentId);
    return { rank: previousRank, studentId, name: names.get(studentId) || 'Student', score: row.score };
  });
}

// Topic totals are sums of floating-point percentages. Six decimal places
// define a stable score unit for sorting, ties, and the displayed response.
function canonicalTopicScore(score) {
  return Math.round(score * 1_000_000) / 1_000_000;
}

function createLeaderboardService(repo = leaderboardRepo) {
  return {
    async get(query) {
      const { quizId, topic } = parse(querySchema, query);
      let scores;
      if (quizId) {
        const quiz = await repo.findQuiz(quizId);
        if (!quiz || quiz.status !== 'published') throw new AppError(404, 'NOT_FOUND', 'Quiz not found.');
        scores = await repo.quizScores(quizId);
      } else {
        const quizIds = await repo.findPublishedQuizIds(topic);
        scores = (await repo.topicScores(quizIds)).map((row) => ({
          ...row, score: canonicalTopicScore(row.score),
        }));
      }
      const names = await repo.studentNames(scores.map((row) => row.studentId));
      return { mode: quizId ? 'quiz' : 'topic', ...(quizId ? { quizId } : { topic }), items: rank(scores, names) };
    },
  };
}
module.exports = { createLeaderboardService, rank, canonicalTopicScore };
