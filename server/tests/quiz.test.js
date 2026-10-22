const mongoose = require('mongoose');
const request = require('supertest');
const { createApp } = require('../src/app');
const { createQuizRouter } = require('../src/modules/quizzes/quiz.routes');
const { createQuizService } = require('../src/modules/quizzes/quiz.service');
const { createQuizController } = require('../src/modules/quizzes/quiz.controller');
const { Quiz } = require('../src/modules/quizzes/quiz.model');

const authorId = new mongoose.Types.ObjectId().toString();
const otherId = new mongoose.Types.ObjectId().toString();
const adminId = new mongoose.Types.ObjectId().toString();
const educator = { userId: authorId, role: 'educator', contributor: false };
const contributor = { userId: otherId, role: 'student', contributor: true };
const student = { userId: otherId, role: 'student', contributor: false };
const admin = { userId: adminId, role: 'admin', contributor: false };
const validQuestions = [
  { text: 'What is 2 + 2?', type: 'mcq', options: ['3', '4'], answerKey: 1 },
  { text: 'The sky is blue.', type: 'true_false', answerKey: true },
];

function setup() {
  const records = new Map();
  const repo = {
    async create(data) {
      const quiz = { _id: new mongoose.Types.ObjectId(), __v: 0, ...data,
        allowRetake: data.allowRetake ?? true,
        questions: (data.questions || []).map((q) => ({ _id: new mongoose.Types.ObjectId(), ...q })),
      };
      records.set(String(quiz._id), quiz);
      return quiz;
    },
    async findById(id) { return records.get(String(id)) || null; },
    async updateIfVersion(id, version, data) {
      const quiz = records.get(String(id));
      if (!quiz || quiz.__v !== version) return null;
      Object.assign(quiz, data);
      if (data.questions) quiz.questions = data.questions.map((q) => ({ _id: new mongoose.Types.ObjectId(), ...q }));
      quiz.__v += 1;
      return quiz;
    },
    async deleteById(id) { records.delete(String(id)); },
    async list(filter, page, limit) {
      const items = [...records.values()].filter((q) => q.status === filter.status &&
        (!filter.authorId || String(q.authorId) === String(filter.authorId)) &&
        (!filter.topic || filter.topic.test(q.topic)));
      return { items: items.slice((page - 1) * limit, page * limit), page, limit, total: items.length };
    },
  };
  const service = createQuizService(repo);
  const identities = { [authorId]: educator, [otherId]: contributor, [adminId]: admin };
  const app = createApp({ registerRoutes: (expressApp) => expressApp.use('/api/v1/quizzes', createQuizRouter({
    authenticate(req, res, next) { req.auth = identities[req.get('X-Test-Identity')]; next(); }, controller: createQuizController(service),
  })) });
  // Supertest injects a test-only identity; no client header becomes an identity.
  function as(auth) {
    return (method, path, body) => {
      const agent = request(app)[method](path).set('X-Test-Identity', auth.userId);
      if (body !== undefined) agent.send(body);
      return agent;
    };
  }
  return { app, service, records, identities, as, repo };
}

describe('quiz authoring and security', () => {
  test('application quiz mount fails closed and accepts only injected authentication', async () => {
    const path = '/api/v1/quizzes/not-an-object-id';
    const unauthenticated = await request(createApp()).get(path).set('X-Test-Identity', authorId);
    expect(unauthenticated.status).toBe(401);
    expect(unauthenticated.body.error.code).toBe('UNAUTHENTICATED');

    const authenticatedApp = createApp({
      quizAuthenticate(req, res, next) {
        req.auth = educator;
        next();
      },
    });
    const authenticated = await request(authenticatedApp).get(path);
    expect(authenticated.status).toBe(400);
    expect(authenticated.body.error.code).toBe('VALIDATION_ERROR');
  });

  test('question boundaries and answer keys reject invalid data', async () => {
    const { service } = setup();
    for (const questions of [
      [{ ...validQuestions[0], options: ['only one'] }],
      [{ ...validQuestions[0], options: ['1', '2', '3', '4', '5', '6', '7'] }],
      [{ ...validQuestions[0], answerKey: 2 }],
      [{ text: 'Bad', type: 'mcq', options: ['a', 'b'] }],
      [{ text: 'Bad', type: 'true_false', answerKey: 'yes' }],
      [{ text: 'Bad', type: 'essay', answerKey: 'a' }],
    ]) {
      await expect(service.create(educator, { title: 'Valid title', topic: 'dbms', questions }))
        .rejects.toMatchObject({ statusCode: 400, code: 'VALIDATION_ERROR' });
    }
    const sixOptions = { ...validQuestions[0], options: ['a', 'b', 'c', 'd', 'e', 'f'], answerKey: 5 };
    await expect(service.create(educator, { title: 'Valid title', topic: 'dbms', questions: [sixOptions] }))
      .resolves.toMatchObject({ status: 'draft' });
  });

  test('draft creation, publication gate and answer-key redaction', async () => {
    const { service } = setup();
    const draft = await service.create(educator, { title: 'DBMS basics', topic: 'dbms', questions: validQuestions });
    expect(draft).toMatchObject({ status: 'draft', allowRetake: true, authorId });
    expect(draft.questions).toHaveLength(2);
    expect(JSON.stringify(draft)).not.toMatch(/answerKey|correctAnswer/);
    expect(JSON.stringify(await service.get(educator, draft.id))).not.toMatch(/answerKey|correctAnswer/);
    await expect(service.getQuizForScoring(draft.id)).rejects.toMatchObject({ code: 'QUIZ_NOT_AVAILABLE' });
    await expect(service.get(student, draft.id)).rejects.toMatchObject({ statusCode: 404 });
    await expect(service.publish(contributor, draft.id)).rejects.toMatchObject({ statusCode: 403 });
    expect(await service.publish(educator, draft.id)).toEqual({ id: draft.id, status: 'published' });
    expect((await service.getQuizForScoring(draft.id)).questions[0].answerKey).toBe(1);
    expect(JSON.stringify(await service.get(student, draft.id))).not.toMatch(/answerKey|correctAnswer/);
    expect((await service.list(student, { topic: 'DBMS' })).total).toBe(1);
    expect(await service.unpublish(educator, draft.id)).toEqual({ id: draft.id, status: 'draft' });
    await expect(service.get(student, draft.id)).rejects.toMatchObject({ statusCode: 404 });
  });

  test('ownership and authoring privileges are enforced for edits and deletion', async () => {
    const { service } = setup();
    await expect(service.create(student, { title: 'Valid title', topic: 'dbms' }))
      .rejects.toMatchObject({ statusCode: 403 });
    const draft = await service.create(educator, { title: 'Valid title', topic: 'dbms' });
    await expect(service.publish(educator, draft.id)).rejects.toMatchObject({ statusCode: 422, code: 'QUIZ_NOT_PUBLISHABLE' });
    expect((await service.get(educator, draft.id)).status).toBe('draft');
    await expect(service.update(contributor, draft.id, { title: 'Changed title' })).rejects.toMatchObject({ statusCode: 403 });
    await expect(service.remove(contributor, draft.id)).rejects.toMatchObject({ statusCode: 403 });
    await service.update(admin, draft.id, { questions: validQuestions, allowRetake: false });
    expect((await service.get(educator, draft.id)).allowRetake).toBe(false);
    await service.publish(admin, draft.id);
    await expect(service.update(educator, draft.id, { questions: [] })).rejects.toMatchObject({ statusCode: 422 });
    await service.remove(admin, draft.id);
    await expect(service.get(educator, draft.id)).rejects.toMatchObject({ statusCode: 404 });
  });

  test('creation obeys the RBAC matrix', async () => {
    const { as, records, identities } = setup();
    const path = '/api/v1/quizzes';
    expect((await as(admin)('post', path, { title: 'Admin quiz', topic: 'dbms' })).status).toBe(403);
    expect(records.size).toBe(0);
    expect((await as(educator)('post', path, { title: 'Educator quiz', topic: 'dbms' })).status).toBe(201);
    expect((await as(contributor)('post', path, { title: 'Contributor quiz', topic: 'dbms' })).status).toBe(201);
    identities[otherId] = student;
    expect((await as(student)('post', path, { title: 'Student quiz', topic: 'dbms' })).status).toBe(403);
    expect(records.size).toBe(2);
  });

  test('revoked contributor cannot mutate an owned quiz, while admin may moderate it', async () => {
    const { service, records } = setup();
    const draft = await service.create(contributor, { title: 'Owned quiz', topic: 'dbms', questions: validQuestions });
    const before = JSON.stringify(records.get(draft.id));
    for (const change of [
      () => service.update(student, draft.id, { title: 'Unauthorized edit' }),
      () => service.publish(student, draft.id),
      () => service.unpublish(student, draft.id),
      () => service.remove(student, draft.id),
    ]) {
      await expect(change()).rejects.toMatchObject({ statusCode: 403 });
      expect(JSON.stringify(records.get(draft.id))).toBe(before);
    }
    await service.update(contributor, draft.id, { title: 'Allowed edit' });
    await service.publish(admin, draft.id);
    expect(records.get(draft.id).status).toBe('published');
  });

  test.each(['publish-first', 'edit-first'])('concurrent edit and publish: %s never stores an empty published quiz', async (order) => {
    const { service, repo, records } = setup();
    const draft = await service.create(educator, { title: 'Racing quiz', topic: 'dbms', questions: validQuestions });
    const original = repo.updateIfVersion;
    let release;
    let entered;
    const paused = new Promise((resolve) => { release = resolve; });
    const atWrite = new Promise((resolve) => { entered = resolve; });
    let intercepted = false;
    repo.updateIfVersion = async (id, version, data) => {
      if (!intercepted && (order === 'publish-first' ? data.questions : data.status === 'published')) {
        intercepted = true;
        entered();
        await paused;
      }
      return original(id, version, data);
    };
    const first = order === 'publish-first'
      ? service.update(educator, draft.id, { questions: [] })
      : service.publish(educator, draft.id);
    await atWrite;
    const second = order === 'publish-first'
      ? service.publish(educator, draft.id)
      : service.update(educator, draft.id, { questions: [] });
    await second;
    release();
    await expect(first).rejects.toMatchObject({ statusCode: 422, code: 'QUIZ_NOT_PUBLISHABLE' });
    const stored = records.get(draft.id);
    expect(stored.status === 'published' && stored.questions.length === 0).toBe(false);
  });

  test('model validates persisted question shape and indexed fields', () => {
    const quiz = new Quiz({ title: 'Valid title', topic: 'dbms', authorId, questions: validQuestions });
    expect(quiz.validateSync()).toBeUndefined();
    expect(quiz.questions[0]._id).toBeDefined();
    expect(Quiz.schema.indexes()).toEqual(expect.arrayContaining([[{ topic: 1, status: 1 }, expect.any(Object)]]));
  });

  test('HTTP guards return central errors and never return nested keys', async () => {
    const { app, as, identities } = setup();
    const path = '/api/v1/quizzes';
    expect((await request(app).post(path).send({ title: 'Valid title', topic: 'dbms' })).status).toBe(401);
    identities[otherId] = student;
    const denied = await as(student)('post', path, { title: 'Valid title', topic: 'dbms' });
    expect(denied.status).toBe(403);
    expect(denied.body.error.code).toBe('FORBIDDEN');
    const created = await as(educator)('post', path, { title: 'Valid title', topic: 'dbms', questions: validQuestions });
    expect(created.status).toBe(201);
    expect(JSON.stringify(created.body)).not.toMatch(/answerKey|correctAnswer/);
    const id = created.body.id;
    expect((await as(educator)('post', `${path}/${id}/publish`)).status).toBe(200);
    const detail = await as(student)('get', `${path}/${id}`);
    expect(detail.status).toBe(200);
    expect(JSON.stringify(detail.body)).not.toMatch(/answerKey|correctAnswer/);
    expect((await as(student)('put', `${path}/${id}`, { title: 'New title' })).status).toBe(403);
    expect((await as(student)('delete', `${path}/${id}`)).status).toBe(403);
    expect((await as(student)('get', `${path}/invalid`)).status).toBe(400);
  });
});
