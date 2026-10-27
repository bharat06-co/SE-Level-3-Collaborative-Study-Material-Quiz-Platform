const { calculateProgress } = require('../src/modules/analytics/progress.service');
const date = (day) => `2026-10-${String(day).padStart(2, '0')}T08:00:00.000Z`;
function attempt(id, quizId, topic, score, maxScore, day) {
  return { _id: id, quizId, quizTitle: `Quiz ${quizId}`, topic, score, maxScore, submittedAt: date(day) };
}
describe('FR-034 pure topic progress (TC-ANL-01–05)', () => {
  test('empty progress', () => {
    expect(calculateProgress([])).toEqual({ topics: [], timeline: [] });
  });
  test('only highest percentage for each quiz contributes; timeline retains every attempt', () => {
    const data = calculateProgress([
      attempt('a', 'q1', 'DBMS', 2, 5, 3),
      attempt('b', 'q1', 'dbms', 4, 5, 4),
      attempt('c', 'q2', 'dbms', 3, 5, 5),
      attempt('d', 'q3', 'OS', 1, 2, 6),
      attempt('e', 'q3', 'os', 2, 2, 7),
    ]);
    expect(data.topics).toEqual([
      { topic: 'dbms', quizzesAttempted: 2, averageBestPct: 70 },
      { topic: 'os', quizzesAttempted: 1, averageBestPct: 100 },
    ]);
    expect(data.timeline.map((x) => x.attemptId)).toEqual(['a', 'b', 'c', 'd', 'e']);
  });
  test('2/3 and 1/3 in different quizzes yield 50.0 average', () => {
    expect(calculateProgress([attempt('1', 'q1', 'dbms', 2, 3, 3), attempt('2', 'q2', 'dbms', 1, 3, 4)]).topics[0].averageBestPct).toBe(50);
  });
  test('unsorted input yields time-ordered timeline', () => {
    const result = calculateProgress([attempt('2', 'q2', 'dbms', 1, 2, 5), attempt('1', 'q1', 'dbms', 1, 2, 3)]);
    expect(result.timeline.map((x) => x.attemptId)).toEqual(['1', '2']);
  });
  test('rejects broken stored score, instead of producing fake progress', () => {
    expect(() => calculateProgress([attempt('1', 'q1', 'dbms', 2, 0, 3)])).toThrow();
  });
});
