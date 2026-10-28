const { z } = require('zod');
const { AppError } = require('../../utils/AppError');
const { validatePlainText } = require('../../utils/plainText');

const createCommentSchema = z.object({
  content: z.string(),
}).strict();

const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
}).strict();

function validationDetails(zodError) {
  return zodError.issues.map((issue) => ({
    field: issue.path.join('.') || 'request',
    message: issue.message,
  }));
}

function commentView(comment) {
  const author = comment.userId && typeof comment.userId === 'object' && comment.userId.name !== undefined
    ? { id: comment.userId._id.toString(), name: comment.userId.name }
    : { id: String(comment.userId), name: '' };

  return {
    id: comment._id.toString(),
    materialId: comment.materialId.toString(),
    content: comment.content,
    author,
    createdAt: comment.createdAt,
  };
}

function createCommentService({ repository, materialService } = {}) {
  if (!repository || !materialService) {
    throw new Error('Comment service requires a repository and the material service.');
  }

  async function listComments(auth, materialId, queryInput) {
    await materialService.getMaterial(auth, materialId);

    const parsed = listQuerySchema.safeParse(queryInput || {});
    if (!parsed.success) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Validation failed.', validationDetails(parsed.error));
    }

    const result = await repository.listByMaterial(materialId, parsed.data.page, parsed.data.limit);
    return {
      items: result.items.map(commentView),
      page: result.page,
      limit: result.limit,
      total: result.total,
    };
  }

  async function addComment(auth, materialId, input) {
    await materialService.getMaterial(auth, materialId);

    const parsed = createCommentSchema.safeParse(input);
    if (!parsed.success) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Validation failed.', validationDetails(parsed.error));
    }

    const content = validatePlainText(parsed.data.content, {
      field: 'content',
      minLength: 1,
      maxLength: 1000,
    });
    const comment = await repository.create({
      materialId,
      userId: auth.userId,
      content,
    });
    return commentView(comment);
  }

  return { listComments, addComment };
}

module.exports = { createCommentService };
