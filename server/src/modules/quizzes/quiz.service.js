const { AppError } = require('../../utils/AppError');
const { createSchema, updateSchema, idSchema, listSchema, questionSchema, parse } = require('./quiz.schemas');
const { quizRepo } = require('./quiz.repo');

function canAuthor(auth) {
  return auth.role === 'admin' || auth.role === 'educator' || (auth.role === 'student' && auth.contributor === true);
}
function requireAuthor(auth) {
  if (!canAuthor(auth)) throw new AppError(403, 'FORBIDDEN', 'Quiz authoring is not permitted.');
}
function owns(quiz, auth) {
  return auth.role === 'admin' || String(quiz.authorId) === String(auth.userId);
}
function publicView(quiz) {
  return {
    id: String(quiz._id), title: quiz.title, topic: quiz.topic, authorId: String(quiz.authorId),
    status: quiz.status, allowRetake: quiz.allowRetake,
    questions: (quiz.questions || []).map((q) => ({
      id: String(q._id), text: q.text, type: q.type, ...(q.type === 'mcq' ? { options: q.options } : {}),
    })),
    createdAt: quiz.createdAt, updatedAt: quiz.updatedAt,
  };
}
function validQuestion(question) {
  return questionSchema.safeParse({
    text: question.text, type: question.type, answerKey: question.answerKey,
    ...(question.type === 'mcq' ? { options: question.options } : {}),
  }).success;
}
function assertVisible(quiz, auth) {
  if (!quiz || (quiz.status !== 'published' && !owns(quiz, auth))) {
    throw new AppError(404, 'NOT_FOUND', 'Quiz not found.');
  }
}
function createQuizService(repo = quizRepo) {
  return {
    async create(auth, body) {
      requireAuthor(auth);
      const data = parse(createSchema, body);
      const quiz = await repo.create({ ...data, authorId: auth.userId, status: 'draft' });
      return publicView(quiz);
    },
    async get(auth, id) {
      const quiz = await repo.findById(parse(idSchema, id));
      assertVisible(quiz, auth);
      return publicView(quiz);
    },
    async list(auth, query) {
      const { topic, status, page, limit } = parse(listSchema, query);
      const filter = { status: 'published' };
      if (topic) filter.topic = new RegExp(`^${topic.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i');
      if (status === 'draft') {
        requireAuthor(auth);
        filter.status = 'draft';
        if (auth.role !== 'admin') filter.authorId = auth.userId;
      }
      const result = await repo.list(filter, page, limit);
      return { ...result, items: result.items.map(publicView) };
    },
    async update(auth, id, body) {
      const validId = parse(idSchema, id);
      const quiz = await repo.findById(validId);
      if (!quiz) throw new AppError(404, 'NOT_FOUND', 'Quiz not found.');
      if (!owns(quiz, auth)) throw new AppError(403, 'FORBIDDEN', 'Only the author or an administrator may change this quiz.');
      const data = parse(updateSchema, body);
      if (quiz.status === 'published' && data.questions && (!data.questions.length || !data.questions.every(validQuestion))) {
        throw new AppError(422, 'QUIZ_NOT_PUBLISHABLE', 'A published quiz needs at least one valid question.');
      }
      return publicView(await repo.updateById(validId, data));
    },
    async publish(auth, id) {
      const validId = parse(idSchema, id);
      const quiz = await repo.findById(validId);
      if (!quiz) throw new AppError(404, 'NOT_FOUND', 'Quiz not found.');
      if (!owns(quiz, auth)) throw new AppError(403, 'FORBIDDEN', 'Only the author or an administrator may change this quiz.');
      if (!quiz.questions?.length || !quiz.questions.every(validQuestion)) {
        throw new AppError(422, 'QUIZ_NOT_PUBLISHABLE', 'Quiz needs at least one valid question.');
      }
      const updated = await repo.updateById(validId, { status: 'published' });
      return { id: String(updated._id), status: updated.status };
    },
    async unpublish(auth, id) {
      const validId = parse(idSchema, id);
      const quiz = await repo.findById(validId);
      if (!quiz) throw new AppError(404, 'NOT_FOUND', 'Quiz not found.');
      if (!owns(quiz, auth)) throw new AppError(403, 'FORBIDDEN', 'Only the author or an administrator may change this quiz.');
      const updated = await repo.updateById(validId, { status: 'draft' });
      return { id: String(updated._id), status: updated.status };
    },
    async remove(auth, id) {
      const validId = parse(idSchema, id);
      const quiz = await repo.findById(validId);
      if (!quiz) throw new AppError(404, 'NOT_FOUND', 'Quiz not found.');
      if (!owns(quiz, auth)) throw new AppError(403, 'FORBIDDEN', 'Only the author or an administrator may change this quiz.');
      await repo.deleteById(validId);
    },
    // Server-only scoring boundary. Never expose this method through an HTTP response.
    async getQuizForScoring(id) {
      const quiz = await repo.findById(parse(idSchema, id));
      if (!quiz || quiz.status !== 'published') {
        throw new AppError(404, 'QUIZ_NOT_AVAILABLE', 'Quiz is not available for attempts.');
      }
      return quiz;
    },
  };
}
module.exports = { createQuizService, publicView };
