const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const request = require('supertest');
const { MongoMemoryReplSet } = require('mongodb-memory-server');
const { createApp } = require('../src/app');
const { createAuthenticate } = require('../src/middleware/authenticate');
const User = require('../src/models/User');
const { Quiz } = require('../src/modules/quizzes/quiz.model');

jest.setTimeout(90000);

describe('authenticated quiz flow with MongoDB', () => {
  let mongo;
  let app;
  const previousUri = process.env.MONGODB_URI;
  const previousSecret = process.env.JWT_ACCESS_SECRET;
  const previousTtl = process.env.JWT_ACCESS_TTL;

  beforeAll(async () => {
    mongo = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
    process.env.MONGODB_URI = mongo.getUri();
    process.env.JWT_ACCESS_SECRET = 'quiz-auth-db-test-secret-'.repeat(4);
    process.env.JWT_ACCESS_TTL = '15m';
    await mongoose.connect(mongo.getUri(), { serverSelectionTimeoutMS: 15000 });
    await Promise.all([User.init(), Quiz.init()]);
    app = createApp({ quizAuthenticate: createAuthenticate() });
  });

  afterAll(async () => {
    try {
      if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
    } finally {
      if (mongo) await mongo.stop();
      for (const [key, value] of [
        ['MONGODB_URI', previousUri],
        ['JWT_ACCESS_SECRET', previousSecret],
        ['JWT_ACCESS_TTL', previousTtl],
      ]) {
        if (value === undefined) delete process.env[key];
        else process.env[key] = value;
      }
    }
  });

  test('login token follows current contributor permissions and never exposes answer keys', async () => {
    const user = await User.create({
      name: 'Quiz Author',
      email: 'author@example.com',
      passwordHash: await bcrypt.hash('Study1234', 10),
      role: 'student',
      contributor: false,
    });
    const login = await request(app).post('/api/v1/auth/login')
      .send({ email: 'author@example.com', password: 'Study1234' });
    expect(login.status).toBe(200);
    const bearer = `Bearer ${login.body.accessToken}`;
    const path = '/api/v1/quizzes';
    const quiz = {
      title: 'DBMS basics', topic: 'dbms',
      questions: [{ text: 'What is 2 + 2?', type: 'mcq', options: ['3', '4'], answerKey: 1 }],
    };

    expect((await request(app).post(path).send(quiz)).status).toBe(401);
    expect((await request(app).post(path).set('Authorization', bearer).send(quiz)).status).toBe(403);

    await User.findByIdAndUpdate(user._id, { contributor: true });
    const created = await request(app).post(path).set('Authorization', bearer).send(quiz);
    expect(created.status).toBe(201);
    expect(created.body.status).toBe('draft');
    expect(JSON.stringify(created.body)).not.toMatch(/answerKey|correctAnswer/);

    const edited = await request(app).put(`${path}/${created.body.id}`)
      .set('Authorization', bearer).send({ title: 'DBMS revised' });
    expect(edited.status).toBe(200);
    expect(edited.body.title).toBe('DBMS revised');
    expect(JSON.stringify(edited.body)).not.toMatch(/answerKey|correctAnswer/);

    const published = await request(app).post(`${path}/${created.body.id}/publish`)
      .set('Authorization', bearer);
    expect(published.status).toBe(200);
    expect(published.body.status).toBe('published');

    const visible = await request(app).get(`${path}/${created.body.id}`)
      .set('Authorization', bearer);
    expect(visible.status).toBe(200);
    expect(JSON.stringify(visible.body)).not.toMatch(/answerKey|correctAnswer/);
    const listed = await request(app).get(path).set('Authorization', bearer);
    expect(listed.status).toBe(200);
    expect(listed.body.items.some((item) => item.id === created.body.id)).toBe(true);
    expect(JSON.stringify(listed.body)).not.toMatch(/answerKey|correctAnswer/);
    expect((await Quiz.findById(created.body.id).lean()).questions[0].answerKey).toBe(1);

    const unpublished = await request(app).post(`${path}/${created.body.id}/unpublish`)
      .set('Authorization', bearer);
    expect(unpublished.status).toBe(200);
    expect(unpublished.body.status).toBe('draft');
    expect((await request(app).get(`${path}/${created.body.id}`)).status).toBe(401);
    expect((await request(app).post(`${path}/${created.body.id}/publish`)
      .set('Authorization', bearer)).status).toBe(200);

    await User.findByIdAndUpdate(user._id, { contributor: false });
    const revoked = await request(app).put(`${path}/${created.body.id}`)
      .set('Authorization', bearer).send({ title: 'Unauthorized edit' });
    expect(revoked.status).toBe(403);
    expect((await Quiz.findById(created.body.id).lean()).title).toBe('DBMS revised');
  });

  test('another educator cannot change an author quiz, while an administrator can moderate it', async () => {
    const passwordHash = await bcrypt.hash('Study1234', 10);
    await User.create([
      { name: 'Owner', email: 'owner@example.com', passwordHash, role: 'educator' },
      { name: 'Other', email: 'other@example.com', passwordHash, role: 'educator' },
      { name: 'Admin', email: 'admin@example.com', passwordHash, role: 'admin' },
    ]);
    async function bearer(email) {
      const response = await request(app).post('/api/v1/auth/login')
        .send({ email, password: 'Study1234' });
      expect(response.status).toBe(200);
      return `Bearer ${response.body.accessToken}`;
    }
    const owner = await bearer('owner@example.com');
    const other = await bearer('other@example.com');
    const admin = await bearer('admin@example.com');
    const path = '/api/v1/quizzes';
    const quiz = {
      title: 'Protected quiz', topic: 'security',
      questions: [{ text: 'Choose B', type: 'mcq', options: ['A', 'B'], answerKey: 1 }],
    };
    const created = await request(app).post(path).set('Authorization', owner).send(quiz);
    expect(created.status).toBe(201);
    const id = created.body.id;

    expect((await request(app).get(`${path}/${id}`).set('Authorization', other)).status).toBe(404);
    const original = await Quiz.findById(id).lean();
    for (const deniedRequest of [
      () => request(app).put(`${path}/${id}`).set('Authorization', other).send({ title: 'Taken over' }),
      () => request(app).post(`${path}/${id}/publish`).set('Authorization', other),
      () => request(app).post(`${path}/${id}/unpublish`).set('Authorization', other),
      () => request(app).delete(`${path}/${id}`).set('Authorization', other),
    ]) {
      const denied = await deniedRequest();
      expect(denied.status).toBe(403);
      expect(denied.body.error.code).toBe('FORBIDDEN');
      expect(await Quiz.findById(id).lean()).toEqual(original);
    }
    expect((await request(app).post(path).set('Authorization', admin).send(quiz)).status).toBe(403);

    const moderated = await request(app).put(`${path}/${id}`).set('Authorization', admin)
      .send({ title: 'Moderated quiz' });
    expect(moderated.status).toBe(200);
    expect(moderated.body.title).toBe('Moderated quiz');
    expect(JSON.stringify(moderated.body)).not.toMatch(/answerKey|correctAnswer/);
    expect((await request(app).post(`${path}/${id}/publish`).set('Authorization', admin)).status).toBe(200);
    const published = await request(app).get(`${path}/${id}`).set('Authorization', other);
    expect(published.status).toBe(200);
    expect(JSON.stringify(published.body)).not.toMatch(/answerKey|correctAnswer/);
    const publishedRecord = await Quiz.findById(id).lean();
    for (const deniedRequest of [
      () => request(app).put(`${path}/${id}`).set('Authorization', other)
        .send({ title: 'Published takeover' }),
      () => request(app).delete(`${path}/${id}`).set('Authorization', other),
    ]) {
      const denied = await deniedRequest();
      expect(denied.status).toBe(403);
      expect(denied.body.error.code).toBe('FORBIDDEN');
      expect(await Quiz.findById(id).lean()).toEqual(publishedRecord);
    }
    expect((await request(app).post(`${path}/${id}/unpublish`).set('Authorization', admin)).status).toBe(200);
    expect((await request(app).get(`${path}/${id}`).set('Authorization', other)).status).toBe(404);
    expect((await request(app).delete(`${path}/${id}`).set('Authorization', admin)).status).toBe(204);
    expect(await Quiz.findById(id)).toBeNull();

    const ownerDraft = await request(app).post(path).set('Authorization', owner)
      .send({ ...quiz, title: 'Owner deletes this quiz' });
    expect(ownerDraft.status).toBe(201);
    expect((await request(app).delete(`${path}/${ownerDraft.body.id}`)
      .set('Authorization', owner)).status).toBe(204);
    expect(await Quiz.findById(ownerDraft.body.id)).toBeNull();
  });
});
