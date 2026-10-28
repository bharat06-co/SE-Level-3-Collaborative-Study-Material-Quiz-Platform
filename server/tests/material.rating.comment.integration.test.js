const os = require('node:os');
const path = require('node:path');
const fsp = require('node:fs/promises');
const request = require('supertest');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { MongoMemoryReplSet } = require('mongodb-memory-server');
const { createApp } = require('../src/app');
const User = require('../src/models/User');
const RefreshToken = require('../src/models/RefreshToken');
const { Material } = require('../src/models/Material');
const Comment = require('../src/models/Comment');

jest.setTimeout(120000);

const TEST_JWT_SECRET = 'material-rating-comment-secret-'.repeat(3);
const PASSWORD = 'Study1234';
const PDF = Buffer.concat([Buffer.from('%PDF-1.7\n'), Buffer.from('material')]);

let mongo;
let app;
let storageDir;
let originalJwtSecret;
let originalJwtTtl;
let originalMongoUri;

async function createUser({ name, email, role = 'student', contributor = false }) {
  return User.create({
    name,
    email,
    passwordHash: await bcrypt.hash(PASSWORD, 10),
    role,
    contributor,
  });
}

async function login(email) {
  const response = await request(app)
    .post('/api/v1/auth/login')
    .send({ email, password: PASSWORD });
  expect(response.status).toBe(200);
  return response.body.accessToken;
}

async function createAndLogin(overrides) {
  const user = await createUser(overrides);
  return { user, token: await login(user.email) };
}

async function upload(token) {
  const response = await request(app)
    .post('/api/v1/materials')
    .set('Authorization', `Bearer ${token}`)
    .field('title', 'Database Notes')
    .field('description', 'Normalisation notes')
    .field('category', 'Notes')
    .field('topic', 'dbms')
    .field('tags', 'dbms, sql')
    .field('rightsConfirmed', 'true')
    .attach('file', PDF, { filename: 'notes.pdf', contentType: 'application/pdf' });
  expect(response.status).toBe(201);
  return response.body.id;
}

async function makePublic(token, id) {
  const response = await request(app)
    .patch(`/api/v1/materials/${id}`)
    .set('Authorization', `Bearer ${token}`)
    .send({ visibility: 'public' });
  expect(response.status).toBe(200);
}

beforeAll(async () => {
  originalJwtSecret = process.env.JWT_ACCESS_SECRET;
  originalJwtTtl = process.env.JWT_ACCESS_TTL;
  originalMongoUri = process.env.MONGODB_URI;

  mongo = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  process.env.MONGODB_URI = mongo.getUri();
  process.env.JWT_ACCESS_SECRET = TEST_JWT_SECRET;
  process.env.JWT_ACCESS_TTL = '15m';

  await mongoose.connect(mongo.getUri(), { serverSelectionTimeoutMS: 15000 });
  await Promise.all([User.init(), RefreshToken.init(), Material.init(), Comment.init()]);

  storageDir = path.join(os.tmpdir(), `t1-ratings-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  app = createApp({
    databaseIsConnected: () => mongoose.connection.readyState === 1,
    storageDir,
  });
});

beforeEach(async () => {
  await Promise.all([
    Material.deleteMany({}),
    Comment.deleteMany({}),
    RefreshToken.deleteMany({}),
    User.deleteMany({}),
  ]);
  await fsp.rm(storageDir, { recursive: true, force: true });
});

afterAll(async () => {
  try {
    if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
  } finally {
    if (mongo) await mongo.stop();
    if (storageDir) await fsp.rm(storageDir, { recursive: true, force: true });
    if (originalJwtSecret === undefined) delete process.env.JWT_ACCESS_SECRET;
    else process.env.JWT_ACCESS_SECRET = originalJwtSecret;
    if (originalJwtTtl === undefined) delete process.env.JWT_ACCESS_TTL;
    else process.env.JWT_ACCESS_TTL = originalJwtTtl;
    if (originalMongoUri === undefined) delete process.env.MONGODB_URI;
    else process.env.MONGODB_URI = originalMongoUri;
  }
});

describe('Ratings (FR-014)', () => {
  test('re-rating replaces the user rating and updates the average', async () => {
    const { token: ownerToken } = await createAndLogin({
      name: 'Owner One', email: 'owner1@example.com', contributor: true,
    });
    const { token: studentToken } = await createAndLogin({
      name: 'Student One', email: 'student1@example.com',
    });
    const id = await upload(ownerToken);
    await makePublic(ownerToken, id);

    await request(app).put(`/api/v1/materials/${id}/rating`).set('Authorization', `Bearer ${studentToken}`).send({ value: 4 }).expect(200);
    const second = await request(app).put(`/api/v1/materials/${id}/rating`).set('Authorization', `Bearer ${studentToken}`).send({ value: 2 });

    expect(second.status).toBe(200);
    expect(second.body.ratingCount).toBe(1);
    expect(second.body.ratingAvg).toBe(2);
    const stored = await Material.findById(id);
    expect(stored.ratings).toHaveLength(1);
    expect(stored.ratings[0].value).toBe(2);
  });

  test('average is rounded to two decimals and re-rating updates it', async () => {
    const { token: ownerToken } = await createAndLogin({
      name: 'Owner One', email: 'owner1@example.com', contributor: true,
    });
    const users = [];
    for (const [index, value] of [5, 4, 2].entries()) {
      const created = await createAndLogin({
        name: `Student ${index}`, email: `student${index}@example.com`,
      });
      users.push({ ...created, value });
    }
    const id = await upload(ownerToken);
    await makePublic(ownerToken, id);

    for (const user of users) {
      await request(app).put(`/api/v1/materials/${id}/rating`).set('Authorization', `Bearer ${user.token}`).send({ value: user.value }).expect(200);
    }

    const before = await request(app).get(`/api/v1/materials/${id}`).set('Authorization', `Bearer ${users[0].token}`);
    expect(before.body.ratingAvg).toBe(3.67);
    expect(before.body.ratingCount).toBe(3);

    const reRate = await request(app).put(`/api/v1/materials/${id}/rating`).set('Authorization', `Bearer ${users[2].token}`).send({ value: 5 });
    expect(reRate.body.ratingAvg).toBe(4.67);
    expect(reRate.body.ratingCount).toBe(3);
  });

  test.each([0, 6, 3.5, 'four'])('invalid rating %p returns 400 and stores nothing', async (value) => {
    const { token: ownerToken } = await createAndLogin({
      name: 'Owner One', email: 'owner1@example.com', contributor: true,
    });
    const { token: studentToken } = await createAndLogin({
      name: 'Student One', email: 'student1@example.com',
    });
    const id = await upload(ownerToken);
    await makePublic(ownerToken, id);

    const response = await request(app)
      .put(`/api/v1/materials/${id}/rating`)
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ value });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
    expect((await Material.findById(id)).ratings).toHaveLength(0);
  });

  test('cannot rate inaccessible private material', async () => {
    const { token: ownerToken } = await createAndLogin({
      name: 'Owner One', email: 'owner1@example.com', contributor: true,
    });
    const { token: studentToken } = await createAndLogin({
      name: 'Student One', email: 'student1@example.com',
    });
    const id = await upload(ownerToken);

    const response = await request(app)
      .put(`/api/v1/materials/${id}/rating`)
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ value: 4 });
    expect(response.status).toBe(404);
  });
});

describe('Comments (FR-014, SEC-004)', () => {
  test('adds and lists comments with author names, oldest first', async () => {
    const { token: ownerToken } = await createAndLogin({
      name: 'Owner One', email: 'owner1@example.com', contributor: true,
    });
    const { token: studentToken } = await createAndLogin({
      name: 'Student One', email: 'student1@example.com',
    });
    const id = await upload(ownerToken);
    await makePublic(ownerToken, id);

    for (const content of ['First', 'Second', 'Third']) {
      const created = await request(app)
        .post(`/api/v1/materials/${id}/comments`)
        .set('Authorization', `Bearer ${studentToken}`)
        .send({ content });
      expect(created.status).toBe(201);
      expect(created.body.author).toEqual({ id: expect.any(String), name: 'Student One' });
    }

    const list = await request(app)
      .get(`/api/v1/materials/${id}/comments`)
      .set('Authorization', `Bearer ${studentToken}`);
    expect(list.status).toBe(200);
    expect(list.body.total).toBe(3);
    expect(list.body.items.map((item) => item.content)).toEqual(['First', 'Second', 'Third']);
    expect(list.body.items[0].author.name).toBe('Student One');
  });

  test.each(['', 'x'.repeat(1001)])('rejects comment length %p with 400', async (content) => {
    const { token: ownerToken } = await createAndLogin({
      name: 'Owner One', email: 'owner1@example.com', contributor: true,
    });
    const id = await upload(ownerToken);
    await makePublic(ownerToken, id);

    const response = await request(app)
      .post(`/api/v1/materials/${id}/comments`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ content });
    expect(response.status).toBe(400);
    expect(await Comment.countDocuments()).toBe(0);
  });

  test('accepts 1 and 1000 character comments', async () => {
    const { token: ownerToken } = await createAndLogin({
      name: 'Owner One', email: 'owner1@example.com', contributor: true,
    });
    const id = await upload(ownerToken);
    await makePublic(ownerToken, id);

    for (const content of ['x', 'y'.repeat(1000)]) {
      const response = await request(app)
        .post(`/api/v1/materials/${id}/comments`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ content });
      expect(response.status).toBe(201);
    }
  });

  test('hostile markup is stored literally and returned as plain text', async () => {
    const { token: ownerToken } = await createAndLogin({
      name: 'Owner One', email: 'owner1@example.com', contributor: true,
    });
    const id = await upload(ownerToken);
    await makePublic(ownerToken, id);
    const payload = '<script>alert(1)</script><img src=x onerror=alert(2)>';

    const created = await request(app)
      .post(`/api/v1/materials/${id}/comments`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ content: payload });
    expect(created.status).toBe(201);
    expect(created.body.content).toBe(payload);

    const stored = await Comment.findOne({ materialId: id }).lean();
    expect(stored.content).toBe(payload);
  });

  test('cannot comment on inaccessible private material', async () => {
    const { token: ownerToken } = await createAndLogin({
      name: 'Owner One', email: 'owner1@example.com', contributor: true,
    });
    const { token: studentToken } = await createAndLogin({
      name: 'Student One', email: 'student1@example.com',
    });
    const id = await upload(ownerToken);

    const response = await request(app)
      .post(`/api/v1/materials/${id}/comments`)
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ content: 'Nice' });
    expect(response.status).toBe(404);
    expect(await Comment.countDocuments()).toBe(0);
  });
});
