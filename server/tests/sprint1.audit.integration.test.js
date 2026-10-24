const os = require('node:os');
const path = require('node:path');
const fs = require('node:fs/promises');
const { fork } = require('node:child_process');
const { once } = require('node:events');
const { randomBytes, createHash } = require('node:crypto');
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const request = require('supertest');
const { MongoMemoryReplSet } = require('mongodb-memory-server');
const User = require('../src/models/User');
const { Material } = require('../src/models/Material');
const { Quiz } = require('../src/modules/quizzes/quiz.model');
const { createMaterialRepository } = require('../src/modules/materials/material.repository');

jest.setTimeout(120000);

const FILE = Buffer.from('%PDF-1.7\nSprint 1 regression file\n%%EOF');
const digest = (bytes) => createHash('sha256').update(bytes).digest('hex');
let mongo;
let storageDir;
const processes = [];
const apis = [];
const users = {};
const tokens = {};

function patch(api, id, body, token = tokens.owner, alias = '') {
  return request(api).patch(`/api/v1/materials/${id}${alias}`)
    .set('Authorization', `Bearer ${token}`).send(body);
}

async function upload() {
  const response = await request(apis[0]).post('/api/v1/materials')
    .set('Authorization', `Bearer ${tokens.owner}`)
    .field('title', 'Sprint 1 material').field('description', 'Regression notes')
    .field('category', 'Notes').field('topic', 'audit').field('tags', 'audit')
    .field('rightsConfirmed', 'true')
    .attach('file', FILE, { filename: 'audit.pdf', contentType: 'application/pdf' });
  expect(response.status).toBe(201);
  return response.body.id;
}

async function verifyFile(id) {
  const stored = await Material.findById(id).lean();
  const bytes = await fs.readFile(path.join(storageDir, stored.storageKey));
  expect(digest(bytes)).toBe(digest(FILE));
  expect(stored.sizeBytes).toBe(FILE.length);
  const response = await request(apis[1]).get(`/api/v1/materials/${id}/file`)
    .set('Authorization', `Bearer ${tokens.owner}`);
  expect(response.status).toBe(200);
  expect(digest(response.body)).toBe(digest(FILE));
  expect(await fs.readdir(storageDir)).toEqual([stored.storageKey]);
  expect(await Material.countDocuments()).toBe(1);
}

beforeAll(async () => {
  // Always start our own server on a random loopback port; never use .env or an external URI.
  mongo = await MongoMemoryReplSet.create({ replSet: { count: 1, ip: '127.0.0.1' } });
  const uri = mongo.getUri(`sprint1_audit_${randomBytes(8).toString('hex')}`);
  await mongoose.connect(uri);
  await Promise.all([User.init(), Material.init(), Quiz.init()]);
  storageDir = await fs.mkdtemp(path.join(os.tmpdir(), 'sprint1-audit-'));
  const secret = randomBytes(64).toString('hex');
  const password = randomBytes(16).toString('hex');
  const passwordHash = await bcrypt.hash(password, 4);
  for (const name of ['owner', 'recipientA', 'recipientB', 'outsider', 'admin']) {
    users[name] = await User.create({
      name, email: `${name.toLowerCase()}@audit.example`, passwordHash,
      role: name === 'owner' ? 'educator' : name === 'admin' ? 'admin' : 'student',
    });
  }
  for (let index = 0; index < 2; index += 1) {
    const child = fork(path.join(__dirname, 'fixtures/sprint1-api.cjs'), [], {
      env: {
        ...process.env, NODE_ENV: 'test', MONGODB_URI: uri,
        JWT_ACCESS_SECRET: secret, JWT_ACCESS_TTL: '15m', STORAGE_DIR: storageDir,
      },
      stdio: ['ignore', 'ignore', 'pipe', 'ipc'], windowsHide: true,
    });
    processes.push(child);
    child.stderr.on('data', (bytes) => process.stderr.write(bytes));
    const [message] = await once(child, 'message', { signal: AbortSignal.timeout(30000) });
    apis.push(`http://127.0.0.1:${message.port}`);
  }
  for (const [name, user] of Object.entries(users)) {
    const response = await request(apis[0]).post('/api/v1/auth/login')
      .send({ email: user.email, password });
    expect(response.status).toBe(200);
    tokens[name] = response.body.accessToken;
  }
});

beforeEach(async () => {
  await Promise.all([Material.deleteMany({}), Quiz.deleteMany({})]);
  for (const name of await fs.readdir(storageDir)) await fs.unlink(path.join(storageDir, name));
});

afterAll(async () => {
  try {
    await Promise.all(processes.map(async (child) => {
      if (child.exitCode !== null) return;
      const stopped = once(child, 'exit', { signal: AbortSignal.timeout(10000) });
      if (child.connected) child.send('stop');
      try { await stopped; } catch { child.kill(); }
    }));
    if (mongoose.connection.readyState === 1) await mongoose.connection.dropDatabase();
  } finally {
    await mongoose.disconnect();
    if (mongo) await mongo.stop();
    if (storageDir) await fs.rm(storageDir, { recursive: true, force: true });
  }
});

async function listPages(resource, query = {}) {
  const ids = [];
  for (let page = 1; page <= 4; page += 1) {
    const response = await request(apis[page % 2]).get(`/api/v1/${resource}`)
      .set('Authorization', `Bearer ${tokens.owner}`).query({ ...query, page, limit: 10 });
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ total: 25, page, limit: 10 });
    expect(response.body.items).toHaveLength(page === 4 ? 0 : page === 3 ? 5 : 10);
    ids.push(...response.body.items.map((item) => item.id));
  }
  return ids;
}

test('D1 quiz pagination returns every tied-timestamp record exactly once', async () => {
  const records = await Quiz.create(Array.from({ length: 25 }, (_, index) => ({
    title: `Quiz ${index}`, topic: 'audit', authorId: users.owner._id,
    status: 'published', createdAt: new Date('2026-01-01'),
  })));
  const actual = await listPages('quizzes', { topic: 'audit' });
  expect(new Set(actual).size).toBe(25);
  expect(actual).toEqual(records.map((record) => String(record._id)).sort().reverse());
});

test.each([false, true])('D1 material pagination with tied timestamps and text search=%s', async (textSearch) => {
  const records = await Material.create(Array.from({ length: 25 }, () => ({
    title: 'Identical audit notes', description: 'Identical audit content', category: 'Notes',
    topic: 'audit', tags: ['audit'], ownerId: users.owner._id, storageKey: 'fixture.pdf',
    fileUrl: '/fixture', mimeType: 'application/pdf', sizeBytes: FILE.length,
    createdAt: new Date('2026-01-01'),
  })));
  const actual = await listPages('materials', textSearch ? { q: 'audit' } : {});
  expect(new Set(actual).size).toBe(25);
  expect(actual).toEqual(records.map((record) => String(record._id)).sort().reverse());
});

test.each(['quizzes', 'materials'])('D1 %s preserves descending creation date before the ID tie-breaker', async (resource) => {
  const dates = ['2026-03-01', '2026-01-01', '2026-02-01'];
  const records = await (resource === 'quizzes' ? Quiz : Material).create(dates.map((date) => ({
    title: 'Audit notes', topic: 'audit', authorId: users.owner._id, status: 'published',
    ownerId: users.owner._id, category: 'Notes', tags: ['audit'], storageKey: 'fixture.pdf',
    fileUrl: '/fixture', mimeType: 'application/pdf', sizeBytes: FILE.length, createdAt: new Date(date),
  })));
  const response = await request(apis[0]).get(`/api/v1/${resource}`)
    .set('Authorization', `Bearer ${tokens.owner}`);
  expect(response.status).toBe(200);
  expect(response.body.items.map((item) => item.id)).toEqual([records[0], records[2], records[1]].map((record) => String(record._id)));
});

test('D1 text relevance precedes date, with newer dates breaking equal scores', async () => {
  const records = await Material.create([
    { title: 'audit', createdAt: new Date('2026-02-01') },
    { title: 'audit', createdAt: new Date('2026-01-01') },
    { title: 'audit algebra geometry calculus physics chemistry history', createdAt: new Date('2026-03-01') },
  ].map((record) => ({
    ...record, category: 'Notes', topic: 'audit', tags: ['notes'], ownerId: users.owner._id,
    storageKey: 'fixture.pdf', fileUrl: '/fixture', mimeType: 'application/pdf', sizeBytes: FILE.length,
  })));
  const response = await request(apis[0]).get('/api/v1/materials').query({ q: 'audit' })
    .set('Authorization', `Bearer ${tokens.owner}`);
  expect(response.status).toBe(200);
  expect(response.body.items.map((item) => item.id)).toEqual(records.map((record) => String(record._id)));
});

test.each([
  ['shared', 'private'], ['shared', 'public'], ['private', 'shared'],
])('D2 simultaneous %s to %s and recipient-only changes preserve persisted invariants', async (initial, target) => {
  const id = await upload();
  const invalid = [];
  for (let round = 0; round < 24; round += 1) {
    await Material.updateOne({ _id: id }, { $set: {
      visibility: initial, sharedWith: initial === 'shared' ? [users.recipientA._id] : [],
    } });
    const transition = { visibility: target };
    if (target === 'shared') transition.sharedWith = [String(users.recipientA._id)];
    const responses = await Promise.all([
      patch(apis[0], id, transition, tokens.owner, round % 2 ? '' : '/visibility'),
      patch(apis[1], id, { sharedWith: [String(users.recipientB._id)] }, tokens.owner, round % 2 ? '/visibility' : ''),
    ]);
    expect(responses.map((response) => response.status)).toEqual([200, 200]);
    const stored = await Material.findById(id).lean();
    if (stored.visibility !== target || (target === 'shared' ? stored.sharedWith.length !== 1 : stored.sharedWith.length !== 0)) {
      invalid.push({ round, visibility: stored.visibility, sharedWith: stored.sharedWith.map(String) });
    }
    if (target === 'shared') {
      expect(stored.sharedWith.map(String).every((value) => [String(users.recipientA._id), String(users.recipientB._id)].includes(value))).toBe(true);
    }
  }
  expect(invalid).toEqual([]);
  await verifyFile(id);
});

test.each(['', '/visibility'])('D2 rejected requests leave MongoDB and files unchanged via alias %s', async (alias) => {
  const id = await upload();
  const shared = await patch(apis[0], id, {
    visibility: 'shared',
    sharedWith: [String(users.owner._id), String(users.recipientA._id).toUpperCase(), String(users.recipientA._id)],
  }, tokens.owner, alias);
  expect(shared.status).toBe(200);
  expect(shared.body.sharedWith).toEqual([String(users.recipientA._id)]);
  expect(shared.body).not.toHaveProperty('__v');
  const before = await Material.findById(id).lean();
  expect((await patch(apis[1], id, { visibility: 'private' }, tokens.outsider, alias)).status).toBe(403);
  expect((await request(apis[1]).patch(`/api/v1/materials/${id}${alias}`).send({ visibility: 'public' })).status).toBe(401);
  for (const body of [
    { sharedWith: [] }, { visibility: 'shared', sharedWith: [] },
    { sharedWith: [String(users.owner._id)] }, { visibility: 'invalid' },
    { sharedWith: [{ $ne: null }] },
  ]) {
    const rejected = await patch(apis[1], id, body, tokens.owner, alias);
    expect(rejected.status).toBe(400);
    expect(rejected.body.error.code).toBe('VALIDATION_ERROR');
  }
  expect((await patch(apis[1], String(new mongoose.Types.ObjectId()), { visibility: 'public' }, tokens.owner, alias)).status).toBe(404);
  expect(await Material.findById(id).lean()).toEqual(before);
  await verifyFile(id);

  const moderated = await patch(apis[1], id, { visibility: 'private' }, tokens.admin, alias);
  expect(moderated.status).toBe(200);
  expect(moderated.body).toMatchObject({ visibility: 'private', sharedWith: [], ownerId: String(users.owner._id) });
  expect((await request(apis[0]).get(`/api/v1/materials/${id}/file`)
    .set('Authorization', `Bearer ${tokens.recipientA}`)).status).toBe(404);
  await verifyFile(id);
});

test('D2 concurrent repository writes reject the stale version without changing persisted state or files', async () => {
  const id = await upload();
  const repoA = createMaterialRepository();
  const repoB = createMaterialRepository();
  const snapshot = await repoA.findById(id);
  const results = await Promise.all([
    repoA.updateIfVersion(id, snapshot.__v, { visibility: 'shared', sharedWith: [users.recipientA._id] }),
    repoB.updateIfVersion(id, snapshot.__v, { visibility: 'public', sharedWith: [] }),
  ]);
  expect(results.filter(Boolean)).toHaveLength(1);
  expect(results.filter((result) => result === null)).toHaveLength(1);
  const winner = results.find(Boolean).toObject();
  expect(winner.__v).toBe(snapshot.__v + 1);
  expect(await Material.findById(id).lean()).toEqual(winner);
  expect(await repoB.updateIfVersion(id, snapshot.__v, { visibility: 'private', sharedWith: [] })).toBeNull();
  expect(await Material.findById(id).lean()).toEqual(winner);

  await expect(repoA.updateIfVersion(id, winner.__v, { visibility: 'invalid', sharedWith: [] }))
    .rejects.toMatchObject({ name: 'ValidationError' });
  expect(await Material.findById(id).lean()).toEqual(winner);
  await verifyFile(id);
});

test('D2 bounded concurrent request waves acknowledge only valid persisted sharing updates', async () => {
  const id = await upload();
  const bodies = [
    { visibility: 'private' }, { visibility: 'public' },
    { visibility: 'shared', sharedWith: [String(users.recipientA._id)] },
    { sharedWith: [String(users.recipientB._id)] }, { sharedWith: [] },
  ];
  let acknowledged = 0;
  for (let wave = 0; wave < 4; wave += 1) {
    const responses = await Promise.all(Array.from({ length: 16 }, (_, index) =>
      patch(apis[index % 2], id, bodies[(wave + index) % bodies.length],
        index % 3 ? tokens.owner : tokens.admin, index % 2 ? '/visibility' : '')));
    for (const response of responses) {
      expect([200, 400, 409]).toContain(response.status);
      if (response.status === 200) {
        acknowledged += 1;
        expect(response.body.sharedWith.length).toBe(response.body.visibility === 'shared' ? 1 : 0);
      } else {
        expect(response.body.error.code).toBe(response.status === 400 ? 'VALIDATION_ERROR' : 'MATERIAL_CONFLICT');
      }
    }
    const stored = await Material.findById(id).lean();
    expect(stored.__v).toBe(acknowledged);
    expect(stored.sharedWith.length).toBe(stored.visibility === 'shared' ? 1 : 0);
    expect(stored.sharedWith.map(String).every((value) => [String(users.recipientA._id), String(users.recipientB._id)].includes(value))).toBe(true);
    expect(String(stored.ownerId)).toBe(String(users.owner._id));
  }
  expect(acknowledged).toBeGreaterThan(0);
  await verifyFile(id);
});
