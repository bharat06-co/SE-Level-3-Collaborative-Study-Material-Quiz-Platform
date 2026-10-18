import { z } from 'zod';
import { http } from '../../api/http';
const id = z.string().min(1).max(128);
const objectId = z.string().regex(/^[a-fA-F0-9]{24}$/);
const question = z.discriminatedUnion('type', [
  z.object({ id, text: z.string().min(1), type: z.literal('mcq'), options: z.array(z.string()).min(2).max(6) }),
  z.object({ id, text: z.string().min(1), type: z.literal('true_false') }),
]);
const quizSchema = z.object({ id: objectId, title: z.string().min(1), topic: z.string(), status: z.literal('published'), allowRetake: z.boolean(), questions: z.array(question).min(1).max(10000) });
const resultSchema = z.object({
  attemptId: objectId, score: z.number().int().nonnegative(), maxScore: z.number().int().positive(),
  percentage: z.number().min(0).max(100), submittedAt: z.string().datetime(),
  results: z.array(z.object({ questionId: id, isCorrect: z.boolean(), unanswered: z.boolean().optional(), correctAnswer: z.union([z.number().int().nonnegative(), z.boolean()]) })),
});
export function parseQuiz(data, quizId) {
  // Project only public fields. Never retain or render answer keys from a quiz GET.
  const quiz = quizSchema.parse(data);
  if (quiz.id.toLowerCase() !== quizId.toLowerCase() || new Set(quiz.questions.map(q => q.id)).size !== quiz.questions.length) throw new Error('Invalid quiz response.');
  return quiz;
}
export function parseAttemptResult(data, quiz) {
  const result = resultSchema.parse(data);
  const byId = new Map(quiz.questions.map(q => [q.id, q]));
  const seen = new Set();
  for (const row of result.results) {
    const q = byId.get(row.questionId);
    if (!q || seen.has(row.questionId) || (row.unanswered && row.isCorrect)) throw new Error('Invalid attempt response.');
    if (q.type === 'mcq' ? !Number.isInteger(row.correctAnswer) || row.correctAnswer >= q.options.length : typeof row.correctAnswer !== 'boolean') throw new Error('Invalid answer feedback.');
    seen.add(row.questionId);
  }
  if (seen.size !== quiz.questions.length || result.maxScore !== quiz.questions.length || result.score !== result.results.filter(row => row.isCorrect).length || result.percentage !== Math.round(result.score / result.maxScore * 1000) / 10) throw new Error('Incomplete attempt response.');
  return result;
}
export async function loadAttemptQuiz(quizId, { signal } = {}) {
  objectId.parse(quizId);
  const response = await http.get(`/quizzes/${quizId}`, { signal });
  return parseQuiz(response.data, quizId);
}
export async function submitAttempt(quizId, answers, { signal } = {}) {
  objectId.parse(quizId);
  const response = await http.post(`/quizzes/${quizId}/attempts`, { answers }, { signal });
  // No auto-retry: a lost response may follow a successful database write.
  return response.data;
}
