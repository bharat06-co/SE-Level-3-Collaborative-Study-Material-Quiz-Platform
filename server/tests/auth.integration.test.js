
const request = require('supertest');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('node:crypto');
const { MongoMemoryReplSet } = require('mongodb-memory-server');

const { createApp } = require('../src/app');
const User = require('../src/models/User');
const RefreshToken = require('../src/models/RefreshToken');

jest.setTimeout(90000);

const TEST_JWT_SECRET = 'integration-test-secret-'.repeat(4);
const REFRESH_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function getCookieToken(response, name = 'rt') {
  const cookies = response.headers['set-cookie'] || [];
  const cookie = cookies.find((entry) => entry.startsWith(`${name}=`));

  if (!cookie) return undefined;

  return cookie.slice(name.length + 1).split(';')[0];
}

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

    mongo = await MongoMemoryReplSet.create({
      replSet: { count: 1 },
    });

    process.env.MONGODB_URI = mongo.getUri();
    process.env.JWT_ACCESS_SECRET = TEST_JWT_SECRET;
    process.env.JWT_ACCESS_TTL = '15m';

    await mongoose.connect(mongo.getUri(), {
      serverSelectionTimeoutMS: 15000,
    });

    await Promise.all([User.init(), RefreshToken.init()]);

    app = createApp({
      origins: ['http://localhost:5173'],
      trustProxyHops: 0,
      databaseIsConnected: () => mongoose.connection.readyState === 1,
      logger: require('pino')({ level: 'silent' }),
    });
  });

  beforeEach(async () => {
    await RefreshToken.deleteMany({});
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
    const passwordHash =
      overrides.passwordHash || (await bcrypt.hash('Study1234', 10));
    const otherOverrides = { ...overrides };
delete otherOverrides.passwordHash;

    return User.create({
      name: 'Integration Student',
      email: 'student@example.com',
      passwordHash,
      role: 'student',
      contributor: false,
      ...otherOverrides,
    });
  }

  async function loginAndGetRefreshToken() {
    await createTestUser();

    const response = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: 'student@example.com',
        password: 'Study1234',
      });

    expect(response.status).toBe(200);

    const refreshToken = getCookieToken(response);
    expect(refreshToken).toEqual(expect.any(String));

    return { response, refreshToken };
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

      expect(responses.filter((response) => response.status === 201)).toHaveLength(1);
      expect(responses.filter((response) => response.status === 409)).toHaveLength(3);
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
    test('returns a verifiable JWT, safe user details, and secure refresh cookie', async () => {
      await createTestUser();

      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: ' STUDENT@example.com ',
          password: 'Study1234',
        });

      expect(response.status).toBe(200);
      expect(response.body.tokenType).toBe('Bearer');
      expect(response.body.expiresIn).toBe(900);
      expect(response.body.accessToken).toEqual(expect.any(String));
      expect(response.body).not.toHaveProperty('refreshToken');
      expect(response.body.user).toMatchObject({
        name: 'Integration Student',
        email: 'student@example.com',
        role: 'student',
        contributor: false,
      });
      expect(response.body.user).not.toHaveProperty('passwordHash');

      const payload = jwt.verify(response.body.accessToken, TEST_JWT_SECRET, {
        algorithms: ['HS256'],
      });

      expect(payload.sub).toBe(response.body.user.id);
      expect(payload.exp - payload.iat).toBe(900);

      const cookieHeader = response.headers['set-cookie'].find((value) =>
        value.startsWith('rt='),
      );

      expect(cookieHeader).toBeDefined();
      expect(cookieHeader).toMatch(/HttpOnly/i);
      expect(cookieHeader).toMatch(/Secure/i);
      expect(cookieHeader).toMatch(/SameSite=Strict/i);
      expect(cookieHeader).toMatch(/Path=\/api\/v1\/auth/i);
      expect(cookieHeader).toMatch(/Max-Age=604800/i);

      const rawToken = getCookieToken(response);
      const stored = await RefreshToken.find({ userId: payload.sub }).lean();

      expect(stored).toHaveLength(1);
      expect(stored[0].tokenHash).toBe(hashToken(rawToken));
      expect(stored[0].tokenHash).not.toBe(rawToken);
      expect(stored[0].expiresAt.getTime()).toBeGreaterThan(Date.now());
      expect(stored[0].expiresAt.getTime()).toBeLessThanOrEqual(
        Date.now() + REFRESH_TTL_MS + 5000,
      );
      expect(stored[0].revokedAt).toBeNull();
    });

    test.each([
      ['ascii suffix', 'A1' + 'x'.repeat(70) + 'DIFFERENT'],
      ['multibyte suffix', 'A1' + 'x'.repeat(69) + '\u00e9'],
    ])('rejects an over-72-byte password: %s', async (_caseName, password) => {
      const validPassword = 'A1' + 'x'.repeat(70);
      await createTestUser({
        passwordHash: await bcrypt.hash(validPassword, 10),
      });

      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'student@example.com', password });

      expect(Buffer.byteLength(password, 'utf8')).toBeGreaterThan(72);
      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
      expect(response.body).not.toHaveProperty('accessToken');
      expect(response.headers['set-cookie']).toBeUndefined();
    });

    test('accepts the correct password at exactly 72 UTF-8 bytes', async () => {
      const password = 'A1' + 'x'.repeat(70);
      await createTestUser({
        passwordHash: await bcrypt.hash(password, 10),
      });

      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'student@example.com', password });

      expect(Buffer.byteLength(password, 'utf8')).toBe(72);
      expect(response.status).toBe(200);
      expect(response.body.accessToken).toEqual(expect.any(String));
      expect(response.body.expiresIn).toBe(900);
    });

    test('returns the same generic error for a wrong password and unknown email', async () => {
      await createTestUser();

      const wrongPassword = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'student@example.com', password: 'WrongPassword1' });

      const unknownEmail = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'unknown@example.com', password: 'Study1234' });

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
        .send({ email: 'invalid-email', password: 'Study1234' });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('FR-002 refresh tokens', () => {
    test('rotates a valid refresh token and invalidates the old token', async () => {
      const { refreshToken: oldToken } = await loginAndGetRefreshToken();

      const response = await request(app)
        .post('/api/v1/auth/refresh')
        .set('Cookie', `rt=${oldToken}`);

      expect(response.status).toBe(200);
      expect(response.body.accessToken).toEqual(expect.any(String));
      expect(response.body.expiresIn).toBe(900);
      expect(response.body).not.toHaveProperty('refreshToken');

      const newToken = getCookieToken(response);
      expect(newToken).toEqual(expect.any(String));
      expect(newToken).not.toBe(oldToken);

      const oldRecord = await RefreshToken.findOne({
        tokenHash: hashToken(oldToken),
      });
      const newRecord = await RefreshToken.findOne({
        tokenHash: hashToken(newToken),
      });

      expect(oldRecord).not.toBeNull();
      expect(oldRecord.revokedAt).toBeInstanceOf(Date);
      expect(newRecord).not.toBeNull();
      expect(newRecord.revokedAt).toBeNull();

      const replay = await request(app)
        .post('/api/v1/auth/refresh')
        .set('Cookie', `rt=${oldToken}`);

      expect(replay.status).toBe(401);
    });

    test('rejects a missing or unknown refresh token', async () => {
      const missing = await request(app).post('/api/v1/auth/refresh');
      const unknown = await request(app)
        .post('/api/v1/auth/refresh')
        .set('Cookie', 'rt=not-a-real-token');

      expect(missing.status).toBe(401);
      expect(unknown.status).toBe(401);
    });

    test('rejects an expired refresh token', async () => {
      const user = await createTestUser();
      const rawToken = crypto.randomBytes(32).toString('base64url');

      await RefreshToken.create({
        userId: user._id,
        tokenHash: hashToken(rawToken),
        expiresAt: new Date(Date.now() - 60_000),
        revokedAt: null,
      });

      const response = await request(app)
        .post('/api/v1/auth/refresh')
        .set('Cookie', `rt=${rawToken}`);

      expect(response.status).toBe(401);
    });

    test('rejects a revoked refresh token', async () => {
      const { refreshToken } = await loginAndGetRefreshToken();

      await RefreshToken.updateOne(
        { tokenHash: hashToken(refreshToken) },
        { $set: { revokedAt: new Date() } },
      );

      const response = await request(app)
        .post('/api/v1/auth/refresh')
        .set('Cookie', `rt=${refreshToken}`);

      expect(response.status).toBe(401);
    });

    test('does not allow two refresh requests to reuse the same token', async () => {
      const { refreshToken } = await loginAndGetRefreshToken();

      const responses = await Promise.all([
        request(app)
          .post('/api/v1/auth/refresh')
          .set('Cookie', `rt=${refreshToken}`),
        request(app)
          .post('/api/v1/auth/refresh')
          .set('Cookie', `rt=${refreshToken}`),
      ]);

      expect(responses.filter((response) => response.status === 200)).toHaveLength(1);
      expect(responses.filter((response) => response.status === 401)).toHaveLength(1);

    });
  });

  describe('FR-003 logout', () => {
    test('revokes the active refresh token and clears the cookie', async () => {
      const { refreshToken } = await loginAndGetRefreshToken();

      const response = await request(app)
        .post('/api/v1/auth/logout')
        .set('Cookie', `rt=${refreshToken}`);

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Logged out successfully.');

      const clearedCookie = (response.headers['set-cookie'] || []).find(
        (cookie) => cookie.startsWith('rt='),
      );

      expect(clearedCookie).toBeDefined();
      expect(clearedCookie).toMatch(/Expires=/i);
      expect(clearedCookie).toMatch(/HttpOnly/i);
      expect(clearedCookie).toMatch(/Path=\/api\/v1\/auth/i);

      const storedToken = await RefreshToken.findOne({
        tokenHash: hashToken(refreshToken),
      });

      expect(storedToken).not.toBeNull();
      expect(storedToken.revokedAt).toBeInstanceOf(Date);
    });

    test('rejects reuse of a refresh token after logout', async () => {
      const { refreshToken } = await loginAndGetRefreshToken();

      const logoutResponse = await request(app)
        .post('/api/v1/auth/logout')
        .set('Cookie', `rt=${refreshToken}`);

      expect(logoutResponse.status).toBe(200);

      const refreshResponse = await request(app)
        .post('/api/v1/auth/refresh')
        .set('Cookie', `rt=${refreshToken}`);

      expect(refreshResponse.status).toBe(401);
      expect(refreshResponse.body.error.code).toBe('INVALID_REFRESH_TOKEN');
    });

    test('rejects logout without a refresh token', async () => {
      const response = await request(app).post('/api/v1/auth/logout');

      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe('INVALID_REFRESH_TOKEN');
    });

    test('rejects logout with an unknown refresh token', async () => {
      const response = await request(app)
        .post('/api/v1/auth/logout')
        .set('Cookie', 'rt=not-a-real-token');

      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe('INVALID_REFRESH_TOKEN');
    });
  });
