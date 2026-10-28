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
const { MaterialReport } = require('../src/models/MaterialReport');

jest.setTimeout(120000);

const TEST_JWT_SECRET = 'moderation-integration-secret-'.repeat(3);
const PASSWORD = 'Study1234';
const PDF = Buffer.concat([Buffer.from('%PDF-1.7\n'), Buffer.from('material')]);

let mongo;
let app;
let storageDir;
let originalJwtSecret;
let originalJwtTtl;
let originalMongoUri;

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

async function upload(token, suffix = '') {
  const response = await request(app)
    .post('/api/v1/materials')
    .set('Authorization', `Bearer ${token}`)
    .field('title', `Database Notes${suffix}`)
    .field('description', 'Normalisation notes')
    .field('category', 'Notes')
    .field('topic', 'dbms')
    .field('tags', 'dbms, sql')
    .field('rightsConfirmed', 'true')
    .attach('file', PDF, { filename: 'notes.pdf', contentType: 'application/pdf' });
  expect(response.status).toBe(201);
  return response.body.id;
}

async function makePublic(token, id) {
  const response = await request(app)
    .patch(`/api/v1/materials/${id}`)
    .set('Authorization', `Bearer ${token}`)
    .send({ visibility: 'public' });
  expect(response.status).toBe(200);
}

function report(appToken, id, body = { reason: 'copyright' }) {
  return request(app)
    .post(`/api/v1/materials/${id}/reports`)
    .set('Authorization', `Bearer ${appToken}`)
    .send(body);
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
  await Promise.all([User.init(), RefreshToken.init(), Material.init(), MaterialReport.init()]);

  storageDir = path.join(os.tmpdir(), `t1-moderation-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  app = createApp({
    databaseIsConnected: () => mongoose.connection.readyState === 1,
    storageDir,
  });
});

beforeEach(async () => {
  await Promise.all([
    Material.deleteMany({}),
    MaterialReport.deleteMany({}),
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

async function setupPublicMaterial() {
  const owner = await createAndLogin({
    name: 'Owner One', email: 'owner1@example.com', contributor: true,
  });
  const reporter = await createAndLogin({
    name: 'Reporter One', email: 'reporter1@example.com',
  });
  const other = await createAndLogin({
    name: 'Other Student', email: 'other1@example.com',
  });
  const id = await upload(owner.token);
  await makePublic(owner.token, id);
  return { owner, reporter, other, id };
}

describe('Reporting material (FR-016)', () => {
  test('report is saved open, hides material from other users, and blocks a duplicate', async () => {
    const { owner, reporter, other, id } = await setupPublicMaterial();

    const created = await report(reporter.token, id, { reason: 'copyright', note: 'Original work' });
    expect(created.status).toBe(201);
    expect(created.body).toMatchObject({ status: 'open', reason: 'copyright', note: 'Original work' });

    expect((await Material.findById(id)).hidden).toBe(true);

    const otherSearch = await request(app).get('/api/v1/materials').set('Authorization', `Bearer ${other.token}`);
    expect(otherSearch.body.items.map((item) => item.id)).not.toContain(id);
    const ownerDetail = await request(app).get(`/api/v1/materials/${id}`).set('Authorization', `Bearer ${owner.token}`);
    expect(ownerDetail.status).toBe(200);

    const duplicate = await report(reporter.token, id, { reason: 'spam' });
    expect(duplicate.status).toBe(409);
    expect(duplicate.body.error.code).toBe('REPORT_EXISTS');
    expect(await MaterialReport.countDocuments({ materialId: id })).toBe(1);
  });

  test('contributor and educator can both report the same hidden public material', async () => {
    const { id } = await setupPublicMaterial();
    const contributor = await createAndLogin({
      name: 'Contributor', email: 'contributor@example.com', contributor: true,
    });
    const educator = await createAndLogin({
      name: 'Educator', email: 'educator@example.com', role: 'educator',
    });

    expect((await report(contributor.token, id, { reason: 'spam' })).status).toBe(201);
    expect((await report(educator.token, id, { reason: 'spam' })).status).toBe(201);
    expect(await MaterialReport.countDocuments({ materialId: id, status: 'open' })).toBe(2);
  });

  test.each([
    ['missing reason', {}],
    ['invalid reason', { reason: 'boring' }],
  ])('%s returns 400 and creates no report', async (_case, body) => {
    const { reporter, id } = await setupPublicMaterial();
    const response = await report(reporter.token, id, body);
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
    expect(await MaterialReport.countDocuments()).toBe(0);
  });

  test('admin cannot report and unknown/private material is hidden as 404', async () => {
    const { owner, reporter, id } = await setupPublicMaterial();
    const admin = await createAndLogin({
      name: 'Admin', email: 'admin@example.com', role: 'admin',
    });

    const adminAttempt = await report(admin.token, id, { reason: 'spam' });
    expect(adminAttempt.status).toBe(403);

    const privateMaterial = await upload(owner.token, ' Private');
    const privateAttempt = await report(reporter.token, privateMaterial, { reason: 'copyright' });
    expect(privateAttempt.status).toBe(404);

    const unknownAttempt = await report(reporter.token, new mongoose.Types.ObjectId().toString(), { reason: 'copyright' });
    expect(unknownAttempt.status).toBe(404);
  });
});

describe('Admin report review (FR-017)', () => {
  async function setupAdminQueue() {
    const { id } = await setupPublicMaterial();
    const admin = await createAndLogin({
      name: 'Admin', email: 'admin@example.com', role: 'admin',
    });
    const reporters = [];
    for (let index = 0; index < 3; index += 1) {
      const reporter = await createAndLogin({
        name: `Reporter ${index}`, email: `reporter-q${index}@example.com`,
      });
      reporters.push(reporter);
      expect((await report(reporter.token, id, { reason: 'copyright' })).status).toBe(201);
    }
    return { id, admin, reporters };
  }

  test('queue is admin-only and lists open reports oldest first', async () => {
    const { admin, reporters, id } = await setupAdminQueue();

    const denied = await request(app)
      .get('/api/v1/admin/reports?status=open')
      .set('Authorization', `Bearer ${reporters[0].token}`);
    expect(denied.status).toBe(403);
    expect(denied.body.error.code).toBe('FORBIDDEN');

    const queue = await request(app)
      .get('/api/v1/admin/reports?status=open')
      .set('Authorization', `Bearer ${admin.token}`);
    expect(queue.status).toBe(200);
    expect(queue.body.items).toHaveLength(3);
    expect(queue.body.items.every((item) => item.materialId === id)).toBe(true);
    expect(queue.body.items.every((item) => item.materialTitle.startsWith('Database Notes'))).toBe(true);
  });

  test('dismiss restores material only after the last open report is resolved', async () => {
    const { admin, reporters, id } = await setupAdminQueue();
    const queue = await request(app)
      .get('/api/v1/admin/reports?status=open')
      .set('Authorization', `Bearer ${admin.token}`);
    const [first, second, third] = queue.body.items;

    const dismiss = await request(app)
      .patch(`/api/v1/admin/reports/${first.id}`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ decision: 'dismiss' });
    expect(dismiss.status).toBe(200);
    expect(dismiss.body.status).toBe('dismissed');
    expect(dismiss.body.reviewer.id).toBe(admin.user._id.toString());
    expect((await Material.findById(id)).hidden).toBe(true);

    await request(app).patch(`/api/v1/admin/reports/${second.id}`).set('Authorization', `Bearer ${admin.token}`).send({ decision: 'dismiss' }).expect(200);
    expect((await Material.findById(id)).hidden).toBe(true);

    await request(app).patch(`/api/v1/admin/reports/${third.id}`).set('Authorization', `Bearer ${admin.token}`).send({ decision: 'dismiss' }).expect(200);
    expect((await Material.findById(id)).hidden).toBe(false);

    const visible = await request(app).get(`/api/v1/materials/${id}`).set('Authorization', `Bearer ${reporters[0].token}`);
    expect(visible.status).toBe(200);
  });

  test('dismiss does not restore material when another report was upheld', async () => {
    const { admin, id } = await setupAdminQueue();
    const queue = await request(app)
      .get('/api/v1/admin/reports?status=open')
      .set('Authorization', `Bearer ${admin.token}`);
    const [upheld, dismissed, remaining] = queue.body.items;

    await request(app)
      .patch(`/api/v1/admin/reports/${upheld.id}`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ decision: 'uphold' })
      .expect(200);
    expect((await Material.findById(id)).hidden).toBe(true);

    await request(app)
      .patch(`/api/v1/admin/reports/${dismissed.id}`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ decision: 'dismiss' })
      .expect(200);
    expect((await Material.findById(id)).hidden).toBe(true);

    await request(app)
      .patch(`/api/v1/admin/reports/${remaining.id}`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ decision: 'dismiss' })
      .expect(200);
    expect((await Material.findById(id)).hidden).toBe(true);
  });

  test('uphold keeps material hidden', async () => {
    const { admin, id } = await setupAdminQueue();
    const queue = await request(app)
      .get('/api/v1/admin/reports?status=open')
      .set('Authorization', `Bearer ${admin.token}`);

    const uphold = await request(app)
      .patch(`/api/v1/admin/reports/${queue.body.items[0].id}`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ decision: 'uphold' });
    expect(uphold.status).toBe(200);
    expect(uphold.body.status).toBe('actioned');
    expect((await Material.findById(id)).hidden).toBe(true);
  });

  test('non-admin, invalid decision, unknown report and re-decision are rejected', async () => {
    const { admin, reporters, id } = await setupAdminQueue();
    const queue = await request(app)
      .get('/api/v1/admin/reports?status=open')
      .set('Authorization', `Bearer ${admin.token}`);
    const reportId = queue.body.items[0].id;

    const nonAdmin = await request(app)
      .patch(`/api/v1/admin/reports/${reportId}`)
      .set('Authorization', `Bearer ${reporters[0].token}`)
      .send({ decision: 'dismiss' });
    expect(nonAdmin.status).toBe(403);

    const invalid = await request(app)
      .patch(`/api/v1/admin/reports/${reportId}`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ decision: 'delete' });
    expect(invalid.status).toBe(400);

    const unknown = await request(app)
      .patch(`/api/v1/admin/reports/${new mongoose.Types.ObjectId()}`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ decision: 'dismiss' });
    expect(unknown.status).toBe(404);

    await request(app)
      .patch(`/api/v1/admin/reports/${reportId}`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ decision: 'dismiss' })
      .expect(200);

    const again = await request(app)
      .patch(`/api/v1/admin/reports/${reportId}`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ decision: 'uphold' });
    expect(again.status).toBe(409);
    expect((await Material.findById(id)).hidden).toBe(true);
  });

  test('a user can report the same material again after a dismissal', async () => {
    const { id } = await setupPublicMaterial();
    const reporter = await createAndLogin({
      name: 'Reporter Again', email: 'reporter-again@example.com',
    });
    const admin = await createAndLogin({
      name: 'Admin Again', email: 'admin-again@example.com', role: 'admin',
    });

    const first = await report(reporter.token, id, { reason: 'copyright' });
    expect(first.status).toBe(201);
    const queue = await request(app)
      .get('/api/v1/admin/reports?status=open')
      .set('Authorization', `Bearer ${admin.token}`);
    await request(app)
      .patch(`/api/v1/admin/reports/${queue.body.items[0].id}`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ decision: 'dismiss' })
      .expect(200);

    const second = await report(reporter.token, id, { reason: 'spam' });
    expect(second.status).toBe(201);
    expect(second.body.status).toBe('open');
  });
});
