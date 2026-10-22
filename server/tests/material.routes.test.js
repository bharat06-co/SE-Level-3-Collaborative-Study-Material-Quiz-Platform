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

function appWithCurrentAuth() {
  return createApp({ storageDir, authMiddleware: testAuthMiddleware });
}

function multipartRequest(app, attachments, fields = {}) {
  let builder = request(app).post('/api/v1/materials').field('title', fields.title).field('description', fields.description).field('category', fields.category).field('topic', fields.topic);
  if (fields.tags !== undefined) builder = builder.field('tags', fields.tags);
  if (fields.rightsConfirmed !== undefined) builder = builder.field('rightsConfirmed', fields.rightsConfirmed);
  for (const attachment of attachments) {
    builder = builder.attach(attachment.field, attachment.file.bytes, { filename: attachment.file.name, contentType: attachment.file.contentType });
  }
  return builder;
}

function uploadRequest(app, file, fields = {}) {
  return multipartRequest(app, [{ field: 'file', file }], fields);
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
const validFields = { title: 'ER Diagrams', description: 'Entity relationship notes', category: 'Notes', topic: 'dbms', rightsConfirmed: 'true' };

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
  test('TC-MAT-01: contributor uploads material; 201 private and persisted file', async () => {
    const response = await uploadRequest(appWithCurrentAuth(), validFile, validFields);
    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({ title: 'ER Diagrams', visibility: 'private' });
    expect(response.body.id).toMatch(/^[a-f0-9]{24}$/);
    expect(response.body.fileUrl).toBe(`/api/v1/materials/${response.body.id}/file`);

    const document = await Material.findById(response.body.id).lean();
    expect(document).not.toBeNull();
    expect(document.ownerId.toString()).toBe(contributorId);
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
});

describe('Production mount (FR-010 wiring until the auth PR merges)', () => {
  test('the mounted router rejects everything with 401 UNAUTHENTICATED, never a fake success', async () => {
    const defaultApp = createApp({ storageDir });
    const response = await uploadRequest(defaultApp, validFile, validFields);
    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('UNAUTHENTICATED');
  });
});
