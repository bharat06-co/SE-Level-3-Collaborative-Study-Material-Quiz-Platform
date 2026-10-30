const os = require('node:os');
const path = require('node:path');
const fsp = require('node:fs/promises');
const request = require('supertest');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { MongoMemoryReplSet } = require('mongodb-memory-server');
const { createApp } = require('../src/app');
const User = require('../src/models/User');
const RefreshToken = require('../src/models/RefreshToken');
const { Material } = require('../src/models/Material');
const MaterialRevision = require('../src/models/MaterialRevision');

jest.setTimeout(120000);

const TEST_JWT_SECRET = 'material-revisions-integration-secret-'.repeat(3);
const PASSWORD = 'Study1234';
const FIELDS = {
  title: 'ER Diagrams',
  description: 'Entity relationship notes',
  category: 'Notes',
  topic: 'dbms',
  tags: 'er, dbms, ER',
  rightsConfirmed: 'true',
};
const PDF_ONE = Buffer.concat([Buffer.from('%PDF-1.7\n'), Buffer.from('first file')]);
const PDF_TWO = Buffer.concat([Buffer.from('%PDF-1.7\n'), Buffer.from('second file')]);

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
  return response.body.accessToken;
}

async function createAndLogin(overrides) {
  const user = await createUser(overrides);
  return { user, token: await login(user.email) };
}

async function upload(token, bytes = PDF_ONE) {
  const response = await request(app)
    .post('/api/v1/materials')
    .set('Authorization', `Bearer ${token}`)
    .field('title', FIELDS.title)
    .field('description', FIELDS.description)
    .field('category', FIELDS.category)
    .field('topic', FIELDS.topic)
    .field('tags', FIELDS.tags)
    .field('rightsConfirmed', FIELDS.rightsConfirmed)
    .attach('file', bytes, { filename: 'notes.pdf', contentType: 'application/pdf' });

  expect(response.status).toBe(201);
  return response.body.id;
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
  await Promise.all([User.init(), RefreshToken.init(), Material.init(), MaterialRevision.init()]);

  storageDir = path.join(
    os.tmpdir(),
    `t1-material-revisions-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  );
  app = createApp({
    databaseIsConnected: () => mongoose.connection.readyState === 1,
    storageDir,
  });
});

beforeEach(async () => {
  await Promise.all([
    Material.deleteMany({}),
    MaterialRevision.deleteMany({}),
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

describe('Material revision history (FR-015) and metadata edit (FR-018)', () => {
  test('owner edit returns 200 and creates a revision holding the previous state', async () => {
    const { user: owner, token } = await createAndLogin({
      name: 'Owner Student',
      email: 'owner@example.com',
      contributor: true,
    });
    const id = await upload(token);

    const edit = await request(app)
      .patch(`/api/v1/materials/${id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'ER Diagrams v2', tags: ['er', 'dbms', 'updated'] });

    expect(edit.status).toBe(200);
    expect(edit.body.title).toBe('ER Diagrams v2');
    expect(edit.body.tags).toEqual(['er', 'dbms', 'updated']);

    const revisions = await request(app)
      .get(`/api/v1/materials/${id}/revisions`)
      .set('Authorization', `Bearer ${token}`);

    expect(revisions.status).toBe(200);
    expect(revisions.body.items).toHaveLength(1);
    expect(revisions.body.items[0]).toMatchObject({
      versionNo: 1,
      editorId: owner._id.toString(),
      title: FIELDS.title,
      tags: ['er', 'dbms'],
    });
  });

  test('sequential edits produce version numbers 1, 2, 3 and list newest first', async () => {
    const { token } = await createAndLogin({
      name: 'Owner Student',
      email: 'owner@example.com',
      contributor: true,
    });
    const id = await upload(token);

    for (const title of ['v1 edit', 'v2 edit', 'v3 edit']) {
      const response = await request(app)
        .patch(`/api/v1/materials/${id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ title });
      expect(response.status).toBe(200);
    }

    const revisions = await request(app)
      .get(`/api/v1/materials/${id}/revisions`)
      .set('Authorization', `Bearer ${token}`);

    expect(revisions.body.items.map((item) => item.versionNo)).toEqual([3, 2, 1]);
    expect(revisions.body.items.map((item) => item.title)).toEqual(['v2 edit', 'v1 edit', FIELDS.title]);
  });

  test('admin can edit any material and the revision records the admin editor', async () => {
    const { token: ownerToken } = await createAndLogin({
      name: 'Owner Student',
      email: 'owner@example.com',
      contributor: true,
    });
    const { user: admin, token: adminToken } = await createAndLogin({
      name: 'Admin User',
      email: 'admin@example.com',
      role: 'admin',
    });
    const id = await upload(ownerToken);

    const edit = await request(app)
      .patch(`/api/v1/materials/${id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ category: 'Slides' });
    expect(edit.status).toBe(200);
    expect(edit.body.category).toBe('Slides');

    const revisions = await request(app)
      .get(`/api/v1/materials/${id}/revisions`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(revisions.body.items[0]).toMatchObject({
      versionNo: 1,
      editorId: admin._id.toString(),
      category: FIELDS.category,
    });
  });

  test('a non-owner contributor receives 403 for edit/delete and leaves record, reference and file unchanged', async () => {
    const { token: ownerToken } = await createAndLogin({
      name: 'Owner Student',
      email: 'owner@example.com',
      contributor: true,
    });
    const { token: otherToken } = await createAndLogin({
      name: 'Other Contributor',
      email: 'other@example.com',
      contributor: true,
    });
    const id = await upload(ownerToken);
    const before = JSON.parse(JSON.stringify(await Material.findById(id).lean()));
    const originalFile = await request(app)
      .get(`/api/v1/materials/${id}/file`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .buffer(true)
      .parse(binaryParser);
    expect(originalFile.status).toBe(200);
    expect(originalFile.body.equals(PDF_ONE)).toBe(true);

    const edit = await request(app)
      .patch(`/api/v1/materials/${id}`)
      .set('Authorization', `Bearer ${otherToken}`)
      .send({ title: 'hacked' });
    expect(edit.status).toBe(403);
    expect(edit.body.error.code).toBe('FORBIDDEN');

    const deletion = await request(app)
      .delete(`/api/v1/materials/${id}`)
      .set('Authorization', `Bearer ${otherToken}`);
    expect(deletion.status).toBe(403);
    expect(deletion.body.error.code).toBe('FORBIDDEN');

    const revisions = await request(app)
      .get(`/api/v1/materials/${id}/revisions`)
      .set('Authorization', `Bearer ${ownerToken}`);
    expect(revisions.body.items).toHaveLength(0);
    expect(JSON.parse(JSON.stringify(await Material.findById(id).lean()))).toEqual(before);

    const preservedFile = await request(app)
      .get(`/api/v1/materials/${id}/file`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .buffer(true)
      .parse(binaryParser);
    expect(preservedFile.status).toBe(200);
    expect(preservedFile.body.equals(PDF_ONE)).toBe(true);
  });

  test.each([
    ['owner', false],
    ['admin', true],
  ])('%s deletion removes both the material record and stored file', async (_actor, useAdmin) => {
    const { token: ownerToken } = await createAndLogin({
      name: 'Owner Student',
      email: 'owner@example.com',
      contributor: true,
    });
    let actorToken = ownerToken;
    if (useAdmin) {
      ({ token: actorToken } = await createAndLogin({
        name: 'Admin User',
        email: 'admin@example.com',
        role: 'admin',
      }));
    }
    const id = await upload(ownerToken);
    const stored = await Material.findById(id).lean();
    const storedPath = path.join(storageDir, stored.storageKey);
    await expect(fsp.readFile(storedPath)).resolves.toEqual(PDF_ONE);

    const deletion = await request(app)
      .delete(`/api/v1/materials/${id}`)
      .set('Authorization', `Bearer ${actorToken}`);
    expect(deletion.status).toBe(204);
    expect(deletion.text).toBe('');
    await expect(Material.findById(id).lean()).resolves.toBeNull();
    await expect(fsp.readFile(storedPath)).rejects.toMatchObject({ code: 'ENOENT' });
  });

  test('material deletion returns the standard authentication, validation and missing-resource errors', async () => {
    const { token } = await createAndLogin({
      name: 'Owner Student',
      email: 'owner@example.com',
      contributor: true,
    });

    const noToken = await request(app).delete(`/api/v1/materials/${new mongoose.Types.ObjectId()}`);
    expect(noToken.status).toBe(401);
    expect(noToken.body.error.code).toBe('UNAUTHENTICATED');

    const malformed = await request(app)
      .delete('/api/v1/materials/not-an-id')
      .set('Authorization', `Bearer ${token}`);
    expect(malformed.status).toBe(400);
    expect(malformed.body.error.code).toBe('VALIDATION_ERROR');

    const missing = await request(app)
      .delete(`/api/v1/materials/${new mongoose.Types.ObjectId()}`)
      .set('Authorization', `Bearer ${token}`);
    expect(missing.status).toBe(404);
    expect(missing.body.error.code).toBe('NOT_FOUND');
  });

  test('only owner or admin can read revisions', async () => {
    const { token: ownerToken } = await createAndLogin({
      name: 'Owner Student',
      email: 'owner@example.com',
      contributor: true,
    });
    const { token: otherToken } = await createAndLogin({
      name: 'Other Student',
      email: 'other@example.com',
    });
    const id = await upload(ownerToken);

    const denied = await request(app)
      .get(`/api/v1/materials/${id}/revisions`)
      .set('Authorization', `Bearer ${otherToken}`);
    expect(denied.status).toBe(403);
    expect(denied.body.error.code).toBe('FORBIDDEN');

    const noToken = await request(app).get(`/api/v1/materials/${id}/revisions`);
    expect(noToken.status).toBe(401);
    expect(noToken.body.error.code).toBe('UNAUTHENTICATED');

    const unknown = await request(app)
      .get(`/api/v1/materials/${new mongoose.Types.ObjectId()}/revisions`)
      .set('Authorization', `Bearer ${ownerToken}`);
    expect(unknown.status).toBe(404);

    const malformed = await request(app)
      .get('/api/v1/materials/not-an-id/revisions')
      .set('Authorization', `Bearer ${ownerToken}`);
    expect(malformed.status).toBe(400);
  });

  test('invalid metadata is rejected without changing the material or writing a revision', async () => {
    const { token } = await createAndLogin({
      name: 'Owner Student',
      email: 'owner@example.com',
      contributor: true,
    });
    const id = await upload(token);

    const edit = await request(app)
      .patch(`/api/v1/materials/${id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'ab' });
    expect(edit.status).toBe(400);
    expect(edit.body.error.code).toBe('VALIDATION_ERROR');

    expect(await MaterialRevision.countDocuments()).toBe(0);
    expect((await Material.findById(id)).title).toBe(FIELDS.title);
  });

  test('file replacement updates the file and preserves the old fileUrl in the revision', async () => {
    const { token } = await createAndLogin({
      name: 'Owner Student',
      email: 'owner@example.com',
      contributor: true,
    });
    const id = await upload(token, PDF_ONE);

    const edit = await request(app)
      .patch(`/api/v1/materials/${id}`)
      .set('Authorization', `Bearer ${token}`)
      .attach('file', PDF_TWO, { filename: 'replacement.pdf', contentType: 'application/pdf' });
    expect(edit.status).toBe(200);
    expect(edit.body.sizeBytes).toBe(PDF_TWO.length);

    const download = await request(app)
      .get(`/api/v1/materials/${id}/file`)
      .set('Authorization', `Bearer ${token}`)
      .buffer(true)
      .parse(binaryParser);
    expect(download.status).toBe(200);
    expect(download.body.equals(PDF_TWO)).toBe(true);

    const revisions = await request(app)
      .get(`/api/v1/materials/${id}/revisions`)
      .set('Authorization', `Bearer ${token}`);
    expect(revisions.body.items[0]).toMatchObject({
      versionNo: 1,
      fileUrl: `/api/v1/materials/${id}/file`,
    });

    const stored = await Material.findById(id);
    expect(stored.mimeType).toBe('application/pdf');
    expect(stored.sizeBytes).toBe(PDF_TWO.length);
  });
});
