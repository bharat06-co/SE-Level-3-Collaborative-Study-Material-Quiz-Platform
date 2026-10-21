
jest.mock('../src/modules/auth/user.repository', () => ({
  findById: jest.fn(),
}));

jest.mock('../src/config/env', () => ({
  readEnv: jest.fn(),
}));

const jwt = require('jsonwebtoken');
const request = require('supertest');
const { createApp } = require('../src/app');
const { readEnv } = require('../src/config/env');
const userRepository = require('../src/modules/auth/user.repository');
const { createAuthenticate } = require('../src/middleware/authenticate');

const SECRET = 'a'.repeat(64);
const USER_ID = '507f1f77bcf86cd799439011';

function makeToken(overrides = {}, options = {}) {
  return jwt.sign(
    { sub: USER_ID, ...overrides },
    SECRET,
    { algorithm: 'HS256', expiresIn: '15m', ...options },
  );
}

function makeApp() {
  const authenticate = createAuthenticate();

  return createApp({
    databaseIsConnected: () => true,
    registerRoutes(app) {
      app.get('/protected', authenticate, (req, res) => {
        res.json({ auth: req.auth });
      });
    },
  });
}

describe('FR-004 authentication middleware', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    readEnv.mockReturnValue({
      JWT_ACCESS_SECRET: SECRET,
      JWT_ACCESS_TTL: '15m',
    });

    userRepository.findById.mockResolvedValue({
      _id: USER_ID,
      role: 'student',
      contributor: false,
    });
  });

  test('uses database permissions rather than JWT role claims', async () => {
    const token = makeToken({ role: 'admin', contributor: true });

    const response = await request(makeApp())
      .get('/protected')
      .set('Authorization', 'Bearer ' + token);

    expect(response.status).toBe(200);
    expect(response.body.auth).toEqual({
      userId: USER_ID,
      role: 'student',
      contributor: false,
    });
    expect(userRepository.findById).toHaveBeenCalledWith(USER_ID);
  });

  test.each([
    ['missing authorization', undefined],
    ['unsupported authorization scheme', 'Basic abc123'],
    ['malformed bearer header', 'Bearer'],
  ])('rejects %s with 401', async (_description, authorization) => {
    let req = request(makeApp()).get('/protected');

    if (authorization !== undefined) {
      req = req.set('Authorization', authorization);
    }

    const response = await req;

    expect(response.status).toBe(401);
    expect(userRepository.findById).not.toHaveBeenCalled();
  });

  test('rejects an invalid token', async () => {
    const response = await request(makeApp())
      .get('/protected')
      .set('Authorization', 'Bearer not-a-valid-token');

    expect(response.status).toBe(401);
    expect(userRepository.findById).not.toHaveBeenCalled();
  });

  test('rejects an expired token', async () => {
    const token = makeToken({}, { expiresIn: -1 });

    const response = await request(makeApp())
      .get('/protected')
      .set('Authorization', 'Bearer ' + token);

    expect(response.status).toBe(401);
    expect(userRepository.findById).not.toHaveBeenCalled();
  });

  test('rejects a token with an invalid subject', async () => {
    const token = makeToken({ sub: 'not-a-user-id' });

    const response = await request(makeApp())
      .get('/protected')
      .set('Authorization', 'Bearer ' + token);

    expect(response.status).toBe(401);
    expect(userRepository.findById).not.toHaveBeenCalled();
  });

  test('rejects a user who no longer exists', async () => {
    userRepository.findById.mockResolvedValue(null);

    const response = await request(makeApp())
      .get('/protected')
      .set('Authorization', 'Bearer ' + makeToken());

    expect(response.status).toBe(401);
  });

  test('loads current permissions on every request', async () => {
    const app = makeApp();
    const token = makeToken({ role: 'student', contributor: false });

    userRepository.findById
      .mockResolvedValueOnce({
        _id: USER_ID,
        role: 'student',
        contributor: false,
      })
      .mockResolvedValueOnce({
        _id: USER_ID,
        role: 'educator',
        contributor: true,
      });

    const first = await request(app)
      .get('/protected')
      .set('Authorization', 'Bearer ' + token);

    const second = await request(app)
      .get('/protected')
      .set('Authorization', 'Bearer ' + token);

    expect(first.body.auth.role).toBe('student');
    expect(first.body.auth.contributor).toBe(false);
    expect(second.body.auth.role).toBe('educator');
    expect(second.body.auth.contributor).toBe(true);
    expect(userRepository.findById).toHaveBeenCalledTimes(2);
  });

  test('returns 503 when the JWT secret is missing', async () => {
    readEnv.mockReturnValue({
      JWT_ACCESS_SECRET: undefined,
      JWT_ACCESS_TTL: '15m',
    });

    const response = await request(makeApp())
      .get('/protected')
      .set('Authorization', 'Bearer ' + makeToken());

    expect(response.status).toBe(503);
    expect(userRepository.findById).not.toHaveBeenCalled();
  });
});
