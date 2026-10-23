export const quizId = 'aaaaaaaaaaaaaaaaaaaaaaaa';
export function quiz(overrides = {}) {
  return { id: quizId, title: 'Database basics', topic: 'databases', status: 'published', allowRetake: true, questions: [
    { id: 'q1', text: 'Which is a key?', type: 'mcq', options: ['Primary key', 'Wallpaper'] },
    { id: 'q2', text: 'Tables contain no rows.', type: 'true_false' },
    { id: 'q3', text: 'Choose the second option.', type: 'mcq', options: ['First', 'Second'] },
  ], ...overrides };
}
export function result(overrides = {}) {
 return { attemptId: 'bbbbbbbbbbbbbbbbbbbbbbbb', score: 2, maxScore: 3, percentage: 66.7, submittedAt: '2026-10-18T10:00:00.000Z', results: [
   {questionId:'q1',isCorrect:true,correctAnswer:0},
   {questionId:'q2',isCorrect:true,correctAnswer:false},
   {questionId:'q3',isCorrect:false,unanswered:true,correctAnswer:1},
 ], ...overrides };
}
