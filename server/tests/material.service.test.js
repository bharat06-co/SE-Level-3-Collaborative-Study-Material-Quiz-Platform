const { Material } = require('../src/models/Material');
const { createMaterialService } = require('../src/modules/materials/material.service');

const PDF_CONTENT = Buffer.from([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x37]);
const PDF_FILE = { originalname: 'notes.pdf', size: PDF_CONTENT.length, buffer: PDF_CONTENT };
const validMetadata = {
  title: 'ER Diagrams',
  description: 'Entity relationship notes',
  category: 'Notes',
  topic: 'dbms',
  rightsConfirmed: 'true',
};
const userId = '64ff31e5fe2f1f25a49f4b72';
const contributorAuth = { userId, role: 'student', contributor: true };

async function expectRejectedUpload(service, auth, metadata, file, { detailsField, ...expected }) {
  await expect(service.uploadMaterial(auth, metadata, file)).rejects.toMatchObject({ ...expected });
  try {
    await service.uploadMaterial(auth, metadata, file);
  } catch (error) {
    if (detailsField) {
      expect(error.code).toBe('VALIDATION_ERROR');
      expect(error.details.some((detail) => detail.field === detailsField)).toBe(true);
    }
  }
}

describe('Material service (unit, mocked repository/storage)', () => {
  let repository;
  let storage;
  let service;

  beforeEach(() => {
    repository = { create: jest.fn(async (doc) => ({ ...doc })) };
    storage = { put: jest.fn(async () => ({ key: '' })), get: jest.fn(), remove: jest.fn(async () => ({})) };
    service = createMaterialService({ repository, storage });
  });

  test('TC-MAT-01: contributor upload returns 201 private and persists a normalised document', async () => {
    const document = await service.uploadMaterial(contributorAuth, validMetadata, PDF_FILE);
    expect(document.title).toBe('ER Diagrams');
    expect(document.visibility).toBe('private');
    expect(document.ownerId).toBe(userId);
    expect(document.fileUrl).toBe(`/api/v1/materials/${document._id.toString()}/file`);
    expect(document.mimeType).toBe('application/pdf');
    expect(storage.put).toHaveBeenCalledWith(document.storageKey, PDF_CONTENT);
  });

  test('educator without contributor privilege may upload (TC-MAT-09 authorisation)', async () => {
    const educatorAuth = { userId, role: 'educator', contributor: false };
    await expect(service.uploadMaterial(educatorAuth, validMetadata, PDF_FILE)).resolves.toBeDefined();
    expect(repository.create).toHaveBeenCalledTimes(1);
  });

  test('plain student receives 403 and nothing is stored (TC-MAT-02)', async () => {
    await expectRejectedUpload(service, { userId, role: 'student', contributor: false }, validMetadata, PDF_FILE, { statusCode: 403, code: 'FORBIDDEN' });
    expect(storage.put).not.toHaveBeenCalled();
    expect(repository.create).not.toHaveBeenCalled();
  });

  test('admin receives 403 (admins cannot author), nothing stored', async () => {
    await expectRejectedUpload(service, { userId, role: 'admin', contributor: true }, validMetadata, PDF_FILE, { statusCode: 403, code: 'FORBIDDEN' });
    expect(storage.put).not.toHaveBeenCalled();
    expect(repository.create).not.toHaveBeenCalled();
  });

  test('missing auth receives 401 UNAUTHENTICATED', async () => {
    await expectRejectedUpload(service, undefined, validMetadata, PDF_FILE, { statusCode: 401, code: 'UNAUTHENTICATED' });
    expect(storage.put).not.toHaveBeenCalled();
  });

  test('TC-MAT-10: missing or false rightsConfirmed is rejected naming the field, nothing stored', async () => {
    for (const rightsConfirmed of [undefined, 'false']) {
      await expectRejectedUpload(service, contributorAuth, { ...validMetadata, rightsConfirmed }, PDF_FILE, { statusCode: 400, detailsField: 'rightsConfirmed' });
    }
    expect(repository.create).not.toHaveBeenCalled();
    expect(storage.put).not.toHaveBeenCalled();
  });

  test('TC-MAT-03: title "" and "ab" are rejected, naming field title', async () => {
    for (const title of ['', 'ab']) {
      await expectRejectedUpload(service, contributorAuth, { ...validMetadata, title }, PDF_FILE, { statusCode: 400, detailsField: 'title' });
    }
    expect(repository.create).not.toHaveBeenCalled();
  });

  test('TC-MAT-12: title of 120 characters is valid, of 121 is invalid; missing category and empty topic are rejected', async () => {
    const length120 = 'x'.repeat(120);
    await expect(service.uploadMaterial(contributorAuth, { ...validMetadata, title: length120 }, PDF_FILE)).resolves.toBeDefined();
    await expectRejectedUpload(service, contributorAuth, { ...validMetadata, title: 'x'.repeat(121) }, PDF_FILE, { statusCode: 400, detailsField: 'title' });
    await expectRejectedUpload(service, contributorAuth, { ...validMetadata, category: undefined }, PDF_FILE, { statusCode: 400, detailsField: 'category' });
    await expectRejectedUpload(service, contributorAuth, { ...validMetadata, topic: '' }, PDF_FILE, { statusCode: 400, detailsField: 'topic' });
  });

  test('repository failure cleans up the stored file and returns 500, no half-written material', async () => {
    repository.create = jest.fn(async () => { throw new Error('database unavailable'); });
    await expect(service.uploadMaterial(contributorAuth, validMetadata, PDF_FILE))
      .rejects.toMatchObject({ statusCode: 500, code: 'INTERNAL_ERROR' });
    expect(storage.remove).toHaveBeenCalledTimes(1);
  });

  test('schema guardrails: visibility default private, hidden default false, title bounds', () => {
    const titlePath = Material.schema.path('title');
    expect(titlePath.options.maxlength).toBe(120);
    expect(titlePath.options.minlength).toBe(3);
    const visibilityPath = Material.schema.path('visibility');
    expect(visibilityPath.options.enum).toEqual(['private', 'shared', 'public']);
    expect(visibilityPath.options.default).toBe('private');
    expect(Material.schema.path('hidden').options.default).toBe(false);
    expect(Material.collection.name).toBe('studymaterials');
  });

  test('service requires injected dependencies', () => {
    expect(() => createMaterialService()).toThrow('Material service requires a repository and storage adapter.');
  });

  test('missing file is rejected before storage', async () => {
    await expectRejectedUpload(service, contributorAuth, validMetadata, undefined, { statusCode: 400, code: 'VALIDATION_ERROR' });
    expect(storage.put).not.toHaveBeenCalled();
  });
});
