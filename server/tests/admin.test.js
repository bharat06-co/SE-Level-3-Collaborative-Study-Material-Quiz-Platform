
const request = require('supertest');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { MongoMemoryReplSet } = require('mongodb-memory-server');

const { createApp } = require('../src/app');
const User = require('../src/models/User');
const RefreshToken = require('../src/models/RefreshToken');
const { createAuthenticatedFeatures } = require('../src/config/features');

jest.setTimeout(90000);

describe('Admin user management', () => {
  let mongo;
  let app;
  let originalJwtSecret;
  let originalJwtTtl;
  let originalMongoUri;
  let student;
  let admin;
  let studentToken;
  let adminToken;

  async function makeUser(overrides = {}) {
    const passwordHash = await bcrypt.hash('Study1234', 10);

    return User.create({
      name: 'Test User',
      email: `${new mongoose.Types.ObjectId()}@example.com`,
      passwordHash,
      role: 'student',
      contributor: false,
      ...overrides,
    });
  }

  function tokenFor(user) {
    return jwt.sign(
      { sub: user._id.toString() },
      process.env.JWT_ACCESS_SECRET,
      { algorithm: 'HS256', expiresIn: '15m' },
    );
  }

  beforeAll(async () => {
    originalJwtSecret = process.env.JWT_ACCESS_SECRET;
    originalJwtTtl = process.env.JWT_ACCESS_TTL;
    originalMongoUri = process.env.MONGODB_URI;

    mongo = await MongoMemoryReplSet.create({
      replSet: { count: 1 },
    });

    process.env.MONGODB_URI = mongo.getUri();
    process.env.JWT_ACCESS_SECRET = 'admin-test-secret'.repeat(4);
    process.env.JWT_ACCESS_TTL = '15m';

    await mongoose.connect(mongo.getUri());
    await Promise.all([User.init(), RefreshToken.init()]);

    app = createApp({
      origins: ['http://localhost:5173'],
      databaseIsConnected: () => mongoose.connection.readyState === 1,
      logger: require('pino')({ level: 'silent' }),
      ...createAuthenticatedFeatures(),
    });
  });

  beforeEach(async () => {
    await RefreshToken.deleteMany({});
    await User.deleteMany({});

    student = await makeUser({
      name: 'Test Student',
      email: 'student@example.com',
    });

    admin = await makeUser({
      name: 'Test Admin',
      email: 'admin@example.com',
      role: 'admin',
    });

    studentToken = tokenFor(student);
    adminToken = tokenFor(admin);
  });

  afterAll(async () => {
    try {
      if (mongoose.connection.readyState !== 0) {
        await mongoose.disconnect();
      }

      if (mongo) {
        await mongo.stop();
      }
    } finally {
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

  test('rejects unauthenticated and non-admin access', async () => {
    await request(app)
      .get('/api/v1/admin/users')
      .expect(401);

    await request(app)
      .get('/api/v1/admin/users')
      .set('Authorization', `Bearer ${studentToken}`)
      .expect(403);

    await request(app)
      .patch(`/api/v1/admin/users/${student._id}/role`)
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ contributor: true })
      .expect(403);

    const unchangedStudent = await User.findById(student._id).lean();
    expect(unchangedStudent.contributor).toBe(false);
  });

  test('admin lists users without exposing password hashes or passwords', async () => {
    const response = await request(app)
      .get('/api/v1/admin/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(response.body.users).toHaveLength(2);
    expect(response.body.users).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          email: 'student@example.com',
          role: 'student',
          contributor: false,
        }),
        expect.objectContaining({
          email: 'admin@example.com',
          role: 'admin',
        }),
      ]),
    );

    expect(JSON.stringify(response.body)).not.toContain('passwordHash');
    expect(JSON.stringify(response.body)).not.toContain('Study1234');

    for (const user of response.body.users) {
      expect(user).not.toHaveProperty('passwordHash');
      expect(user).not.toHaveProperty('password');
      expect(user).not.toHaveProperty('token');
      expect(user).not.toHaveProperty('refreshToken');
    }
  });

  test('admin grants contributor privilege and the database reflects it', async () => {
    const response = await request(app)
      .patch(`/api/v1/admin/users/${student._id}/role`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ contributor: true })
      .expect(200);

    expect(response.body.user.contributor).toBe(true);
    expect(response.body.user).not.toHaveProperty('passwordHash');

    const updatedStudent = await User.findById(student._id).lean();
    expect(updatedStudent.contributor).toBe(true);
    expect(updatedStudent.role).toBe('student');

    // Authentication must read the user's current database permissions.
    // This confirms the same token is still recognized, but does not by
    // itself prove access to a contributor-only upload endpoint.
    const adminOnlyResponse = await request(app)
      .get('/api/v1/admin/users')
      .set('Authorization', `Bearer ${studentToken}`)
      .expect(403);

    expect(adminOnlyResponse.status).toBe(403);
  });

  test('validates role, contributor type, and user ID', async () => {
    await request(app)
      .patch(`/api/v1/admin/users/${student._id}/role`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ role: 'superadmin' })
      .expect(400);

    await request(app)
      .patch(`/api/v1/admin/users/${student._id}/role`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ contributor: 'yes' })
      .expect(400);

    await request(app)
      .patch('/api/v1/admin/users/not-an-id/role')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ contributor: true })
      .expect(400);

    await request(app)
      .patch(`/api/v1/admin/users/${student._id}/role`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({})
      .expect(400);
  });

  test('returns not found when updating a nonexistent user', async () => {
    await request(app)
      .patch(`/api/v1/admin/users/${new mongoose.Types.ObjectId()}/role`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ contributor: true })
      .expect(404);
  });

  test('admin updates role and contributor together', async () => {
    const response = await request(app)
      .patch(`/api/v1/admin/users/${student._id}/role`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ role: 'educator', contributor: true })
      .expect(200);

    expect(response.body.user).toEqual(
      expect.objectContaining({
        email: 'student@example.com',
        role: 'educator',
        contributor: true,
      }),
    );

    expect(response.body.user).not.toHaveProperty('passwordHash');

    const storedStudent = await User.findById(student._id).lean();
    expect(storedStudent.role).toBe('educator');
    expect(storedStudent.contributor).toBe(true);
  });
});
