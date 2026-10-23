
const os = require('node:os');
const path = require('node:path');
const fsp = require('node:fs/promises');
const request = require('supertest');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { MongoMemoryReplSet } = require('mongodb-memory-server');
const { createApp } = require('../src/app');
const User = require('../src/models/User');
const RefreshToken = require('../src/models/RefreshToken');
const { Material } = require('../src/models/Material');

jest.setTimeout(120000);

const TEST_JWT_SECRET = 'material-auth-integration-secret-'.repeat(3);
const PASSWORD = 'Study1234';
const FIELDS = {
  title: 'ER Diagrams',
  description: 'Entity relationship notes',
  category: 'Notes',
  topic: 'dbms',
  tags: 'er, dbms, ER',
  rightsConfirmed: 'true',
};
const FILE = {
  name: 'notes.pdf',
  contentType: 'application/pdf',
  bytes: Buffer.concat([Buffer.from('%PDF-1.7\n'), Buffer.from('material content')]),
};

let mongo;
let app;
let storageDir;
let originalJwtSecret;
let originalJwtTtl;
let originalMongoUri;

function binaryParser(res, callback) {
  const chunks = [];
  res.on('data', (chunk) => chunks.push(chunk));
  res.on('end', () => callback(null, Buffer.concat(chunks)));
}

function uploadRequest(token, overrides = {}) {
  let builder = request(app).post('/api/v1/materials');

  if (token) builder = builder.set('Authorization', `Bearer ${token}`);

  return builder
    .field('title', FIELDS.title)
    .field('description', FIELDS.description)
    .field('category', FIELDS.category)
    .field('topic', FIELDS.topic)
    .field('tags', FIELDS.tags)
    .field('rightsConfirmed', FIELDS.rightsConfirmed)
    .attach('file', FILE.bytes, {
      filename: FILE.name,
      contentType: FILE.contentType,
    })
    .then((response) => {
      if (overrides.expectStatus && response.status !== overrides.expectStatus) {
        throw new Error(
          `Expected ${overrides.expectStatus}, received ${response.status}: ${response.text}`,
        );
      }

      return response;
    });
}

function download(id, token) {
  let builder = request(app)
    .get(`/api/v1/materials/${id}/file`)
    .buffer(true)
    .parse(binaryParser);

  if (token) builder = builder.set('Authorization', `Bearer ${token}`);

  return builder;
}

async function createUser({ name, email, role = 'student', contributor = false }) {
  return User.create({
    name,
    email,
    passwordHash: await bcrypt.hash(PASSWORD, 10),
    role,
    contributor,
  });
}

async function login(email) {
  const response = await request(app)
    .post('/api/v1/auth/login')
    .send({ email, password: PASSWORD });

  expect(response.status).toBe(200);
  expect(response.body.accessToken).toEqual(expect.any(String));

  return response.body.accessToken;
}

async function createAndLogin(overrides) {
  const user = await createUser(overrides);
  return { user, token: await login(user.email) };
}

beforeAll(async () => {
  originalJwtSecret = process.env.JWT_ACCESS_SECRET;
  originalJwtTtl = process.env.JWT_ACCESS_TTL;
  originalMongoUri = process.env.MONGODB_URI;

  mongo = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  process.env.MONGODB_URI = mongo.getUri();
  process.env.JWT_ACCESS_SECRET = TEST_JWT_SECRET;
  process.env.JWT_ACCESS_TTL = '15m';

  await mongoose.connect(mongo.getUri(), { serverSelectionTimeoutMS: 15000 });
  await Promise.all([User.init(), RefreshToken.init(), Material.init()]);

  storageDir = path.join(
    os.tmpdir(),
    `t1-material-auth-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  );

  const { createAuthenticatedFeatures } = require('../src/config/features');
  const features = createAuthenticatedFeatures();
  app = createApp({
    databaseIsConnected: () => mongoose.connection.readyState === 1,
    storageDir,
    registerRoutes: features.registerRoutes,
  });
});

beforeEach(async () => {
    await Promise.all([
    Material.deleteMany({}),
    RefreshToken.deleteMany({}),
    User.deleteMany({}),
  ]);
  await fsp.rm(storageDir, { recursive: true, force: true });
});

afterAll(async () => {
  try {
    if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
  } finally {
    if (mongo) await mongo.stop();
    if (storageDir) await fsp.rm(storageDir, { recursive: true, force: true });

    if (originalJwtSecret === undefined) delete process.env.JWT_ACCESS_SECRET;
    else process.env.JWT_ACCESS_SECRET = originalJwtSecret;

    if (originalJwtTtl === undefined) delete process.env.JWT_ACCESS_TTL;
    else process.env.JWT_ACCESS_TTL = originalJwtTtl;

    if (originalMongoUri === undefined) delete process.env.MONGODB_URI;
    else process.env.MONGODB_URI = originalMongoUri;
  }
});

describe('Materials with the shared authentication middleware', () => {
  test('a contributor logs in, uploads, and reads only their own file', async () => {
    const { user: owner, token } = await createAndLogin({
      name: 'Owner Student',
      email: 'owner@example.com',
      contributor: true,
    });

    const upload = await uploadRequest(token, { expectStatus: 201 });
    const id = upload.body.id;

    expect(id).toMatch(/^[a-f\d]{24}$/);
    expect(upload.body).toMatchObject({
      title: FIELDS.title,
      visibility: 'private',
      fileUrl: `/api/v1/materials/${id}/file`,
    });

    const stored = await Material.findById(id).lean();
    expect(stored.ownerId.toString()).toBe(owner._id.toString());

    const detail = await request(app)
      .get(`/api/v1/materials/${id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(detail.status).toBe(200);
    expect(detail.body).toMatchObject({
      id,
      ownerId: owner._id.toString(),
      visibility: 'private',
      tags: ['er', 'dbms'],
    });
    expect(detail.body).not.toHaveProperty('storageKey');

    const file = await download(id, token);
    expect(file.status).toBe(200);
    expect(file.headers['content-type']).toMatch(/^application\/pdf/);
    expect(file.headers['content-disposition']).toBe(
      `attachment; filename="material-${id}.pdf"`,
    );
    expect(file.body.equals(FILE.bytes)).toBe(true);
  });

  test('a signed-in plain student cannot upload and nothing is persisted', async () => {
    const { token } = await createAndLogin({
      name: 'Plain Student',
      email: 'plain@example.com',
      contributor: false,
    });

    const response = await uploadRequest(token);

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('FORBIDDEN');
    expect(await Material.countDocuments()).toBe(0);
  });

  test('admin grants and revokes contributor access for the same JWT', async () => {
    const { user: student, token: studentToken } = await createAndLogin({
      name: 'Lifecycle Student',
      email: 'lifecycle@example.com',
      contributor: false,
    });

    const { token: adminToken } = await createAndLogin({
      name: 'Lifecycle Admin',
      email: 'lifecycle-admin@example.com',
      role: 'admin',
    });

           const countFiles = async (dir) => {
      let entries;

      try {
        entries = await fsp.readdir(dir, { withFileTypes: true });
      } catch (error) {
        if (error.code === 'ENOENT') return 0;
        throw error;
      }

      let count = 0;

      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);

        if (entry.isDirectory()) {
          count += await countFiles(fullPath);
        } else if (entry.isFile()) {
          count++;
        }
      }

      return count;
    };
    // 1. Student cannot upload before being granted access.
    const initialMaterials = await Material.countDocuments();
    const initialFiles = await countFiles(storageDir);

    const deniedBefore = await uploadRequest(studentToken);

    expect(deniedBefore.status).toBe(403);
    expect(deniedBefore.body.error.code).toBe('FORBIDDEN');
    expect(await Material.countDocuments()).toBe(initialMaterials);
    expect(await countFiles(storageDir)).toBe(initialFiles);

    // 2. Admin grants contributor access.
    const grant = await request(app)
      .patch(`/api/v1/admin/users/${student._id}/role`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ contributor: true });

    expect(grant.status).toBe(200);
    expect(grant.body.user.contributor).toBe(true);

    // 3. The SAME student JWT can now upload.
    const upload = await uploadRequest(studentToken);

    expect(upload.status).toBe(201);
    expect(await Material.countDocuments()).toBe(initialMaterials + 1);
    expect(await countFiles(storageDir)).toBe(initialFiles + 1);

    // 4. Admin revokes contributor access.
    const revoke = await request(app)
      .patch(`/api/v1/admin/users/${student._id}/role`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ contributor: false });

    expect(revoke.status).toBe(200);
    expect(revoke.body.user.contributor).toBe(false);

    // 5. The SAME JWT must now be denied.
    const materialsBeforeDeniedUpload = await Material.countDocuments();
    const filesBeforeDeniedUpload = await countFiles(storageDir);

    const deniedAfter = await uploadRequest(studentToken);

    expect(deniedAfter.status).toBe(403);
    expect(deniedAfter.body.error.code).toBe('FORBIDDEN');

    // 6. Denied upload creates no database record or stored file.
    expect(await Material.countDocuments()).toBe(materialsBeforeDeniedUpload);
    expect(await countFiles(storageDir)).toBe(filesBeforeDeniedUpload);
  });


  test('another signed-in user gets 404 for private detail and download', async () => {
    const { token: ownerToken } = await createAndLogin({
      name: 'Owner Student',
      email: 'owner@example.com',
      contributor: true,
    });
    const { token: otherToken } = await createAndLogin({
      name: 'Other Student',
      email: 'other@example.com',
      contributor: false,
    });

    const upload = await uploadRequest(ownerToken, { expectStatus: 201 });
    const id = upload.body.id;

    const detail = await request(app)
      .get(`/api/v1/materials/${id}`)
      .set('Authorization', `Bearer ${otherToken}`);
    expect(detail.status).toBe(404);
    expect(detail.body.error.code).toBe('NOT_FOUND');

    expect((await download(id, otherToken)).status).toBe(404);
    expect((await download(id, ownerToken)).status).toBe(200);
  });

  test('shared and public visibility are enforced with real identities', async () => {
    const { token: ownerToken } = await createAndLogin({
      name: 'Owner Student',
      email: 'owner@example.com',
      contributor: true,
    });
    const { user: sharedUser, token: sharedToken } = await createAndLogin({
      name: 'Shared Student',
      email: 'shared@example.com',
    });
    const { token: otherToken } = await createAndLogin({
      name: 'Other Student',
      email: 'other@example.com',
    });

    const upload = await uploadRequest(ownerToken, { expectStatus: 201 });
    const id = upload.body.id;

    await Material.updateOne(
      { _id: id },
      { $set: { visibility: 'shared', sharedWith: [sharedUser._id] } },
    );

    expect((await request(app).get(`/api/v1/materials/${id}`).set('Authorization', `Bearer ${sharedToken}`)).status).toBe(200);
    expect((await download(id, sharedToken)).status).toBe(200);
    expect((await request(app).get(`/api/v1/materials/${id}`).set('Authorization', `Bearer ${otherToken}`)).status).toBe(404);

    await Material.updateOne({ _id: id }, { $set: { visibility: 'public' } });

    const publicDetail = await request(app)
      .get(`/api/v1/materials/${id}`)
      .set('Authorization', `Bearer ${otherToken}`);
    expect(publicDetail.status).toBe(200);
    expect(publicDetail.body.visibility).toBe('public');
    expect((await download(id, otherToken)).status).toBe(200);
  });

  test('hidden material is visible to its owner and an admin only', async () => {
    const { token: ownerToken } = await createAndLogin({
      name: 'Owner Student',
      email: 'owner@example.com',
      contributor: true,
    });
    const { token: otherToken } = await createAndLogin({
      name: 'Other Student',
      email: 'other@example.com',
    });
    const { token: adminToken } = await createAndLogin({
      name: 'Admin User',
      email: 'admin@example.com',
      role: 'admin',
    });

    const upload = await uploadRequest(ownerToken, { expectStatus: 201 });
    const id = upload.body.id;

    await Material.updateOne(
      { _id: id },
      { $set: { visibility: 'public', hidden: true } },
    );

    expect((await request(app).get(`/api/v1/materials/${id}`).set('Authorization', `Bearer ${otherToken}`)).status).toBe(404);
    expect((await request(app).get(`/api/v1/materials/${id}`).set('Authorization', `Bearer ${ownerToken}`)).status).toBe(200);
    expect((await request(app).get(`/api/v1/materials/${id}`).set('Authorization', `Bearer ${adminToken}`)).status).toBe(200);
    expect((await download(id, adminToken)).status).toBe(200);
  });

  test('missing or invalid tokens are rejected before material handling', async () => {
    const { token } = await createAndLogin({
      name: 'Owner Student',
      email: 'owner@example.com',
      contributor: true,
    });
    const upload = await uploadRequest(token, { expectStatus: 201 });
    const id = upload.body.id;

    const noToken = await request(app).get(`/api/v1/materials/${id}`);
    expect(noToken.status).toBe(401);
    expect(noToken.body.error.code).toBe('UNAUTHENTICATED');

    const badToken = await request(app)
      .get(`/api/v1/materials/${id}`)
      .set('Authorization', 'Bearer not-a-real-token');
    expect(badToken.status).toBe(401);
    expect(badToken.body.error.code).toBe('TOKEN_INVALID');

    const noTokenDownload = await request(app).get(`/api/v1/materials/${id}/file`);
    expect(noTokenDownload.status).toBe(401);
    expect(noTokenDownload.body.error.code).toBe('UNAUTHENTICATED');

    const badTokenDownload = await request(app)
      .get(`/api/v1/materials/${id}/file`)
      .set('Authorization', 'Bearer not-a-real-token');
    expect(badTokenDownload.status).toBe(401);
    expect(badTokenDownload.body.error.code).toBe('TOKEN_INVALID');

    const noTokenUpload = await request(app)
      .post('/api/v1/materials')
      .field('title', FIELDS.title)
      .field('description', FIELDS.description)
      .field('category', FIELDS.category)
      .field('topic', FIELDS.topic)
      .field('tags', FIELDS.tags)
      .field('rightsConfirmed', FIELDS.rightsConfirmed)
      .attach('file', FILE.bytes, {
        filename: FILE.name,
        contentType: FILE.contentType,
      });
    expect(noTokenUpload.status).toBe(401);
    expect(noTokenUpload.body.error.code).toBe('UNAUTHENTICATED');

    const badTokenUpload = await request(app)
      .post('/api/v1/materials')
      .set('Authorization', 'Bearer not-a-real-token')
      .field('title', FIELDS.title)
      .field('description', FIELDS.description)
      .field('category', FIELDS.category)
      .field('topic', FIELDS.topic)
      .field('tags', FIELDS.tags)
      .field('rightsConfirmed', FIELDS.rightsConfirmed)
      .attach('file', FILE.bytes, {
        filename: FILE.name,
        contentType: FILE.contentType,
      });
    expect(badTokenUpload.status).toBe(401);
    expect(badTokenUpload.body.error.code).toBe('TOKEN_INVALID');
    expect(await Material.countDocuments()).toBe(1);
  });

  test.each([
    ['missing authorization', 'UNAUTHENTICATED', () => undefined],
    ['malformed authorization header', 'UNAUTHENTICATED', () => 'Basic abc123'],
    ['invalid access token', 'TOKEN_INVALID', () => 'Bearer not-a-real-token'],
    [
      'expired access token',
      'TOKEN_INVALID',
      (ownerId) => `Bearer ${jwt.sign({}, TEST_JWT_SECRET, {
        algorithm: 'HS256',
        subject: ownerId,
        expiresIn: -1,
      })}`,
    ],
    [
      'access token missing exp',
      'TOKEN_INVALID',
      (ownerId) => `Bearer ${jwt.sign({}, TEST_JWT_SECRET, {
        algorithm: 'HS256',
        subject: ownerId,
      })}`,
    ],
  ])('contract: %s is rejected with 401 %s', async (_case, expectedCode, authorizationFor) => {
    const { user } = await createAndLogin({
      name: 'Owner Student',
      email: 'owner@example.com',
      contributor: true,
    });
    const id = new mongoose.Types.ObjectId().toString();
    const authorization = authorizationFor(user._id.toString());

    let getBuilder = request(app).get(`/api/v1/materials/${id}`);
    let fileBuilder = request(app).get(`/api/v1/materials/${id}/file`);
    let postBuilder = request(app)
      .post('/api/v1/materials')
      .field('title', FIELDS.title)
      .field('description', FIELDS.description)
      .field('category', FIELDS.category)
      .field('topic', FIELDS.topic)
      .field('tags', FIELDS.tags)
      .field('rightsConfirmed', FIELDS.rightsConfirmed)
      .attach('file', FILE.bytes, {
        filename: FILE.name,
        contentType: FILE.contentType,
      });

    if (authorization !== undefined) {
      getBuilder = getBuilder.set('Authorization', authorization);
      fileBuilder = fileBuilder.set('Authorization', authorization);
      postBuilder = postBuilder.set('Authorization', authorization);
    }

    const [getResponse, fileResponse, postResponse] = await Promise.all([
      getBuilder,
      fileBuilder,
      postBuilder,
    ]);

    expect(getResponse.status).toBe(401);
    expect(getResponse.body.error.code).toBe(expectedCode);
    expect(fileResponse.status).toBe(401);
    expect(fileResponse.body.error.code).toBe(expectedCode);
    expect(postResponse.status).toBe(401);
    expect(postResponse.body.error.code).toBe(expectedCode);
  });

  test('contract: upload without an access token is rejected with 401 UNAUTHENTICATED', async () => {
    const response = await uploadRequest(null);

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('UNAUTHENTICATED');
    expect(await Material.countDocuments()).toBe(0);
  });

  test('multipart upload containing operator or prototype fields is rejected with 400 VALIDATION_ERROR', async () => {
    const { token } = await createAndLogin({
      name: 'Contributor Student',
      email: 'contributor@example.com',
      contributor: true,
    });

    const operatorResponse = await request(app)
      .post('/api/v1/materials')
      .set('Authorization', `Bearer ${token}`)
      .field('title', 'Valid title')
      .field('description', 'Valid description')
      .field('category', 'Notes')
      .field('topic', 'dbms')
      .field('tags', 'dbms, sql')
      .field('rightsConfirmed', 'true')
      .field('$where', 'malicious')
      .attach('file', FILE.bytes, {
        filename: FILE.name,
        contentType: FILE.contentType,
      });

    expect(operatorResponse.status).toBe(400);
    expect(operatorResponse.body.error.code).toBe('VALIDATION_ERROR');

    const protoResponse = await request(app)
      .post('/api/v1/materials')
      .set('Authorization', `Bearer ${token}`)
      .field('title', 'Valid title')
      .field('description', 'Valid description')
      .field('category', 'Notes')
      .field('topic', 'dbms')
      .field('tags', 'dbms, sql')
      .field('rightsConfirmed', 'true')
      .field('__proto__', 'polluted')
      .attach('file', FILE.bytes, {
        filename: FILE.name,
        contentType: FILE.contentType,
      });

    expect(protoResponse.status).toBe(400);
    expect(protoResponse.body.error.code).toBe('VALIDATION_ERROR');
    expect(await Material.countDocuments()).toBe(0);
  });

  test('authenticated detail rejects malformed and unknown IDs', async () => {
    const { token } = await createAndLogin({
      name: 'Owner Student',
      email: 'owner@example.com',
      contributor: true,
    });

    const malformed = await request(app)
      .get('/api/v1/materials/not-an-object-id')
      .set('Authorization', `Bearer ${token}`);
    expect(malformed.status).toBe(400);
    expect(malformed.body.error.code).toBe('VALIDATION_ERROR');

    const unknown = await request(app)
      .get(`/api/v1/materials/${new mongoose.Types.ObjectId()}`)
      .set('Authorization', `Bearer ${token}`);
    expect(unknown.status).toBe(404);
  });
});
