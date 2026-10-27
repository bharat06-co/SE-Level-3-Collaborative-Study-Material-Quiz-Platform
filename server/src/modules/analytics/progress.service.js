// FR-034: count each quiz once per topic using the student's highest percentage.
// Percentages are computed from immutable stored scores, never from edited quiz keys.
function round1(n) { return Math.round((n + Number.EPSILON) * 10) / 10; }

function calculateProgress(attempts) {
  const byTopic = new Map();
  const timeline = [];
  for (const row of attempts) {
    if (!Number.isFinite(row.score) || !Number.isFinite(row.maxScore) || row.maxScore <= 0) {
      throw new Error('Stored attempt score is invalid.');
    }
    const topic = typeof row.topic === 'string' && row.topic.trim() ? row.topic.trim().toLowerCase() : 'unknown topic';
    const quizId = String(row.quizId);
    const percentage = row.score / row.maxScore * 100;
    if (!byTopic.has(topic)) byTopic.set(topic, new Map());
    const quizzes = byTopic.get(topic);
    quizzes.set(quizId, Math.max(quizzes.get(quizId) ?? -Infinity, percentage));
    timeline.push({
      attemptId: String(row._id), quizId, quizTitle: row.quizTitle,
      topic, score: row.score, maxScore: row.maxScore,
      percentage: round1(percentage), submittedAt: new Date(row.submittedAt).toISOString(),
    });
  }
  const topics = [...byTopic.entries()].map(([topic, quizzes]) => ({
    topic,
    quizzesAttempted: quizzes.size,
    averageBestPct: round1([...quizzes.values()].reduce((sum, pct) => sum + pct, 0) / quizzes.size),
  })).sort((a, b) => a.topic.localeCompare(b.topic));
  timeline.sort((a, b) => new Date(a.submittedAt) - new Date(b.submittedAt) || a.attemptId.localeCompare(b.attemptId));
  return { topics, timeline };
}

function createProgressService({ repository }) {
  return {
    async getForStudent(studentId) {
      return calculateProgress(await repository.listStudentAttempts(studentId));
    },
  };
}

module.exports = { round1, calculateProgress, createProgressService };
