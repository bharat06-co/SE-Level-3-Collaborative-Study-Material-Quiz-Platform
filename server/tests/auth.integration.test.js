
const request = require('supertest');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { MongoMemoryServer } = require('mongodb-memory-server');

const { createApp } = require('../src/app');
const User = require('../src/models/User');

jest.setTimeout(60000);

describe('FR-001 registration integration', () => {
  let mongo;
  let app;

  beforeAll(async () => {
    mongo = await MongoMemoryServer.create({
      instance: { launchTimeout: 30000 },
    });

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
    }
  });

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

    expect(responses.filter((response) => response.status === 201)).toHaveLength(1);

    const duplicates = responses.filter((response) => response.status === 409);
    expect(duplicates).toHaveLength(3);
   expect(duplicates.every((response) => response.body.error.code === 'EMAIL_TAKEN')).toBe(true);
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