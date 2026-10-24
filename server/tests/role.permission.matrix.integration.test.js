const os = require('node:os');
const path = require('node:path');
const fs = require('node:fs/promises');
const crypto = require('node:crypto');
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const request = require('supertest');
const { MongoMemoryReplSet } = require('mongodb-memory-server');
const { createApp } = require('../src/app');
const { createAuthenticatedFeatures } = require('../src/config/features');
const User = require('../src/models/User');
const RefreshToken = require('../src/models/RefreshToken');
const { Material } = require('../src/models/Material');
const { Quiz } = require('../src/modules/quizzes/quiz.model');
const { getAttemptModel } = require('../src/modules/attempts/attempt.model');

jest.setTimeout(120000);

// Real login tokens + production feature wiring; only accounts/domain data are fixtures.
// No identity injection, mocked authorization or production data is used.
describe('SEC-003 implemented-endpoint permission matrix', () => {
  let mongo;
  let app;
  let storageDir;
  let Attempt;
  let draft;
  let published;
  let material;
  const users = {};
  const tokens = {};
  const actors = ['student', 'contributor', 'educator', 'otherEducator', 'admin'];
  const envKeys = ['MONGODB_URI', 'JWT_ACCESS_SECRET', 'JWT_ACCESS_TTL'];
  const previous = Object.fromEntries(envKeys.map(key => [key, process.env[key]]));
  const password = 'MatrixReview123!';
  const pdf = Buffer.from('%PDF-1.7\nSynthetic permission fixture');
  const quizBody = {
    title: 'Permission matrix quiz', topic: 'dbms', allowRetake: true,
    questions: [{ text: 'Choose A', type: 'mcq', options: ['A', 'B'], answerKey: 0 }],
  };

  beforeAll(async () => {
    mongo = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
    process.env.MONGODB_URI = mongo.getUri();
    process.env.JWT_ACCESS_SECRET = 'isolated-sec003-matrix-secret-'.repeat(4);
    process.env.JWT_ACCESS_TTL = '1h';
    await mongoose.connect(mongo.getUri());
    Attempt = getAttemptModel();
    await Promise.all([User.init(), RefreshToken.init(), Quiz.init(), Material.init(), Attempt.init()]);
    storageDir = await fs.mkdtemp(path.join(os.tmpdir(), 'sec003-matrix-'));
    app = createApp({ storageDir, databaseIsConnected: () => true, ...createAuthenticatedFeatures() });
    const passwordHash = await bcrypt.hash(password, 10);
    for (const actor of actors) {
      users[actor] = await User.create({
        name: actor, email: `${actor.toLowerCase()}@matrix.example`, passwordHash,
        role: actor === 'contributor' ? 'student' : actor === 'otherEducator' ? 'educator' : actor,
        contributor: actor === 'contributor',
      });
      const login = await request(app).post('/api/v1/auth/login').send({ email: users[actor].email, password });
      expect(login.status).toBe(200);
      tokens[actor] = login.body.accessToken;
    }
  });

  beforeEach(async () => {
    await Promise.all([Quiz.deleteMany({}), Material.deleteMany({}), Attempt.deleteMany({})]);
    for (const actor of actors) {
      await User.findByIdAndUpdate(users[actor]._id, {
        role: actor === 'contributor' ? 'student' : actor === 'otherEducator' ? 'educator' : actor,
        contributor: actor === 'contributor',
      });
    }
    await fs.rm(storageDir, { recursive: true, force: true });
    await fs.mkdir(storageDir, { recursive: true });
    draft = await Quiz.create({ ...quizBody, authorId: users.educator._id, status: 'draft' });
    published = await Quiz.create({ ...quizBody, authorId: users.educator._id, status: 'published' });
    material = await Material.create({
      title: 'Private matrix material', description: 'Synthetic fixture', category: 'Notes', topic: 'dbms',
      tags: ['dbms'], ownerId: users.educator._id, visibility: 'private', hidden: false,
      storageKey: 'matrix.pdf', fileUrl: '/fixture', mimeType: 'application/pdf', sizeBytes: pdf.length,
    });
    await fs.writeFile(path.join(storageDir, 'matrix.pdf'), pdf);
  });

  afterAll(async () => {
    try {
      await mongoose.disconnect();
      if (mongo) await mongo.stop();
      if (storageDir) await fs.rm(storageDir, { recursive: true, force: true });
    } finally {
      for (const key of envKeys) {
        if (previous[key] === undefined) delete process.env[key];
        else process.env[key] = previous[key];
      }
    }
  });

  async function snapshot() {
    const database = await Promise.all([User, Quiz, Material, Attempt].map(model => model.find().sort({ _id: 1 }).lean()));
    const files = [];
    for (const name of (await fs.readdir(storageDir)).sort()) {
      files.push([name, crypto.createHash('sha256').update(await fs.readFile(path.join(storageDir, name))).digest('hex')]);
    }
    return JSON.stringify({ database, files });
  }
  function authorized(builder, actor) {
    return actor ? builder.set('Authorization', `Bearer ${tokens[actor]}`) : builder;
  }
  async function deny(build, status = 403, code = 'FORBIDDEN') {
    const before = await snapshot();
    const response = await build();
    expect(response.status).toBe(status);
    expect(response.body.error.code).toBe(code);
    expect(await snapshot()).toBe(before);
  }
  function upload(actor) {
    return authorized(request(app).post('/api/v1/materials'), actor)
      .field('title', 'Matrix uploaded document').field('description', 'Synthetic material')
      .field('category', 'Notes').field('topic', 'dbms').field('tags', 'dbms')
      .field('rightsConfirmed', 'true')
      .attach('file', pdf, { filename: 'matrix.pdf', contentType: 'application/pdf' });
  }

  const protectedOperations = [
    ['admin.list', () => ['get', '/api/v1/admin/users']],
    ['admin.update', () => ['patch', `/api/v1/admin/users/${users.student.id}/role`, { contributor: true }]],
    ['quiz.create', () => ['post', '/api/v1/quizzes', quizBody]],
    ['quiz.list', () => ['get', '/api/v1/quizzes']],
    ['quiz.read', () => ['get', `/api/v1/quizzes/${published.id}`]],
    ['quiz.edit', () => ['put', `/api/v1/quizzes/${draft.id}`, { title: 'Updated quiz title' }]],
    ['quiz.delete', () => ['delete', `/api/v1/quizzes/${draft.id}`]],
    ['quiz.publish', () => ['post', `/api/v1/quizzes/${draft.id}/publish`]],
    ['quiz.unpublish', () => ['post', `/api/v1/quizzes/${published.id}/unpublish`]],
    ['attempt.submit', () => ['post', `/api/v1/quizzes/${published.id}/attempts`, { answers: [] }]],
    ['material.upload', () => ['upload']],
    ['material.list', () => ['get', '/api/v1/materials']],
    ['material.read', () => ['get', `/api/v1/materials/${material.id}`]],
    ['material.download', () => ['get', `/api/v1/materials/${material.id}/file`]],
    ['material.visibility', () => ['patch', `/api/v1/materials/${material.id}`, { visibility: 'public' }]],
    ['material.visibility.alias', () => ['patch', `/api/v1/materials/${material.id}/visibility`, { visibility: 'public' }]],
  ];
  test.each(protectedOperations)('%s: missing and invalid authentication are 401, without stored changes', async (_name, operation) => {
    for (const invalid of [false, true]) {
      await deny(() => {
        const [method, url, body] = operation();
        let builder = method === 'upload' ? upload(null) : request(app)[method](url);
        if (invalid) builder = builder.set('Authorization', 'Bearer not-a-real-token');
        return body ? builder.send(body) : builder;
      }, 401, invalid ? 'TOKEN_INVALID' : 'UNAUTHENTICATED');
    }
  });

  test.each(actors)('admin.list: %s', async actor => {
    const build = () => authorized(request(app).get('/api/v1/admin/users'), actor);
    if (actor !== 'admin') return deny(build);
    const response = await build();
    expect(response.status).toBe(200);
    expect(response.body.users).toHaveLength(actors.length);
    expect(JSON.stringify(response.body)).not.toMatch(/passwordHash|refreshToken/);
  });
  test.each(actors)('admin.update: %s', async actor => {
    const build = () => authorized(request(app).patch(`/api/v1/admin/users/${users.student.id}/role`), actor).send({ contributor: true });
    if (actor !== 'admin') return deny(build);
    expect((await build()).status).toBe(200);
    expect((await User.findById(users.student._id)).contributor).toBe(true);
  });
  test.each(actors)('quiz.create: %s', async actor => {
    const build = () => authorized(request(app).post('/api/v1/quizzes'), actor).send(quizBody);
    if (!['educator', 'otherEducator', 'contributor'].includes(actor)) return deny(build);
    const response = await build();
    expect(response.status).toBe(201);
    expect(String((await Quiz.findById(response.body.id)).authorId)).toBe(users[actor].id);
    expect(JSON.stringify(response.body)).not.toMatch(/answerKey|correctAnswer/);
  });
  test.each(actors)('quiz.list and published read: %s', async actor => {
    const response = await authorized(request(app).get('/api/v1/quizzes'), actor);
    expect(response.status).toBe(200);
    expect(response.body.items.map(item => item.id)).toContain(published.id);
    expect(response.body.items.map(item => item.id)).not.toContain(draft.id);
    const read = await authorized(request(app).get(`/api/v1/quizzes/${published.id}`), actor);
    expect(read.status).toBe(200);
    expect(JSON.stringify([response.body, read.body])).not.toMatch(/answerKey|correctAnswer/);
  });
  test.each(actors)('quiz draft list/read: %s', async actor => {
    await Quiz.create({ ...quizBody, authorId: users.contributor._id, status: 'draft' });
    const build = () => authorized(request(app).get('/api/v1/quizzes?status=draft'), actor);
    if (actor === 'student') await deny(build);
    else {
      const response = await build();
      expect(response.status).toBe(200);
      const expected = actor === 'admin' ? 2 : ['educator', 'contributor'].includes(actor) ? 1 : 0;
      expect(response.body.items).toHaveLength(expected);
      if (actor !== 'admin') expect(response.body.items.every(item => item.authorId === users[actor].id)).toBe(true);
    }
    const read = () => authorized(request(app).get(`/api/v1/quizzes/${draft.id}`), actor);
    if (['educator', 'admin'].includes(actor)) expect((await read()).status).toBe(200);
    else await deny(read, 404, 'NOT_FOUND');
  });

  const mutationCases = ['edit', 'publish', 'unpublish', 'delete'].flatMap(operation =>
    actors.flatMap(actor => ['educator', 'contributor'].map(owner => [operation, actor, owner])));
  test.each(mutationCases)('quiz.%s actor=%s owner=%s', async (operation, actor, owner) => {
    const target = operation === 'unpublish' ? published : draft;
    await Quiz.findByIdAndUpdate(target._id, { authorId: users[owner]._id });
    const methods = { edit: 'put', publish: 'post', unpublish: 'post', delete: 'delete' };
    const suffix = ['publish', 'unpublish'].includes(operation) ? `/${operation}` : '';
    const build = () => {
      const builder = authorized(request(app)[methods[operation]](`/api/v1/quizzes/${target.id}${suffix}`), actor);
      return operation === 'edit' ? builder.send({ title: 'Matrix authorised revision' }) : builder;
    };
    if (actor !== 'admin' && actor !== owner) return deny(build);
    const response = await build();
    expect(response.status).toBe(operation === 'delete' ? 204 : 200);
    const saved = await Quiz.findById(target._id);
    if (operation === 'delete') expect(saved).toBeNull();
    else if (operation === 'edit') expect(saved.title).toBe('Matrix authorised revision');
    else expect(saved.status).toBe(operation === 'publish' ? 'published' : 'draft');
  });

  test.each(actors)('attempt.submit: %s', async actor => {
    const build = () => authorized(request(app).post(`/api/v1/quizzes/${published.id}/attempts`), actor).send({ answers: [] });
    if (!['student', 'contributor'].includes(actor)) return deny(build);
    const response = await build();
    expect(response.status).toBe(201);
    expect(String((await Attempt.findById(response.body.attemptId)).studentId)).toBe(users[actor].id);
  });
  test.each(actors)('material.upload: %s', async actor => {
    if (!['educator', 'otherEducator', 'contributor'].includes(actor)) return deny(() => upload(actor));
    const response = await upload(actor);
    expect(response.status).toBe(201);
    const stored = await Material.findById(response.body.id);
    expect(String(stored.ownerId)).toBe(users[actor].id);
    expect(stored.visibility).toBe('private');
    expect(await fs.readFile(path.join(storageDir, stored.storageKey))).toEqual(pdf);
  });
  const visibilityCases = ['private', 'shared', 'public', 'hidden'].flatMap(visibility =>
    actors.map(actor => [visibility, actor]));
  test.each(visibilityCases)('material detail/download visibility=%s actor=%s', async (visibility, actor) => {
    await Material.findByIdAndUpdate(material._id, {
      visibility: visibility === 'hidden' ? 'public' : visibility,
      hidden: visibility === 'hidden', sharedWith: [users.student._id],
    });
    const allowed = ['educator', 'admin'].includes(actor) || visibility === 'public'
      || (visibility === 'shared' && actor === 'student');
    for (const suffix of ['', '/file']) {
      const build = () => authorized(request(app).get(`/api/v1/materials/${material.id}${suffix}`), actor);
      if (!allowed) await deny(build, 404, 'NOT_FOUND');
      else {
        const response = await build();
        expect(response.status).toBe(200);
        if (suffix) expect(response.body).toEqual(pdf);
        else expect(response.body.id).toBe(material.id);
      }
    }
  });

  test.each(visibilityCases)('material.list visibility=%s actor=%s', async (visibility, actor) => {
    await Material.findByIdAndUpdate(material._id, {
      visibility: visibility === 'hidden' ? 'public' : visibility,
      hidden: visibility === 'hidden', sharedWith: [users.student._id],
    });
    const response = await authorized(request(app).get('/api/v1/materials'), actor);
    expect(response.status).toBe(200);
    const ids = response.body.items.map(item => item.id);
    const allowed = ['educator', 'admin'].includes(actor) || visibility === 'public'
      || (visibility === 'shared' && actor === 'student');
    if (allowed) expect(ids).toContain(material.id);
    else expect(ids).not.toContain(material.id);
    expect(JSON.stringify(response.body)).not.toMatch(/storageKey/);
  });

  const visibilityEndpoints = [['general', ''], ['alias', '/visibility']];
  const visibilityUpdateCases = visibilityEndpoints.flatMap(([name, suffix]) =>
    actors.map(actor => [name, actor, suffix]));
  test.each(visibilityUpdateCases)('material.visibility.%s: %s', async (name, actor, suffix) => {
    const build = () => authorized(
      request(app).patch(`/api/v1/materials/${material.id}${suffix}`),
      actor,
    ).send({ visibility: 'shared', sharedWith: [users.student._id] });
    if (!['educator', 'admin'].includes(actor)) return deny(build);
    const response = await build();
    expect(response.status).toBe(200);
    expect(response.body.visibility).toBe('shared');
    const stored = await Material.findById(material._id);
    expect(stored.visibility).toBe('shared');
    expect(stored.sharedWith.map(String)).toEqual([users.student.id]);
  });

  test('same JWT: admin grant/revoke controls upload and quiz authoring; demoted admin loses access', async () => {
    const roleUrl = `/api/v1/admin/users/${users.student.id}/role`;
    const update = contributor => authorized(request(app).patch(roleUrl), 'admin').send({ contributor });
    await deny(() => upload('student'));
    expect((await update(true)).status).toBe(200);
    expect((await upload('student')).status).toBe(201);
    const created = await authorized(request(app).post('/api/v1/quizzes'), 'student').send(quizBody);
    expect(created.status).toBe(201);
    expect((await update(false)).status).toBe(200);
    await deny(() => upload('student'));
    await deny(() => authorized(request(app).put(`/api/v1/quizzes/${created.body.id}`), 'student').send({ title: 'Denied after revocation' }));
    await User.findByIdAndUpdate(users.admin._id, { role: 'student', contributor: false });
    await deny(() => authorized(request(app).get('/api/v1/admin/users'), 'admin'));
    await deny(() => authorized(request(app).patch(roleUrl), 'admin').send({ contributor: true }));
  });
});
