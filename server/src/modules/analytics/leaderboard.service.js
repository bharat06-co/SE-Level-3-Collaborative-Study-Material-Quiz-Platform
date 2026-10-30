const { AppError } = require('../../utils/AppError');
const { createLeaderboardRepository } = require('./leaderboard.repository');

const objectId = /^[0-9a-fA-F]{24}$/;

function invalid(message) {
  throw new AppError(400, 'VALIDATION_ERROR', message);
}

function parseQuery(query) {
  const keys = Object.keys(query);
  if (keys.some((key) => !['quizId', 'topic', 'page', 'limit'].includes(key))) invalid('Unknown leaderboard parameter.');
  const hasQuiz = Object.hasOwn(query, 'quizId');
  const hasTopic = Object.hasOwn(query, 'topic');
  if (hasQuiz === hasTopic) invalid('Choose exactly one quiz or topic.');
  if (hasQuiz && (typeof query.quizId !== 'string' || !objectId.test(query.quizId))) invalid('Invalid quiz ID.');
  if (hasTopic && (typeof query.topic !== 'string' || !query.topic.trim() || query.topic.trim().length > 100)) {
    invalid('Invalid topic.');
  }
  const topic = hasTopic ? query.topic.trim() : undefined;
  function positiveInteger(value, fallback, max) {
    if (value === undefined) return fallback;
    if (typeof value !== 'string' || !/^[1-9]\d*$/.test(value)) invalid('Invalid leaderboard page or limit.');
    const number = Number(value);
    if (!Number.isSafeInteger(number) || number > max) invalid('Invalid leaderboard page or limit.');
    return number;
  }
  return {
    quizId: hasQuiz ? query.quizId.toLowerCase() : undefined,
    topic,
    page: positiveInteger(query.page, 1, Number.MAX_SAFE_INTEGER),
    limit: positiveInteger(query.limit, 20, 50),
  };
}

function competitionRanks(rows, scoreKey) {
  let previousScore;
  let previousRank = 0;
  return rows.map((row, index) => {
    const score = row[scoreKey];
    const rank = index > 0 && score === previousScore ? previousRank : index + 1;
    previousScore = score;
    previousRank = rank;
    return { ...row, rank };
  });
}

function quizScores(attempts) {
  const best = new Map();
  for (const attempt of attempts) {
    const id = String(attempt.studentId);
    best.set(id, Math.max(best.get(id) ?? -Infinity, attempt.score));
  }
  const rows = [...best].map(([studentId, score]) => ({ studentId, score }));
  rows.sort((a, b) => b.score - a.score || a.studentId.localeCompare(b.studentId));
  return competitionRanks(rows, 'score');
}

function topicScores(attempts) {
  const bestByStudent = new Map();
  for (const attempt of attempts) {
    if (!Number.isFinite(attempt.maxScore) || attempt.maxScore <= 0) throw new Error('Stored attempt has invalid maxScore.');
    const studentId = String(attempt.studentId);
    const quizId = String(attempt.quizId);
    if (!bestByStudent.has(studentId)) bestByStudent.set(studentId, new Map());
    const bestByQuiz = bestByStudent.get(studentId);
    const percentage = attempt.score / attempt.maxScore * 100;
    bestByQuiz.set(quizId, Math.max(bestByQuiz.get(quizId) ?? -Infinity, percentage));
  }
  const rows = [...bestByStudent].map(([studentId, quizzes]) => ({
    studentId,
    rankingScore: Math.round([...quizzes.values()].reduce((sum, pct) => sum + pct, 0) * 1e6) / 1e6,
  }));
  rows.sort((a, b) => b.rankingScore - a.rankingScore || a.studentId.localeCompare(b.studentId));
  return competitionRanks(rows, 'rankingScore');
}

function createLeaderboardService(repository = createLeaderboardRepository()) {
  return {
    async list(query) {
      const { quizId, topic, page, limit } = parseQuery(query);
      let quizzes;
      let scope;
      if (quizId) {
        const quiz = await repository.findPublishedQuiz(quizId);
        if (!quiz) throw new AppError(404, 'NOT_FOUND', 'Published quiz not found.');
        quizzes = [quiz];
        scope = { quizId, title: quiz.title };
      } else {
        quizzes = await repository.findPublishedQuizzesByTopic(topic);
        scope = { topic };
      }
      const attempts = await repository.listAttempts(quizzes.map((quiz) => String(quiz._id)));
      const rows = quizId ? quizScores(attempts) : topicScores(attempts);
      const items = rows.slice((page - 1) * limit, page * limit);
      const names = await repository.studentNames(items.map((item) => item.studentId));
      return {
        ...scope, page, limit, total: rows.length,
        items: items.map((item) => ({ ...item, studentName: names.get(item.studentId) || 'Unknown student' })),
      };
    },
  };
}

module.exports = { parseQuery, competitionRanks, quizScores, topicScores, createLeaderboardService };
