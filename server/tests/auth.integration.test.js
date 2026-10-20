
const request = require('supertest');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { MongoMemoryServer } = require('mongodb-memory-server');

const { createApp } = require('../src/app');
const User = require('../src/models/User');

jest.setTimeout(60000);

const TEST_JWT_SECRET = 'integration-test-secret-'.repeat(4);

describe('Authentication integration', () => {
  let mongo;
  let app;
  let originalJwtSecret;
  let originalJwtTtl;
  let originalMongoUri;

  beforeAll(async () => {
    originalJwtSecret = process.env.JWT_ACCESS_SECRET;
    originalJwtTtl = process.env.JWT_ACCESS_TTL;
    originalMongoUri = process.env.MONGODB_URI;

    mongo = await MongoMemoryServer.create({
      instance: { launchTimeout: 30000 },
    });

    process.env.MONGODB_URI = mongo.getUri();
    process.env.JWT_ACCESS_SECRET = TEST_JWT_SECRET;
    process.env.JWT_ACCESS_TTL = '15m';

    await mongoose.connect(mongo.getUri(), {
      serverSelectionTimeoutMS: 10000,
    });

    app = createApp({
      origins: ['http://localhost:5173'],
      trustProxyHops: 0,
      databaseIsConnected: () => mongoose.connection.readyState === 1,
      logger: require('pino')({ level: 'silent' }),
    });
  });

  beforeEach(async () => {
    await User.deleteMany({});
  });

  afterAll(async () => {
    try {
      if (mongoose.connection.readyState !== 0) {
        await mongoose.disconnect();
      }
    } finally {
      if (mongo) {
        await mongo.stop();
      }

      if (originalJwtSecret === undefined) {
        delete process.env.JWT_ACCESS_SECRET;
      } else {
        process.env.JWT_ACCESS_SECRET = originalJwtSecret;
      }

      if (originalJwtTtl === undefined) {
        delete process.env.JWT_ACCESS_TTL;
      } else {
        process.env.JWT_ACCESS_TTL = originalJwtTtl;
      }

      if (originalMongoUri === undefined) {
        delete process.env.MONGODB_URI;
      } else {
        process.env.MONGODB_URI = originalMongoUri;
      }
    }
  });

  async function createTestUser(overrides = {}) {
    const passwordHash = await bcrypt.hash('Study1234', 10);

    return User.create({
      name: 'Integration Student',
      email: 'student@example.com',
      passwordHash,
      role: 'student',
      contributor: false,
      ...overrides,
    });
  }

  describe('FR-001 registration', () => {
    test('registers a user, normalizes email, and stores a safe password hash', async () => {
      const response = await request(app)
        .post('/api/v1/auth/register')
        .send({
          name: 'Integration Student',
          email: '  STUDENT@example.com ',
          password: 'Study1234',
          role: 'admin',
          contributor: true,
        });

      expect(response.status).toBe(201);
      expect(response.body.user.email).toBe('student@example.com');
      expect(response.body.user.role).toBe('student');
      expect(response.body.user.contributor).toBe(false);
      expect(response.body.user).not.toHaveProperty('password');
      expect(response.body.user).not.toHaveProperty('passwordHash');

      const stored = await User.findOne({ email: 'student@example.com' })
        .select('+passwordHash')
        .lean();

      expect(stored).not.toBeNull();
      expect(stored.role).toBe('student');
      expect(stored.contributor).toBe(false);
      expect(stored.passwordHash).not.toBe('Study1234');
      expect(await bcrypt.compare('Study1234', stored.passwordHash)).toBe(true);
      expect(await User.countDocuments()).toBe(1);
    });

    test('rejects duplicate email regardless of case', async () => {
      const first = await request(app)
        .post('/api/v1/auth/register')
        .send({
          name: 'First Student',
          email: 'student@example.com',
          password: 'Study1234',
        });

      const second = await request(app)
        .post('/api/v1/auth/register')
        .send({
          name: 'Second Student',
          email: 'STUDENT@EXAMPLE.COM',
          password: 'Study5678',
        });

      expect(first.status).toBe(201);
      expect(second.status).toBe(409);
      expect(second.body.error.code).toBe('EMAIL_TAKEN');
      expect(await User.countDocuments()).toBe(1);
    });

    test('allows exactly one concurrent registration for the same email', async () => {
      const payload = {
        name: 'Concurrent Student',
        email: 'concurrent@example.com',
        password: 'Study1234',
      };

      const responses = await Promise.all(
        Array.from({ length: 4 }, () =>
          request(app).post('/api/v1/auth/register').send(payload),
        ),
      );

      expect(
        responses.filter((response) => response.status === 201),
      ).toHaveLength(1);

      const duplicates = responses.filter((response) => response.status === 409);
      expect(duplicates).toHaveLength(3);
      expect(
        duplicates.every(
          (response) => response.body.error.code === 'EMAIL_TAKEN',
        ),
      ).toBe(true);
      expect(await User.countDocuments({ email: payload.email })).toBe(1);
    });

    test.each([
      ['too-short', 'short1'],
      ['missing-digit', 'passwordonly'],
      ['too-long-ascii', 'A1' + 'x'.repeat(71)],
      ['too-long-multibyte', 'A1' + '\u00e9'.repeat(36)],
    ])('rejects invalid password: %s', async (_caseName, password) => {
      const response = await request(app)
        .post('/api/v1/auth/register')
        .send({
          name: 'Password Test',
          email: `${_caseName}@example.com`,
          password,
        });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
      expect(await User.countDocuments()).toBe(0);
    });
  });

  describe('FR-002 login', () => {
    test('logs in through HTTP and returns a verifiable JWT and safe user details', async () => {
      await createTestUser();

      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: ' STUDENT@example.com ',
          password: 'Study1234',
        });

      expect(response.status).toBe(200);
      expect(response.body.tokenType).toBe('Bearer');
      expect(response.body.expiresIn).toBe('15m');
      expect(response.body.accessToken).toEqual(expect.any(String));
      expect(response.body.user).toMatchObject({
        name: 'Integration Student',
        email: 'student@example.com',
        role: 'student',
        contributor: false,
      });
      expect(response.body.user).toHaveProperty('id');
      expect(response.body.user).not.toHaveProperty('password');
      expect(response.body.user).not.toHaveProperty('passwordHash');

      const payload = jwt.verify(
        response.body.accessToken,
        TEST_JWT_SECRET,
        { algorithms: ['HS256'] },
      );

      expect(payload.sub).toBe(response.body.user.id);
      expect(payload.role).toBe('student');
      expect(payload.contributor).toBe(false);
    });

    test('returns the same generic error for a wrong password and unknown email', async () => {
      await createTestUser();

      const wrongPassword = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'student@example.com',
          password: 'WrongPassword1',
        });

      const unknownEmail = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'unknown@example.com',
          password: 'Study1234',
        });

      expect(wrongPassword.status).toBe(401);
      expect(unknownEmail.status).toBe(401);
      expect(wrongPassword.body.error.code).toBe('INVALID_CREDENTIALS');
      expect(unknownEmail.body.error.code).toBe('INVALID_CREDENTIALS');
      expect(wrongPassword.body.error.message).toBe(
        unknownEmail.body.error.message,
      );
    });

    test('rejects invalid login input', async () => {
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'invalid-email',
          password: 'Study1234',
        });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });
  });
});
