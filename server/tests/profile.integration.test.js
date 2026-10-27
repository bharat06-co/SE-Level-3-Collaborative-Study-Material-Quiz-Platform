
const request = require('supertest');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const { MongoMemoryReplSet } = require('mongodb-memory-server');

const { createApp } = require('../src/app');
const { createAuthenticatedFeatures } = require('../src/config/features');
const User = require('../src/models/User');

const TEST_JWT_SECRET = 'profile-integration-test-secret-'.repeat(2);

describe('FR-005 profile management', () => {
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
      .get('/api/v1/profile')
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
    const response = await request(app).get('/api/v1/profile');

    expect(response.status).toBe(401);
  });

  test('updates own name and normalizes email', async () => {
    const { user, token } = await createTestUser();

    const response = await request(app)
      .patch('/api/v1/profile')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Updated Student',
        email: '  UPDATED@example.com  ',
      });

    expect(response.status).toBe(200);
    expect(response.body.user.name).toBe('Updated Student');
    expect(response.body.user.email).toBe('updated@example.com');
    expect(response.body.user).not.toHaveProperty('passwordHash');

    const stored = await User.findById(user._id);
    expect(stored.name).toBe('Updated Student');
    expect(stored.email).toBe('updated@example.com');
  });

  test.each(['role', 'contributor', 'passwordHash'])(
    'rejects attempts to update protected field: %s',
    async (field) => {
      const { token } = await createTestUser();

      const response = await request(app)
        .patch('/api/v1/profile')
        .set('Authorization', `Bearer ${token}`)
        .send({ [field]: field === 'contributor' ? true : 'admin' });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    },
  );

  test('rejects an invalid name', async () => {
    const { token } = await createTestUser();

    const response = await request(app)
      .patch('/api/v1/profile')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: ' ' });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });

  test('rejects an email address already used by another user', async () => {
    const { token } = await createTestUser();

    await createTestUser({
      name: 'Another Student',
      email: 'another@example.com',
    });

    const response = await request(app)
      .patch('/api/v1/profile')
      .set('Authorization', `Bearer ${token}`)
      .send({ email: 'another@example.com' });

    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe('CONFLICT');
  });
});
