
const request = require('supertest');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const { MongoMemoryReplSet } = require('mongodb-memory-server');

const { createApp } = require('../src/app');
const { createAuthenticatedFeatures } = require('../src/config/features');
const User = require('../src/models/User');

const TEST_JWT_SECRET = 'profile-integration-test-secret-'.repeat(2);

describe.each(['/api/v1/users/me', '/api/v1/profile'])('FR-005 profile management via %s', (profilePath) => {
  let mongo;
  let app;
  let originalMongoUri;
  let originalJwtSecret;

  beforeAll(async () => {
    originalMongoUri = process.env.MONGODB_URI;
    originalJwtSecret = process.env.JWT_ACCESS_SECRET;

    mongo = await MongoMemoryReplSet.create({
      replSet: { count: 1 },
    });

    process.env.MONGODB_URI = mongo.getUri();
    process.env.JWT_ACCESS_SECRET = TEST_JWT_SECRET;

    await mongoose.connect(mongo.getUri());
    await User.init();

    app = createApp(createAuthenticatedFeatures());
  });

  afterEach(async () => {
    await User.deleteMany({});
  });

  afterAll(async () => {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }

    if (mongo) {
      await mongo.stop();
    }

    if (originalMongoUri === undefined) {
      delete process.env.MONGODB_URI;
    } else {
      process.env.MONGODB_URI = originalMongoUri;
    }

    if (originalJwtSecret === undefined) {
      delete process.env.JWT_ACCESS_SECRET;
    } else {
      process.env.JWT_ACCESS_SECRET = originalJwtSecret;
    }
  });

  async function createTestUser(overrides = {}) {
    const user = await User.create({
      name: 'Profile Student',
      email: 'profile@example.com',
      passwordHash: 'test-password-hash',
      role: 'student',
      contributor: false,
      ...overrides,
    });

    const token = jwt.sign(
      { sub: user._id.toString() },
      TEST_JWT_SECRET,
      { algorithm: 'HS256', expiresIn: '15m' },
    );

    return { user, token };
  }

  test('views own profile without exposing password hash', async () => {
    const { user, token } = await createTestUser();

    const response = await request(app)
      .get(profilePath)
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.user).toMatchObject({
      name: 'Profile Student',
      email: 'profile@example.com',
      role: 'student',
      contributor: false,
    });
    expect(response.body.user._id).toBe(user._id.toString());
    expect(response.body.user).not.toHaveProperty('passwordHash');
  });

  test('rejects viewing a profile without authentication', async () => {
    const response = await request(app).get(profilePath);

    expect(response.status).toBe(401);
  });

  test('updates own name while preserving email, role and contributor', async () => {
    const { user, token } = await createTestUser();

    const response = await request(app)
      .patch(profilePath)
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: '  Updated Student  ',
      });

    expect(response.status).toBe(200);
    expect(response.body.user.name).toBe('Updated Student');
    expect(response.body.user.email).toBe('profile@example.com');
    expect(response.body.user).not.toHaveProperty('passwordHash');

    const stored = await User.findById(user._id);
    expect(stored.name).toBe('Updated Student');
    expect(stored.email).toBe('profile@example.com');
    expect(stored.role).toBe('student');
    expect(stored.contributor).toBe(false);
  });

  test.each(['email', 'role', 'contributor', 'passwordHash'])(
    'rejects attempts to update protected field: %s',
    async (field) => {
      const { user, token } = await createTestUser();
      const before = await User.findById(user.id).lean();

      const response = await request(app)
        .patch(profilePath)
        .set('Authorization', `Bearer ${token}`)
        .send({ [field]: field === 'contributor' ? true : 'admin' });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
      expect(await User.findById(user.id).lean()).toEqual(before);
    },
  );

  test('rejects an invalid name', async () => {
    const { token } = await createTestUser();

    const response = await request(app)
      .patch(profilePath)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: ' ' });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });

  test('rejects email even when already used by another user', async () => {
    const { user, token } = await createTestUser();

    await createTestUser({
      name: 'Another Student',
      email: 'another@example.com',
    });

    const response = await request(app)
      .patch(profilePath)
      .set('Authorization', `Bearer ${token}`)
      .send({ email: 'another@example.com' });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
    expect((await User.findById(user.id).lean()).email).toBe('profile@example.com');
  });

  test('mixed name/email update is rejected atomically', async () => {
    const { user, token } = await createTestUser();
    const before = await User.findById(user.id).lean();
    const response = await request(app).patch(profilePath)
      .set('Authorization', `Bearer ${token}`).send({ name: 'Changed Name', email: 'new@example.com' });
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
    expect(await User.findById(user.id).lean()).toEqual(before);
  });

  test.each([[1,400], [2,200], [60,200], [61,400]])('name length %i returns %i', async (length, status) => {
    const { token } = await createTestUser();
    const response = await request(app).patch(profilePath)
      .set('Authorization', `Bearer ${token}`).send({ name: 'N'.repeat(length) });
    expect(response.status).toBe(status);
  });

  test('empty update and unauthenticated patch leave profile unchanged', async () => {
    const { user, token } = await createTestUser();
    const before = await User.findById(user.id).lean();
    const empty = await request(app).patch(profilePath).set('Authorization', `Bearer ${token}`).send({});
    expect(empty.status).toBe(400);
    expect(empty.body.error.code).toBe('VALIDATION_ERROR');
    const unauthenticated = await request(app).patch(profilePath).send({ name: 'Changed Name' });
    expect(unauthenticated.status).toBe(401);
    expect(unauthenticated.body.error.code).toBe('UNAUTHENTICATED');
    expect(await User.findById(user.id).lean()).toEqual(before);
  });

  test.each(['expired','tampered','none'])('canonical/alias profile denies %s JWT', async kind => {
    const { user, token } = await createTestUser();
    const badToken = kind === 'expired'
      ? jwt.sign({ sub: user.id }, TEST_JWT_SECRET, { algorithm: 'HS256', expiresIn: -1 })
      : kind === 'none'
        ? jwt.sign({ sub: user.id }, null, { algorithm: 'none', expiresIn: '15m' })
        : token.split('.').slice(0,2).join('.') + '.invalid';
    const response = await request(app).get(profilePath).set('Authorization', `Bearer ${badToken}`);
    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('TOKEN_INVALID');
  });
});
