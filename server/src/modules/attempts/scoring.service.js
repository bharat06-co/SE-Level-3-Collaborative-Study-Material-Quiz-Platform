const { AppError } = require('../../utils/AppError');
function invalid(field, message) {
  throw new AppError(400, 'VALIDATION_ERROR', 'Invalid quiz answers.', [{ field, message }]);
}
function assertScorableQuestions(questions) {
  if (!Array.isArray(questions) || questions.length === 0) throw new Error('Published quiz has no scorable questions.');
  const seen = new Set();
  for (const question of questions) {
    if (!question || question._id == null) throw new Error('Published quiz has invalid question data.');
    const id = String(question._id);
    if (!id || seen.has(id)) throw new Error('Published quiz has invalid question data.');
    seen.add(id);
    const mcq = question.type === 'mcq' && Array.isArray(question.options) && question.options.length >= 2 && question.options.length <= 6 && Number.isInteger(question.answerKey) && question.answerKey >= 0 && question.answerKey < question.options.length;
    const tf = question.type === 'true_false' && typeof question.answerKey === 'boolean';
    if (!mcq && !tf) throw new Error('Published quiz has invalid question data.');
  }
}
function scoreAnswers(questions, answers) {
  assertScorableQuestions(questions);
  const byId = new Map(questions.map((question) => [String(question._id), question]));
  const submitted = new Map();
  answers.forEach((answer, index) => {
    const question = byId.get(answer.questionId);
    if (!question) invalid(`answers.${index}.questionId`, 'Question does not belong to this quiz.');
    if (submitted.has(answer.questionId)) invalid(`answers.${index}.questionId`, 'Duplicate question ID.');
    const response = answer.response ?? null;
    if (response !== null) {
      if (question.type === 'mcq' && (!Number.isInteger(response) || response < 0 || response >= question.options.length)) invalid(`answers.${index}.response`, 'MCQ response must be a valid option index.');
      if (question.type === 'true_false' && typeof response !== 'boolean') invalid(`answers.${index}.response`, 'True/false response must be a Boolean.');
    }
    submitted.set(answer.questionId, response);
  });
  const storedAnswers = questions.map((question) => {
    const questionId = String(question._id);
    const response = submitted.get(questionId) ?? null;
    const unanswered = response === null;
    return { questionId, response, isCorrect: !unanswered && response === question.answerKey, unanswered, correctAnswer: question.answerKey };
  });
  const score = storedAnswers.reduce((total, answer) => total + Number(answer.isCorrect), 0);
  const maxScore = questions.length;
  const results = storedAnswers.map(({ questionId, isCorrect, unanswered, correctAnswer }) => ({ questionId, isCorrect, ...(unanswered ? { unanswered: true } : {}), correctAnswer }));
  return { score, maxScore, percentage: Math.round((score / maxScore) * 1000) / 10, storedAnswers, results };
}
module.exports = { scoreAnswers };
