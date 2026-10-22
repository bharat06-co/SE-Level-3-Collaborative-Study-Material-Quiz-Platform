const jwt = require('jsonwebtoken');
const request = require('supertest');
const { createApp } = require('../src/app');
const { createAuthenticate } = require('../src/middleware/authenticate');

const userId = '507f1f77bcf86cd799439011';
const secret = 'q'.repeat(64);

describe('quiz routes with merged authentication middleware', () => {
  const previousUri = process.env.MONGODB_URI;
  const previousSecret = process.env.JWT_ACCESS_SECRET;

  beforeAll(() => {
    process.env.MONGODB_URI = 'mongodb://127.0.0.1:27017/quiz-auth-test';
    process.env.JWT_ACCESS_SECRET = secret;
  });

  afterAll(() => {
    if (previousUri === undefined) delete process.env.MONGODB_URI;
    else process.env.MONGODB_URI = previousUri;
    if (previousSecret === undefined) delete process.env.JWT_ACCESS_SECRET;
    else process.env.JWT_ACCESS_SECRET = previousSecret;
  });

  test('Bearer token uses current database permissions for quiz authoring', async () => {
    let currentUser = { _id: userId, role: 'student', contributor: false };
    const findUserById = jest.fn(async () => currentUser);
    const app = createApp({
      quizAuthenticate: createAuthenticate({ findUserById }),
    });
    const token = jwt.sign({ sub: userId, role: 'admin', contributor: true }, secret, {
      algorithm: 'HS256',
      expiresIn: '15m',
    });

    const missing = await request(app).post('/api/v1/quizzes').send({});
    expect(missing.status).toBe(401);
    expect(findUserById).not.toHaveBeenCalled();

    const denied = await request(app).post('/api/v1/quizzes')
      .set('Authorization', `Bearer ${token}`).send({});
    expect(denied.status).toBe(403);
    expect(findUserById).toHaveBeenCalledWith(userId);

    currentUser = { _id: userId, role: 'educator', contributor: false };
    const allowedToValidate = await request(app).post('/api/v1/quizzes')
      .set('Authorization', `Bearer ${token}`).send({});
    expect(allowedToValidate.status).toBe(400);
    expect(allowedToValidate.body.error.code).toBe('VALIDATION_ERROR');
    expect(findUserById).toHaveBeenCalledTimes(2);
  });
});
