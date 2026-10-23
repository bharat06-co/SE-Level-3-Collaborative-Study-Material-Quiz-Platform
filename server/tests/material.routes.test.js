const os = require('node:os');
const path = require('node:path');
const fsp = require('node:fs/promises');
const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const { createApp } = require('../src/app');
const { Material } = require('../src/models/Material');
const { createStorage } = require('../src/adapters/storage');
const { createGenericZip, createOoxmlPackage } = require('./helpers/zipFixture');

jest.setTimeout(120000);

const MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024;

let mongod;
let storageDir;
let storage;

const contributorId = new mongoose.Types.ObjectId().toString();

let currentAuth;
function testAuthMiddleware(req, res, next) {
  if (currentAuth) req.auth = currentAuth;
  next();
}

const contributorAuth = { userId: contributorId, role: 'student', contributor: true };
const plainAuth = { userId: contributorId, role: 'student', contributor: false };
const educatorAuth = { userId: new mongoose.Types.ObjectId().toString(), role: 'educator', contributor: false };
const sharedStudentAuth = { userId: new mongoose.Types.ObjectId().toString(), role: 'student', contributor: false };
const otherStudentAuth = { userId: new mongoose.Types.ObjectId().toString(), role: 'student', contributor: false };
const adminAuth = { userId: new mongoose.Types.ObjectId().toString(), role: 'admin', contributor: true };

function appWithCurrentAuth() {
  return createApp({ storageDir, authMiddleware: testAuthMiddleware });
}

function multipartRequest(app, attachments, fields = {}) {
  let builder = request(app).post('/api/v1/materials');
  for (const [key, value] of Object.entries(fields)) {
    if (value !== undefined) builder = builder.field(key, value);
  }
  for (const attachment of attachments) {
    builder = builder.attach(attachment.field, attachment.file.bytes, { filename: attachment.file.name, contentType: attachment.file.contentType });
  }
  return builder;
}

function uploadRequest(app, file, fields = {}) {
  return multipartRequest(app, [{ field: 'file', file }], fields);
}

async function uploadAs(auth, fields = validFields) {
  currentAuth = auth;
  const response = await uploadRequest(appWithCurrentAuth(), validFile, fields);
  expect(response.status).toBe(201);
  return response.body.id;
}

function binaryParser(res, callback) {
  const chunks = [];
  res.on('data', (chunk) => chunks.push(chunk));
  res.on('end', () => callback(null, Buffer.concat(chunks)));
}

function download(app, id) {
  return request(app)
    .get(`/api/v1/materials/${id}/file`)
    .buffer(true)
    .parse(binaryParser);
}

async function storedFileCount() {
  try {
    return (await fsp.readdir(storageDir)).length;
  } catch (error) {
    if (error.code === 'ENOENT') return 0;
    throw error;
  }
}

const validFile = { name: 'notes.pdf', contentType: 'application/pdf', bytes: Buffer.concat([Buffer.from('%PDF-1.7'), Buffer.alloc(2 * 1024 * 1024, 0x33, 'latin1')]) };
const validFields = { title: 'ER Diagrams', description: 'Entity relationship notes', category: 'Notes', topic: 'dbms', tags: 'ER, dbms, ER', rightsConfirmed: 'true' };

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri('team1_materials_test'));
  storageDir = path.join(os.tmpdir(), `t1-storage-integration-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  storage = createStorage({ storageDir });
});

afterAll(async () => {
  if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
  if (mongod) await mongod.stop();
  if (storageDir) await fsp.rm(storageDir, { recursive: true, force: true });
});

beforeEach(async () => {
  currentAuth = contributorAuth;
  await Material.deleteMany({});
  await fsp.rm(storageDir, { recursive: true, force: true });
});

describe('POST /api/v1/materials (FR-010, FR-011, SEC-006 integration)', () => {
  test('TC-MAT-01: contributor uploads a tagged material; 201 private with normalised tags and persisted file', async () => {
    const response = await uploadRequest(appWithCurrentAuth(), validFile, validFields);
    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({ title: 'ER Diagrams', visibility: 'private' });
    expect(response.body.id).toMatch(/^[a-f0-9]{24}$/);
    expect(response.body.fileUrl).toBe(`/api/v1/materials/${response.body.id}/file`);

    const document = await Material.findById(response.body.id).lean();
    expect(document).not.toBeNull();
    expect(document.ownerId.toString()).toBe(contributorId);
    expect(document.tags).toEqual(['er', 'dbms']);
    expect(document.mimeType).toBe('application/pdf');
    expect(document.sizeBytes).toBe(validFile.bytes.length);
    expect(document.fileUrl).toBe(`/api/v1/materials/${response.body.id}/file`);

    const storedBytes = await storage.get(document.storageKey);
    expect(storedBytes.equals(validFile.bytes)).toBe(true);
  });

  test('TC-MAT-02: a plain student receives 403 and nothing is stored', async () => {
    currentAuth = plainAuth;
    const response = await uploadRequest(appWithCurrentAuth(), validFile, validFields);
    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('FORBIDDEN');
    expect(await Material.countDocuments()).toBe(0);
  });

  test('TC-MAT-09: an educator uploads without contributor privilege; ownerId is the educator', async () => {
    currentAuth = educatorAuth;
    const response = await uploadRequest(appWithCurrentAuth(), validFile, { ...validFields, title: 'Normal Forms' });
    expect(response.status).toBe(201);
    const document = await Material.findById(response.body.id).lean();
    expect(document.ownerId.toString()).toBe(educatorAuth.userId);
    expect(document.visibility).toBe('private');
  });

  test('TC-MAT-03: blank or too-short title is rejected naming field title, nothing stored', async () => {
    for (const title of ['', 'ab']) {
      const response = await uploadRequest(appWithCurrentAuth(), validFile, { ...validFields, title });
      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
      expect(JSON.stringify(response.body.error.details.map((detail) => detail.field))).toContain('title');
    }
    expect(await Material.countDocuments()).toBe(0);
  });

  test('TC-MAT-10: missing or false rightsConfirmed returns 400 naming rightsConfirmed, nothing stored, BR-5', async () => {
    for (const rightsConfirmed of [undefined, 'false']) {
      const response = await uploadRequest(appWithCurrentAuth(), validFile, { ...validFields, rightsConfirmed });
      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
      expect(response.body.error.details.some((detail) => detail.field === 'rightsConfirmed')).toBe(true);
    }
    expect(await Material.countDocuments()).toBe(0);
  });

  test('TC-SEC-06: a 20 MB PDF is accepted at the exact limit, 20 MB + 1 byte returns 413', async () => {
    const exact = Buffer.concat([Buffer.from('%PDF-1.7'), Buffer.alloc(MAX_FILE_SIZE_BYTES - 8, 0x33, 'latin1')]);
    const response = await uploadRequest(appWithCurrentAuth(), { ...validFile, bytes: exact }, validFields);
    expect(response.status).toBe(201);
    const document = await Material.findById(response.body.id).lean();
    expect(document.sizeBytes).toBe(MAX_FILE_SIZE_BYTES);

    const over = Buffer.concat([Buffer.from('%PDF-1.7'), Buffer.alloc(MAX_FILE_SIZE_BYTES - 8, 0x33, 'latin1'), Buffer.from('x')]);
    const rejection = await uploadRequest(appWithCurrentAuth(), { ...validFile, bytes: over }, validFields);
    expect(rejection.status).toBe(413);
    expect(rejection.body.error.code).toBe('FILE_TOO_LARGE');
    const count = await Material.countDocuments();
    expect(count).toBe(1);
  });

  test('TC-SEC-06: an executable renamed to .pdf returns 415', async () => {
    const response = await uploadRequest(appWithCurrentAuth(), { ...validFile, name: 'exit.pdf', bytes: Buffer.from([0x4d, 0x5a, 0x00, 0x00]) }, validFields);
    expect(response.status).toBe(415);
    expect(response.body.error.code).toBe('UNSUPPORTED_FILE_TYPE');
    expect(await Material.countDocuments()).toBe(0);
  });

  test('TC-SEC-06: an unsupported extension (.svg) returns 415', async () => {
    const response = await uploadRequest(appWithCurrentAuth(), { ...validFile, name: 'logo.svg', bytes: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>') }, validFields);
    expect(response.status).toBe(415);
    expect(response.body.error.code).toBe('UNSUPPORTED_FILE_TYPE');
    expect(await Material.countDocuments()).toBe(0);
  });

  test.each(['docx', 'pptx'])('TC-SEC-06: a valid %s OOXML package is accepted', async (kind) => {
    const bytes = createOoxmlPackage(kind);
    const response = await uploadRequest(appWithCurrentAuth(), { name: `notes.${kind}`, contentType: 'application/octet-stream', bytes }, validFields);
    expect(response.status).toBe(201);
    const document = await Material.findById(response.body.id).lean();
    expect(document.mimeType).toContain(kind === 'docx' ? 'wordprocessingml.document' : 'presentationml.presentation');
    expect((await storage.get(document.storageKey)).equals(bytes)).toBe(true);
  });

  test.each(['docx', 'pptx'])('TC-SEC-06: an arbitrary ZIP renamed .%s returns 415 and stores nothing', async (extension) => {
    const response = await uploadRequest(appWithCurrentAuth(), { name: `payload.${extension}`, contentType: 'application/octet-stream', bytes: createGenericZip() }, validFields);
    expect(response.status).toBe(415);
    expect(response.body.error.code).toBe('UNSUPPORTED_FILE_TYPE');
    expect(await Material.countDocuments()).toBe(0);
    expect(await storedFileCount()).toBe(0);
  });

  test.each([
    ['docx', 'pptx'],
    ['pptx', 'docx'],
  ])('TC-SEC-06: a %s package renamed .%s returns 415', async (actualKind, extension) => {
    const response = await uploadRequest(appWithCurrentAuth(), { name: `renamed.${extension}`, contentType: 'application/octet-stream', bytes: createOoxmlPackage(actualKind) }, validFields);
    expect(response.status).toBe(415);
    expect(response.body.error.code).toBe('UNSUPPORTED_FILE_TYPE');
    expect(await Material.countDocuments()).toBe(0);
    expect(await storedFileCount()).toBe(0);
  });

  test('TC-SEC-06: a truncated DOCX package returns 415', async () => {
    const bytes = createOoxmlPackage('docx');
    const truncated = bytes.subarray(0, bytes.length - 12);
    const response = await uploadRequest(appWithCurrentAuth(), { name: 'broken.docx', contentType: 'application/octet-stream', bytes: truncated }, validFields);
    expect(response.status).toBe(415);
    expect(response.body.error.code).toBe('UNSUPPORTED_FILE_TYPE');
    expect(await Material.countDocuments()).toBe(0);
  });

  test('TC-SEC-06: a four-byte PNG prefix returns 415', async () => {
    const response = await uploadRequest(appWithCurrentAuth(), { name: 'image.png', contentType: 'image/png', bytes: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0, 0, 0, 0]) }, validFields);
    expect(response.status).toBe(415);
    expect(response.body.error.code).toBe('UNSUPPORTED_FILE_TYPE');
    expect(await Material.countDocuments()).toBe(0);
  });

  test.each([
    [[{ field: 'document', file: validFile }]],
    [[{ field: 'file', file: validFile }, { field: 'file', file: validFile }]],
  ])('malformed multipart returns 400 VALIDATION_ERROR and stores nothing', async (attachments) => {
    const response = await multipartRequest(appWithCurrentAuth(), attachments, validFields);
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
    expect(response.body.error.requestId).toBe(response.headers['x-request-id']);
    expect(await Material.countDocuments()).toBe(0);
    expect(await storedFileCount()).toBe(0);
  });

  test('responses use the central error envelope with a server-owned request id', async () => {
    currentAuth = plainAuth;
    const response = await uploadRequest(appWithCurrentAuth(), validFile, validFields);
    expect(Object.keys(response.body.error).sort()).toEqual(['code', 'details', 'message', 'requestId']);
    expect(response.body.error.requestId).toBe(response.headers['x-request-id']);
  });

  test('multipart upload with unsafe keys is rejected after multipart parsing', async () => {
    currentAuth = contributorAuth;
    const app = appWithCurrentAuth();
    const response = await multipartRequest(app, [{ field: 'file', file: validFile }], {
      ...validFields,
      $badKey: 'injection',
    });
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
    expect(await Material.countDocuments()).toBe(0);
    expect(await storedFileCount()).toBe(0);
  });
});

describe('GET /api/v1/materials/:id and /file (FR-012, FR-013 integration)', () => {
  test('TC-MAT-17: private material is visible only to its owner for detail and download', async () => {
    const id = await uploadAs(contributorAuth);
    const app = appWithCurrentAuth();

    currentAuth = contributorAuth;
    const detail = await request(app).get(`/api/v1/materials/${id}`);
    expect(detail.status).toBe(200);
    expect(detail.body).toMatchObject({
      id,
      title: 'ER Diagrams',
      description: 'Entity relationship notes',
      category: 'Notes',
      topic: 'dbms',
      ownerId: contributorId,
      visibility: 'private',
      mimeType: 'application/pdf',
      sizeBytes: validFile.bytes.length,
      fileUrl: `/api/v1/materials/${id}/file`,
      sharedWith: [],
      hidden: false,
    });
    expect(detail.body).not.toHaveProperty('storageKey');

    const file = await download(app, id);
    expect(file.status).toBe(200);
    expect(file.headers['content-type']).toMatch(/^application\/pdf/);
    expect(Number(file.headers['content-length'])).toBe(validFile.bytes.length);
    expect(file.headers['content-disposition']).toBe(`attachment; filename="material-${id}.pdf"`);
    expect(file.headers['cache-control']).toBe('private, no-store');
    expect(file.body.equals(validFile.bytes)).toBe(true);

    currentAuth = otherStudentAuth;
    const deniedDetail = await request(app).get(`/api/v1/materials/${id}`);
    expect(deniedDetail.status).toBe(404);
    expect(deniedDetail.body.error.code).toBe('NOT_FOUND');
    const deniedFile = await download(app, id);
    expect(deniedFile.status).toBe(404);
  });

  test('TC-MAT-05: shared material is visible only to owner and listed users', async () => {
    const id = await uploadAs(contributorAuth);
    await Material.updateOne(
      { _id: id },
      { $set: { visibility: 'shared', sharedWith: [sharedStudentAuth.userId] } },
    );
    const app = appWithCurrentAuth();

    currentAuth = sharedStudentAuth;
    expect((await request(app).get(`/api/v1/materials/${id}`)).status).toBe(200);
    expect((await download(app, id)).status).toBe(200);

    currentAuth = otherStudentAuth;
    expect((await request(app).get(`/api/v1/materials/${id}`)).status).toBe(404);
    expect((await download(app, id)).status).toBe(404);
  });

  test('TC-MAT-05: public material is visible to any authenticated user', async () => {
    const id = await uploadAs(contributorAuth);
    await Material.updateOne({ _id: id }, { $set: { visibility: 'public' } });
    const app = appWithCurrentAuth();

    currentAuth = otherStudentAuth;
    const detail = await request(app).get(`/api/v1/materials/${id}`);
    expect(detail.status).toBe(200);
    expect(detail.body.visibility).toBe('public');
    expect(detail.body).not.toHaveProperty('sharedWith');
    expect(detail.body).not.toHaveProperty('hidden');
    const file = await download(app, id);
    expect(file.status).toBe(200);
    expect(file.body.equals(validFile.bytes)).toBe(true);
  });

  test('hidden material is visible to the owner and admin, but not other users', async () => {
    const id = await uploadAs(contributorAuth);
    await Material.updateOne({ _id: id }, { $set: { visibility: 'public', hidden: true } });
    const app = appWithCurrentAuth();

    currentAuth = otherStudentAuth;
    expect((await request(app).get(`/api/v1/materials/${id}`)).status).toBe(404);
    expect((await download(app, id)).status).toBe(404);

    currentAuth = contributorAuth;
    expect((await request(app).get(`/api/v1/materials/${id}`)).status).toBe(200);
    expect((await download(app, id)).status).toBe(200);

    currentAuth = adminAuth;
    const adminDetail = await request(app).get(`/api/v1/materials/${id}`);
    expect(adminDetail.status).toBe(200);
    expect(adminDetail.body.hidden).toBe(true);
    expect((await download(app, id)).status).toBe(200);
  });

  test('detail and download require auth and reject malformed or unknown IDs', async () => {
    const id = await uploadAs(contributorAuth);
    const app = appWithCurrentAuth();

    currentAuth = undefined;
    const unauthenticated = await request(app).get(`/api/v1/materials/${id}`);
    expect(unauthenticated.status).toBe(401);
    expect(unauthenticated.body.error.code).toBe('UNAUTHENTICATED');
    const unauthDownload = await download(app, id);
    expect(unauthDownload.status).toBe(401);
    const unauthFile = await request(app).get(`/api/v1/materials/${id}/file`);
    expect(unauthFile.status).toBe(401);
    expect(unauthFile.body.error.code).toBe('UNAUTHENTICATED');

    currentAuth = contributorAuth;
    const malformed = await request(app).get('/api/v1/materials/not-an-object-id');
    expect(malformed.status).toBe(400);
    expect(malformed.body.error.code).toBe('VALIDATION_ERROR');
    expect(malformed.body.error.details).toContainEqual(expect.objectContaining({ field: 'id' }));
    expect((await download(app, 'not-an-object-id')).status).toBe(400);

    const unknownId = new mongoose.Types.ObjectId().toString();
    expect((await request(app).get(`/api/v1/materials/${unknownId}`)).status).toBe(404);
    expect((await download(app, unknownId)).status).toBe(404);
  });

  test('a missing stored file returns a generic 500 without leaking the storage path', async () => {
    const id = await uploadAs(contributorAuth);
    const document = await Material.findById(id).lean();
    await fsp.rm(path.join(storageDir, document.storageKey));
    const app = appWithCurrentAuth();

    currentAuth = contributorAuth;
    const response = await download(app, id);
    expect(response.status).toBe(500);
    expect(response.body.toString()).not.toContain(storageDir);
    expect(response.body.toString()).toContain('INTERNAL_ERROR');
  });
});

describe('GET /api/v1/materials - Search and Filter (FR-011, FR-013, Issue #10)', () => {
  let material1Id;
  let material2Id;

  beforeEach(async () => {
    material1Id = await uploadAs(contributorAuth, {
      ...validFields,
      title: 'Database Normalisation Notes',
      category: 'Computer Science',
      topic: 'dbms',
      tags: 'normalisation, bcnf, 3nf',
    });

    material2Id = await uploadAs(educatorAuth, {
      ...validFields,
      title: 'Operating Systems Scheduling',
      category: 'Systems',
      topic: 'os',
      tags: 'scheduling, cpu, processes',
    });

    // Make material2 public so others can discover it
    await Material.updateOne({ _id: material2Id }, { $set: { visibility: 'public' } });
  });

  test('filters materials by category case-insensitively', async () => {
    currentAuth = educatorAuth;
    const app = appWithCurrentAuth();

    const res = await request(app).get('/api/v1/materials?category=systems');
    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0].id).toBe(material2Id);
    expect(res.body.total).toBe(1);
  });

  test('filters materials by topic', async () => {
    currentAuth = educatorAuth;
    const app = appWithCurrentAuth();

    const res = await request(app).get('/api/v1/materials?topic=os');
    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0].topic).toBe('os');
  });

  test('filters materials by tag', async () => {
    currentAuth = educatorAuth;
    const app = appWithCurrentAuth();

    const res = await request(app).get('/api/v1/materials?tag=cpu');
    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0].tags).toContain('cpu');
  });

  test('full-text search matches keyword in title or tags', async () => {
    currentAuth = educatorAuth;
    const app = appWithCurrentAuth();

    const res = await request(app).get('/api/v1/materials?q=scheduling');
    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0].title).toContain('Operating Systems Scheduling');
  });

  test('visibility-safe scoping: private material is only returned for owner and admin', async () => {
    const otherApp = appWithCurrentAuth();

    // otherStudent only sees the public material, not contributor's private material
    currentAuth = otherStudentAuth;
    const otherRes = await request(otherApp).get('/api/v1/materials');
    expect(otherRes.status).toBe(200);
    const otherIds = otherRes.body.items.map((m) => m.id);
    expect(otherIds).toContain(material2Id);
    expect(otherIds).not.toContain(material1Id);

    // contributor sees their own private material as well as public
    currentAuth = contributorAuth;
    const ownerRes = await request(otherApp).get('/api/v1/materials');
    expect(ownerRes.status).toBe(200);
    const ownerIds = ownerRes.body.items.map((m) => m.id);
    expect(ownerIds).toContain(material1Id);
    expect(ownerIds).toContain(material2Id);

    // admin sees all materials
    currentAuth = adminAuth;
    const adminRes = await request(otherApp).get('/api/v1/materials');
    expect(adminRes.status).toBe(200);
    const adminIds = adminRes.body.items.map((m) => m.id);
    expect(adminIds).toContain(material1Id);
    expect(adminIds).toContain(material2Id);
  });

  test('shared material appears only for listed users', async () => {
    await Material.updateOne(
      { _id: material1Id },
      { $set: { visibility: 'shared', sharedWith: [sharedStudentAuth.userId] } },
    );

    const app = appWithCurrentAuth();

    // shared student sees the shared material
    currentAuth = sharedStudentAuth;
    const sharedRes = await request(app).get('/api/v1/materials');
    expect(sharedRes.status).toBe(200);
    expect(sharedRes.body.items.map((m) => m.id)).toContain(material1Id);

    // other student does not see the shared material
    currentAuth = otherStudentAuth;
    const otherRes = await request(app).get('/api/v1/materials');
    expect(otherRes.status).toBe(200);
    expect(otherRes.body.items.map((m) => m.id)).not.toContain(material1Id);
  });

  test('pagination parameters are respected', async () => {
    currentAuth = adminAuth;
    const app = appWithCurrentAuth();

    const paged = await request(app).get('/api/v1/materials?page=1&limit=1');
    expect(paged.status).toBe(200);
    expect(paged.body.items).toHaveLength(1);
    expect(paged.body.page).toBe(1);
    expect(paged.body.limit).toBe(1);
    expect(paged.body.total).toBe(2);
  });

  test('invalid pagination parameters return 400 VALIDATION_ERROR', async () => {
    currentAuth = adminAuth;
    const app = appWithCurrentAuth();

    const badLimit = await request(app).get('/api/v1/materials?limit=100');
    expect(badLimit.status).toBe(400);
    expect(badLimit.body.error.code).toBe('VALIDATION_ERROR');

    const badPage = await request(app).get('/api/v1/materials?page=-5');
    expect(badPage.status).toBe(400);
    expect(badPage.body.error.code).toBe('VALIDATION_ERROR');
  });
});

describe('PATCH /api/v1/materials/:id - Visibility and Sharing (FR-012, Issue #12)', () => {
  let materialId;

  beforeEach(async () => {
    materialId = await uploadAs(contributorAuth);
  });

  test('owner can update visibility to shared with valid sharedWith user IDs', async () => {
    currentAuth = contributorAuth;
    const app = appWithCurrentAuth();

    const response = await request(app)
      .patch(`/api/v1/materials/${materialId}`)
      .send({
        visibility: 'shared',
        sharedWith: [sharedStudentAuth.userId],
      });

    expect(response.status).toBe(200);
    expect(response.body.visibility).toBe('shared');
    expect(response.body.sharedWith).toContain(sharedStudentAuth.userId);

    const updated = await Material.findById(materialId);
    expect(updated.visibility).toBe('shared');
    expect(updated.sharedWith.map(String)).toContain(sharedStudentAuth.userId);
  });

  test('owner can update visibility to public, clearing sharedWith', async () => {
    await Material.updateOne(
      { _id: materialId },
      { $set: { visibility: 'shared', sharedWith: [sharedStudentAuth.userId] } },
    );

    currentAuth = contributorAuth;
    const app = appWithCurrentAuth();

    const response = await request(app)
      .patch(`/api/v1/materials/${materialId}`)
      .send({ visibility: 'public' });

    expect(response.status).toBe(200);
    expect(response.body.visibility).toBe('public');
    expect(response.body.sharedWith).toEqual([]);

    const updated = await Material.findById(materialId);
    expect(updated.visibility).toBe('public');
    expect(updated.sharedWith).toEqual([]);
  });

  test('owner can update visibility to private, clearing sharedWith', async () => {
    await Material.updateOne(
      { _id: materialId },
      { $set: { visibility: 'public' } },
    );

    currentAuth = contributorAuth;
    const app = appWithCurrentAuth();

    const response = await request(app)
      .patch(`/api/v1/materials/${materialId}`)
      .send({ visibility: 'private' });

    expect(response.status).toBe(200);
    expect(response.body.visibility).toBe('private');
    expect(response.body.sharedWith).toEqual([]);
  });

  test('/visibility endpoint alias works equivalently', async () => {
    currentAuth = contributorAuth;
    const app = appWithCurrentAuth();

    const response = await request(app)
      .patch(`/api/v1/materials/${materialId}/visibility`)
      .send({ visibility: 'public' });

    expect(response.status).toBe(200);
    expect(response.body.visibility).toBe('public');
  });

  test('non-owner cannot modify visibility and receives 403 FORBIDDEN', async () => {
    currentAuth = otherStudentAuth;
    const app = appWithCurrentAuth();

    const response = await request(app)
      .patch(`/api/v1/materials/${materialId}`)
      .send({ visibility: 'public' });

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('FORBIDDEN');
  });

  test('admin can modify visibility of any material', async () => {
    currentAuth = adminAuth;
    const app = appWithCurrentAuth();

    const response = await request(app)
      .patch(`/api/v1/materials/${materialId}`)
      .send({ visibility: 'public' });

    expect(response.status).toBe(200);
    expect(response.body.visibility).toBe('public');
  });

  test('setting visibility to shared without sharedWith returns 400 VALIDATION_ERROR', async () => {
    currentAuth = contributorAuth;
    const app = appWithCurrentAuth();

    const response = await request(app)
      .patch(`/api/v1/materials/${materialId}`)
      .send({ visibility: 'shared', sharedWith: [] });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });

  test('invalid visibility value returns 400 VALIDATION_ERROR', async () => {
    currentAuth = contributorAuth;
    const app = appWithCurrentAuth();

    const response = await request(app)
      .patch(`/api/v1/materials/${materialId}`)
      .send({ visibility: 'unsupported' });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });

  test('unknown material returns 404 NOT_FOUND', async () => {
    currentAuth = contributorAuth;
    const app = appWithCurrentAuth();

    const unknownId = new mongoose.Types.ObjectId().toString();
    const response = await request(app)
      .patch(`/api/v1/materials/${unknownId}`)
      .send({ visibility: 'public' });

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe('NOT_FOUND');
  });

  test('malformed material ID returns 400 VALIDATION_ERROR', async () => {
    currentAuth = contributorAuth;
    const app = appWithCurrentAuth();

    const response = await request(app)
      .patch('/api/v1/materials/invalid-id')
      .send({ visibility: 'public' });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });
});
