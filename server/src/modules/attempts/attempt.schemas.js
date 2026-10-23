const { z } = require('zod');
const { AppError } = require('../../utils/AppError');
const objectId = z.string().regex(/^[a-fA-F0-9]{24}$/, 'Must be a 24-character MongoDB ID.');
const answerSchema = z.object({
  questionId: z.string().min(1).max(128),
  response: z.union([z.number().int().nonnegative(), z.boolean(), z.null()]).optional(),
}).strict();
// Strip client score/student/role fields. Identity and results come only from the server.
const submissionSchema = z.object({ answers: z.array(answerSchema).max(10000) });
function validateSubmission(req, res, next) {
  const params = objectId.safeParse(req.params.quizId);
  const body = submissionSchema.safeParse(req.body);
  if (!params.success || !body.success) {
    const details = [];
    if (!params.success) details.push({ field: 'quizId', message: 'Must be a 24-character MongoDB ID.' });
    if (!body.success) details.push(...body.error.issues.map((issue) => ({ field: issue.path.join('.') || 'body', message: issue.message })));
    return next(new AppError(400, 'VALIDATION_ERROR', 'Invalid attempt submission.', details));
  }
  req.attemptInput = { quizId: params.data.toLowerCase(), answers: body.data.answers };
  next();
}
module.exports = { objectId, submissionSchema, validateSubmission };
