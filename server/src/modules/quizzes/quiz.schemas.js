const { z } = require('zod');
const { AppError } = require('../../utils/AppError');

const text = z.string().trim().min(1);
const questionSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('mcq'), text, options: z.array(text).min(2).max(6), answerKey: z.number().int().nonnegative() }).strict(),
  z.object({ type: z.literal('true_false'), text, answerKey: z.boolean() }).strict(),
]).refine((q) => q.type !== 'mcq' || q.answerKey < q.options.length, { path: ['answerKey'], message: 'Answer key must identify an option.' });
const createSchema = z.object({
  title: z.string().trim().min(3).max(120),
  topic: text,
  allowRetake: z.boolean().optional(),
  questions: z.array(questionSchema).optional(),
}).strict();
const updateSchema = createSchema.partial().refine((value) => Object.keys(value).length > 0, 'At least one field is required.');
const idSchema = z.string().regex(/^[0-9a-fA-F]{24}$/);
const listSchema = z.object({
  topic: text.optional(),
  status: z.enum(['draft', 'published']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
}).strict();

function parse(schema, input) {
  const result = schema.safeParse(input);
  if (result.success) return result.data;
  throw new AppError(400, 'VALIDATION_ERROR', 'Invalid quiz data.', result.error.issues.map((issue) => ({
    field: issue.path.join('.') || 'request', message: issue.message,
  })));
}

module.exports = { questionSchema, createSchema, updateSchema, idSchema, listSchema, parse };
