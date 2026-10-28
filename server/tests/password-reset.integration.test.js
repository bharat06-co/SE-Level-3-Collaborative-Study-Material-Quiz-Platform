
const request = require('supertest');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const crypto = require('node:crypto');
const { MongoMemoryReplSet } = require('mongodb-memory-server');

jest.mock('../src/modules/auth/password-reset.email', () => ({
  sendPasswordResetEmail: jest.fn(),
}));

const {
  sendPasswordResetEmail,
} = require('../src/modules/auth/password-reset.email');

const { createApp } = require('../src/app');
const User = require('../src/models/User');
const RefreshToken = require('../src/models/RefreshToken');
const PasswordResetToken = require('../src/models/PasswordResetToken');

jest.setTimeout(90000);

const TEST_JWT_SECRET = 'integration-test-secret-'.repeat(4);
const RESET_URL = 'http://localhost:5173/reset-password';
const RESET_TTL_MS = 30 * 60 * 1000;

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function getCookieToken(response) {
  const cookies = response.headers['set-cookie'] || [];
  const cookie = cookies.find((entry) => entry.startsWith('rt='));

  return cookie ? cookie.slice(3).split(';')[0] : undefined;
}

describe('FR-006 password reset integration', () => {
  let mongo;
  let app;
  let originalEnv;

  beforeAll(async () => {
    originalEnv = {
      JWT_ACCESS_SECRET: process.env.JWT_ACCESS_SECRET,
      JWT_ACCESS_TTL: process.env.JWT_ACCESS_TTL,
      MONGODB_URI: process.env.MONGODB_URI,
      PASSWORD_RESET_URL: process.env.PASSWORD_RESET_URL,
    };

    mongo = await MongoMemoryReplSet.create({
      replSet: { count: 1 },
    });

    process.env.MONGODB_URI = mongo.getUri();
    process.env.JWT_ACCESS_SECRET = TEST_JWT_SECRET;
    process.env.JWT_ACCESS_TTL = '15m';
    process.env.PASSWORD_RESET_URL = RESET_URL;

    await mongoose.connect(mongo.getUri(), {
      serverSelectionTimeoutMS: 15000,
    });

    await Promise.all([
      User.init(),
      RefreshToken.init(),
      PasswordResetToken.init(),
    ]);

    app = createApp({
      origins: ['http://localhost:5173'],
      trustProxyHops: 0,
      databaseIsConnected: () => mongoose.connection.readyState === 1,
      logger: require('pino')({ level: 'error' }),
    });
  });

  beforeEach(async () => {
    await Promise.all([
      User.deleteMany({}),
      RefreshToken.deleteMany({}),
      PasswordResetToken.deleteMany({}),
    ]);

    jest.clearAllMocks();
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

      for (const [key, value] of Object.entries(originalEnv || {})) {
        if (value === undefined) {
          delete process.env[key];
        } else {
          process.env[key] = value;
        }
      }
    }
  });

  async function createTestUser() {
    return User.create({
      name: 'Integration Student',
      email: 'student@example.com',
      passwordHash: await bcrypt.hash('Study1234', 10),
      role: 'student',
      contributor: false,
    });
  }

  async function requestResetAndGetToken() {
    const response = await request(app)
      .post('/api/v1/auth/forgot-password')
      .send({ email: 'student@example.com' });

    expect(response.status).toBe(200);
    expect(sendPasswordResetEmail).toHaveBeenCalledTimes(1);

    const resetUrl = new URL(sendPasswordResetEmail.mock.calls[0][1]);

    return resetUrl.searchParams.get('token');
  }

  test('returns the same generic response for existing and unknown emails', async () => {
    await createTestUser();

    const existing = await request(app)
      .post('/api/v1/auth/forgot-password')
      .send({ email: 'student@example.com' });

    const unknown = await request(app)
      .post('/api/v1/auth/forgot-password')
      .send({ email: 'unknown@example.com' });

    expect(existing.status).toBe(200);
    expect(unknown.status).toBe(200);
    expect(existing.body).toEqual(unknown.body);
    expect(existing.body.message).toMatch(/if an account exists/i);
    expect(unknown.body.message).toMatch(/if an account exists/i);
  });

  test('stores only a token hash and sets a 30-minute expiry', async () => {
    await createTestUser();

    const rawToken = await requestResetAndGetToken();

    expect(rawToken).toEqual(expect.any(String));

    const user = await User.findOne({ email: 'student@example.com' });
    const stored = await PasswordResetToken.findOne({
      userId: user._id,
    });

    expect(stored).not.toBeNull();
    expect(stored.tokenHash).toBe(hashToken(rawToken));
    expect(stored.tokenHash).not.toBe(rawToken);

    const remaining = stored.expiresAt.getTime() - Date.now();

    expect(remaining).toBeGreaterThan(RESET_TTL_MS - 10000);
    expect(remaining).toBeLessThanOrEqual(RESET_TTL_MS);
    expect(stored.usedAt).toBeNull();
  });

  test('resets the password, revokes refresh tokens, and rejects token reuse', async () => {
    await createTestUser();

    const login = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: 'student@example.com',
        password: 'Study1234',
      });

    expect(login.status).toBe(200);

    const refreshToken = getCookieToken(login);
    expect(refreshToken).toEqual(expect.any(String));

    const rawToken = await requestResetAndGetToken();

    const reset = await request(app)
      .post('/api/v1/auth/reset-password')
      .send({
        token: rawToken,
        password: 'NewStudy1234',
      });

    expect(reset.status).toBe(200);

    const user = await User.findOne({ email: 'student@example.com' })
      .select('+passwordHash');

    expect(await bcrypt.compare('NewStudy1234', user.passwordHash)).toBe(true);
    expect(await bcrypt.compare('Study1234', user.passwordHash)).toBe(false);

    const storedRefreshToken = await RefreshToken.findOne({
      tokenHash: hashToken(refreshToken),
    });

    expect(storedRefreshToken).not.toBeNull();
    expect(storedRefreshToken.revokedAt).toBeInstanceOf(Date);

    const reuse = await request(app)
      .post('/api/v1/auth/reset-password')
      .send({
        token: rawToken,
        password: 'AnotherStudy1234',
      });

    expect(reuse.status).toBe(400);
    expect(reuse.body.error.code).toBe('TOKEN_INVALID');
  });

  test('rejects an expired reset token', async () => {
    await createTestUser();

    const rawToken = await requestResetAndGetToken();

    await PasswordResetToken.updateOne(
      { tokenHash: hashToken(rawToken) },
      { $set: { expiresAt: new Date(Date.now() - 1000) } },
    );

    const response = await request(app)
      .post('/api/v1/auth/reset-password')
      .send({
        token: rawToken,
        password: 'NewStudy1234',
      });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('TOKEN_INVALID');
  });

  test('invalidates the reset token when email delivery fails', async () => {
    await createTestUser();

    sendPasswordResetEmail.mockRejectedValueOnce(
      new Error('Simulated email failure'),
    );

    const response = await request(app)
      .post('/api/v1/auth/forgot-password')
      .send({ email: 'student@example.com' });

    expect(response.status).toBe(200);
    expect(response.body.message).toMatch(/if an account exists/i);

    const user = await User.findOne({ email: 'student@example.com' });
    const stored = await PasswordResetToken.findOne({
      userId: user._id,
    });

    expect(stored).not.toBeNull();
    expect(stored.usedAt).toBeInstanceOf(Date);
  });
});
