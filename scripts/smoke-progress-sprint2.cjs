const assert = require('node:assert/strict');
const { calculateProgress } = require('../server/src/modules/analytics/progress.service');
function row(id, quizId, topic, score, maxScore, day) {
  return { _id: id, quizId, quizTitle: quizId, topic, score, maxScore, submittedAt: new Date(`2026-10-${day}T09:00:00Z`) };
}
assert.deepEqual(calculateProgress([]), { topics: [], timeline: [] });
const result = calculateProgress([
  row('b', 'q1', 'DBMS', 4, 5, '20'),
  row('a', 'q1', 'dbms', 2, 5, '19'),
  row('c', 'q2', 'dbms', 3, 5, '21'),
  row('d', 'q3', 'OS', 1, 2, '22'),
]);
assert.deepEqual(result.topics, [
  { topic: 'dbms', quizzesAttempted: 2, averageBestPct: 70 },
  { topic: 'os', quizzesAttempted: 1, averageBestPct: 50 },
]);
assert.deepEqual(result.timeline.map((x) => x.attemptId), ['a', 'b', 'c', 'd']);
assert.equal(calculateProgress([row('a', 'q1', 'dbms', 2, 3, '19'), row('b', 'q2', 'dbms', 1, 3, '20')]).topics[0].averageBestPct, 50);
assert.throws(() => calculateProgress([row('a', 'q1', 'dbms', 1, 0, '19')]));
console.log('PASS: 5 local dependency-free progress checks (empty, best-score, multi-topic, timeline, rounding, invalid score)');
