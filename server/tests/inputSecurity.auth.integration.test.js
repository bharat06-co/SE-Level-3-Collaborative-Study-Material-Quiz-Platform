const request = require('supertest');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { MongoMemoryReplSet } = require('mongodb-memory-server');
const { createApp } = require('../src/app');
const { createAuthenticatedFeatures } = require('../src/config/features');
const User = require('../src/models/User');
const RefreshToken = require('../src/models/RefreshToken');

jest.setTimeout(120000);
const password = 'SecurityTest1234';
const previous = {};
let mongo;
let app;
beforeAll(async () => {
  for (const key of ['MONGODB_URI', 'JWT_ACCESS_SECRET', 'JWT_ACCESS_TTL']) previous[key] = process.env[key];
  mongo = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  process.env.MONGODB_URI = mongo.getUri();
  process.env.JWT_ACCESS_SECRET = 'isolated-input-security-secret-'.repeat(3);
  process.env.JWT_ACCESS_TTL = '15m';
  await mongoose.connect(mongo.getUri());
  await Promise.all([User.init(), RefreshToken.init()]);
  await User.create({ name: 'Security Student', email: 'security@example.com', passwordHash: await bcrypt.hash(password, 10), role: 'student', contributor: false });
  app = createApp({ ...createAuthenticatedFeatures() });
});
afterAll(async () => {
  try { await mongoose.disconnect(); } finally {
    if (mongo) await mongo.stop();
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  }
});

test.each([
  { email: { $gt: '' }, password },
  { email: 'security@example.com', password: { $ne: null } },
  JSON.parse('{"email":"security@example.com","password":"wrong","nested":{"__proto__":{"polluted":true}}}'),
])('actual login rejects operator/prototype input before querying users', async payload => {
  const lookup = jest.spyOn(User, 'findOne');
  try {
    const response = await request(app).post('/api/v1/auth/login').send(payload);
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
    expect(response.body.accessToken).toBeUndefined();
    expect(lookup).not.toHaveBeenCalled();
    expect(await RefreshToken.countDocuments()).toBe(0);
    expect({}.polluted).toBeUndefined();
  } finally { lookup.mockRestore(); }
});

test('registration operator input creates no user and ordinary real login remains functional', async () => {
  const before = await User.countDocuments();
  const rejected = await request(app).post('/api/v1/auth/register').send({ name: 'Attack', email: { $gt: '' }, password });
  expect(rejected.status).toBe(400);
  expect(rejected.body.error.code).toBe('VALIDATION_ERROR');
  expect(await User.countDocuments()).toBe(before);
  const login = await request(app).post('/api/v1/auth/login').send({ email: 'security@example.com', password });
  expect(login.status).toBe(200);
  expect(login.body.accessToken).toEqual(expect.any(String));
  const quiz = await request(app).post('/api/v1/quizzes').set('Authorization', `Bearer ${login.body.accessToken}`).send({ title: { $where: 'return true' } });
  expect(quiz.status).toBe(400);
  expect(quiz.body.error.code).toBe('VALIDATION_ERROR');
  const protectedRoute = await request(app).get('/api/v1/quizzes').set('Authorization', 'Bearer invalid-token');
  expect(protectedRoute.status).toBe(401);
  expect(protectedRoute.body.error.code).toBe('TOKEN_INVALID');
});
