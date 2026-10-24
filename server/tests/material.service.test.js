const { Material } = require('../src/models/Material');
const { createMaterialService } = require('../src/modules/materials/material.service');

const TAG_MAX_LENGTH = 30;

const PDF_CONTENT = Buffer.from([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x37]);
const PDF_FILE = { originalname: 'notes.pdf', size: PDF_CONTENT.length, buffer: PDF_CONTENT };
const validMetadata = {
  title: 'ER Diagrams',
  description: 'Entity relationship notes',
  category: 'Notes',
  topic: 'dbms',
  tags: 'ER, dbms, ER',
  rightsConfirmed: 'true',
};
const userId = '64ff31e5fe2f1f25a49f4b72';
const sharedUserId = '64ff31e5fe2f1f25a49f4b73';
const outsiderUserId = '64ff31e5fe2f1f25a49f4b74';
const adminUserId = '64ff31e5fe2f1f25a49f4b75';
const materialId = '64ff31e5fe2f1f25a49f4b76';
const contributorAuth = { userId, role: 'student', contributor: true };
const sharedAuth = { userId: sharedUserId, role: 'student', contributor: false };
const outsiderAuth = { userId: outsiderUserId, role: 'student', contributor: false };
const adminAuth = { userId: adminUserId, role: 'admin', contributor: true };

function materialDocument(overrides = {}) {
  return {
    _id: materialId,
    ownerId: userId,
    visibility: 'private',
    sharedWith: [],
    hidden: false,
    __v: 0,
    storageKey: `${materialId}.pdf`,
    ...overrides,
  };
}

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
    repository = {
      create: jest.fn(async (doc) => ({ ...doc })),
      findById: jest.fn(),
      list: jest.fn(async () => ({ items: [], page: 1, limit: 20, total: 0 })),
      updateIfVersion: jest.fn(async (id, version, data) => ({ _id: id, __v: version + 1, ...data })),
    };
    storage = { put: jest.fn(async () => ({ key: '' })), get: jest.fn(), remove: jest.fn(async () => ({})) };
    service = createMaterialService({ repository, storage });
  });

  test('TC-MAT-01: contributor upload with duplicate and case-variant tags is normalised, lowercased and de-duplicated', async () => {
    const document = await service.uploadMaterial(contributorAuth, validMetadata, PDF_FILE);
    expect(document.tags).toEqual(['er', 'dbms']);
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

  test('TC-MAT-11: tag boundaries 0, 1, 10, 11 tags and 30, 31 chars (BVA)', async () => {
    const tag30 = 'x'.repeat(TAG_MAX_LENGTH);
    await expectRejectedUpload(service, contributorAuth, { ...validMetadata, tags: undefined }, PDF_FILE, { statusCode: 400, detailsField: 'tags' });
    expect(repository.create).not.toHaveBeenCalled();

    expect((await service.uploadMaterial(contributorAuth, { ...validMetadata, tags: tag30 }, PDF_FILE)).tags).toEqual([tag30]);

    const tenTags = 't0,t1,t2,t3,t4,t5,t6,t7,t8,t9';
    expect((await service.uploadMaterial(contributorAuth, { ...validMetadata, tags: tenTags }, PDF_FILE)).tags).toHaveLength(10);

    await expectRejectedUpload(service, contributorAuth, { ...validMetadata, tags: `${tenTags},t10` }, PDF_FILE, { statusCode: 400, detailsField: 'tags' });
    await expectRejectedUpload(service, contributorAuth, { ...validMetadata, tags: `${tag30}x` }, PDF_FILE, { statusCode: 400, detailsField: 'tags' });
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

  test('model rejects direct writers that bypass tag normalisation', () => {
    const base = {
      title: 'ER Diagrams',
      description: 'Entity relationship notes',
      category: 'Notes',
      topic: 'dbms',
      fileUrl: '/api/v1/materials/64ff31e5fe2f1f25a49f4b72/file',
      storageKey: '64ff31e5fe2f1f25a49f4b72.pdf',
      mimeType: 'application/pdf',
      sizeBytes: 8,
      ownerId: userId,
    };
    expect(new Material({ ...base, tags: ['UPPER', 'UPPER'] }).validateSync()).toBeDefined();
    expect(new Material({ ...base, tags: ['er', 'ER'] }).validateSync()).toBeDefined();
    expect(new Material({ ...base, tags: [' er', 'dbms'] }).validateSync()).toBeDefined();
    expect(new Material({ ...base, tags: ['er', 'dbms'] }).validateSync()).toBeUndefined();
  });

  test('service requires injected dependencies', () => {
    expect(() => createMaterialService()).toThrow('Material service requires a repository and storage adapter.');
  });

  test('missing file is rejected before storage', async () => {
    await expectRejectedUpload(service, contributorAuth, validMetadata, undefined, { statusCode: 400, code: 'VALIDATION_ERROR' });
    expect(storage.put).not.toHaveBeenCalled();
  });

  test('owner can retrieve a private material (TC-MAT-17)', async () => {
    const document = materialDocument();
    repository.findById.mockResolvedValue(document);

    await expect(service.getMaterial(contributorAuth, materialId)).resolves.toBe(document);
    expect(repository.findById).toHaveBeenCalledWith(materialId);
  });

  test('other users receive 404 for a private material (TC-MAT-17)', async () => {
    repository.findById.mockResolvedValue(materialDocument());

    await expect(service.getMaterial(outsiderAuth, materialId)).rejects.toMatchObject({ statusCode: 404, code: 'NOT_FOUND' });
  });

  test('shared material is visible only to owner and listed users (TC-MAT-05)', async () => {
    repository.findById.mockResolvedValue(materialDocument({ visibility: 'shared', sharedWith: [sharedUserId] }));

    await expect(service.getMaterial(sharedAuth, materialId)).resolves.toBeDefined();
    await expect(service.getMaterial(outsiderAuth, materialId)).rejects.toMatchObject({ statusCode: 404, code: 'NOT_FOUND' });
  });

  test('public material is visible to any authenticated user (TC-MAT-05)', async () => {
    repository.findById.mockResolvedValue(materialDocument({ visibility: 'public' }));

    await expect(service.getMaterial(outsiderAuth, materialId)).resolves.toBeDefined();
  });

  test('hidden material is visible to owner and admin only', async () => {
    repository.findById.mockResolvedValue(materialDocument({ visibility: 'public', hidden: true }));

    await expect(service.getMaterial(contributorAuth, materialId)).resolves.toBeDefined();
    await expect(service.getMaterial(adminAuth, materialId)).resolves.toBeDefined();
    await expect(service.getMaterial(outsiderAuth, materialId)).rejects.toMatchObject({ statusCode: 404, code: 'NOT_FOUND' });
  });

  test('detail requires authentication, a valid ID and an existing material', async () => {
    await expect(service.getMaterial(undefined, materialId)).rejects.toMatchObject({ statusCode: 401, code: 'UNAUTHENTICATED' });
    await expect(service.getMaterial(contributorAuth, 'not-an-object-id')).rejects.toMatchObject({ statusCode: 400, code: 'VALIDATION_ERROR' });
    repository.findById.mockResolvedValue(null);
    await expect(service.getMaterial(contributorAuth, materialId)).rejects.toMatchObject({ statusCode: 404, code: 'NOT_FOUND' });
  });

  test('file retrieval returns stored bytes only after access is granted', async () => {
    const bytes = Buffer.from('stored material');
    repository.findById.mockResolvedValue(materialDocument());
    storage.get.mockResolvedValue(bytes);

    await expect(service.getMaterialFile(contributorAuth, materialId)).resolves.toEqual({
      document: expect.objectContaining({ _id: materialId }),
      bytes,
    });
    expect(storage.get).toHaveBeenCalledWith(`${materialId}.pdf`);

    storage.get.mockClear();
    await expect(service.getMaterialFile(outsiderAuth, materialId)).rejects.toMatchObject({ statusCode: 404, code: 'NOT_FOUND' });
    expect(storage.get).not.toHaveBeenCalled();
  });

  test('file retrieval hides storage failures and invalid buffers', async () => {
    repository.findById.mockResolvedValue(materialDocument());
    storage.get.mockRejectedValueOnce(new Error('ENOENT: /secret/path'));
    await expect(service.getMaterialFile(contributorAuth, materialId)).rejects.toMatchObject({ statusCode: 500, code: 'INTERNAL_ERROR' });

    storage.get.mockResolvedValueOnce('not a buffer');
    await expect(service.getMaterialFile(contributorAuth, materialId)).rejects.toMatchObject({ statusCode: 500, code: 'INTERNAL_ERROR' });
  });

  describe('searchMaterials', () => {
    test('requires authentication', async () => {
      await expect(service.searchMaterials(undefined, {})).rejects.toMatchObject({ statusCode: 401, code: 'UNAUTHENTICATED' });
    });

    test('builds visibility-safe filter for non-admin user', async () => {
      await service.searchMaterials(contributorAuth, { q: 'sql', category: 'Notes', tag: 'dbms', topic: 'rdbms' });

      expect(repository.list).toHaveBeenCalledWith(
        expect.objectContaining({
          $or: expect.arrayContaining([
            { visibility: 'public', hidden: false },
            { ownerId: expect.anything() },
            { visibility: 'shared', hidden: false, sharedWith: expect.anything() },
          ]),
          $text: { $search: 'sql' },
          tags: 'dbms',
          category: expect.any(RegExp),
          topic: expect.any(RegExp),
        }),
        1,
        20,
        expect.any(Object),
      );
    });

    test('admin searches without $or visibility constraint', async () => {
      await service.searchMaterials(adminAuth, { q: 'all' });
      expect(repository.list).toHaveBeenCalledWith(
        expect.not.objectContaining({ $or: expect.anything() }),
        1,
        20,
        expect.any(Object),
      );
    });

    test('rejects invalid limit or page', async () => {
      await expect(service.searchMaterials(contributorAuth, { limit: 100 })).rejects.toMatchObject({
        statusCode: 400,
        code: 'VALIDATION_ERROR',
      });
      await expect(service.searchMaterials(contributorAuth, { page: 0 })).rejects.toMatchObject({
        statusCode: 400,
        code: 'VALIDATION_ERROR',
      });
    });
  });

  describe('updateVisibility', () => {
    test('requires authentication and valid material ID', async () => {
      await expect(service.updateVisibility(undefined, materialId, { visibility: 'public' })).rejects.toMatchObject({
        statusCode: 401,
        code: 'UNAUTHENTICATED',
      });
      await expect(service.updateVisibility(contributorAuth, 'bad-id', { visibility: 'public' })).rejects.toMatchObject({
        statusCode: 400,
        code: 'VALIDATION_ERROR',
      });
    });

    test('rejects non-owner modification with 403 FORBIDDEN', async () => {
      repository.findById.mockResolvedValue(materialDocument({ ownerId: '64ff31e5fe2f1f25a49f4b99' }));
      await expect(service.updateVisibility(contributorAuth, materialId, { visibility: 'public' })).rejects.toMatchObject({
        statusCode: 403,
        code: 'FORBIDDEN',
      });
    });

    test('owner can update to shared with sharedWith user array', async () => {
      repository.findById.mockResolvedValue(materialDocument());
      await service.updateVisibility(contributorAuth, materialId, {
        visibility: 'shared',
        sharedWith: [sharedUserId],
      });

      expect(repository.updateIfVersion).toHaveBeenCalledWith(
        materialId,
        0,
        expect.objectContaining({
          visibility: 'shared',
          sharedWith: expect.arrayContaining([expect.anything()]),
        }),
      );
    });

    test('rejects shared visibility when only the owner ID is supplied, including uppercase', async () => {
      repository.findById.mockResolvedValue(materialDocument());
      await expect(service.updateVisibility(contributorAuth, materialId, {
        visibility: 'shared',
        sharedWith: [userId.toUpperCase()],
      })).rejects.toMatchObject({
        statusCode: 400,
        code: 'VALIDATION_ERROR',
      });
      expect(repository.updateIfVersion).not.toHaveBeenCalled();
    });

    test('rejects shared visibility when existing sharedWith contains only the owner in another case', async () => {
      repository.findById.mockResolvedValue(materialDocument({
        visibility: 'private',
        sharedWith: [userId.toUpperCase()],
      }));
      await expect(service.updateVisibility(contributorAuth, materialId, {
        visibility: 'shared',
      })).rejects.toMatchObject({
        statusCode: 400,
        code: 'VALIDATION_ERROR',
      });
      expect(repository.updateIfVersion).not.toHaveBeenCalled();
    });

    test('normalizes and deduplicates sharedWith, excluding the owner in any case', async () => {
      repository.findById.mockResolvedValue(materialDocument());
      await service.updateVisibility(contributorAuth, materialId, {
        visibility: 'shared',
        sharedWith: [userId.toUpperCase(), sharedUserId.toUpperCase(), sharedUserId],
      });

      const updateData = repository.updateIfVersion.mock.calls[0][2];
      expect(updateData.visibility).toBe('shared');
      expect(updateData.sharedWith).toHaveLength(1);
      expect(String(updateData.sharedWith[0])).toBe(sharedUserId);
    });

    test('updating to public or private clears sharedWith', async () => {
      repository.findById.mockResolvedValue(materialDocument({ visibility: 'shared', sharedWith: [sharedUserId] }));
      await service.updateVisibility(contributorAuth, materialId, { visibility: 'public' });
      expect(repository.updateIfVersion).toHaveBeenCalledWith(materialId, 0, { visibility: 'public', sharedWith: [] });

      await service.updateVisibility(contributorAuth, materialId, { visibility: 'private' });
      expect(repository.updateIfVersion).toHaveBeenCalledWith(materialId, 0, { visibility: 'private', sharedWith: [] });
    });

    test('admin can update visibility on another user material', async () => {
      repository.findById.mockResolvedValue(materialDocument({ ownerId: '64ff31e5fe2f1f25a49f4b99' }));
      await service.updateVisibility(adminAuth, materialId, { visibility: 'public' });
      expect(repository.updateIfVersion).toHaveBeenCalled();
    });

    test.each([
      ['shared', 'private'], ['private', 'shared'],
    ])('recomputes a recipient-only update after a stale %s snapshot becomes %s', async (initial, current) => {
      repository.findById
        .mockResolvedValueOnce(materialDocument({ visibility: initial, sharedWith: [sharedUserId] }))
        .mockResolvedValueOnce(materialDocument({ visibility: current, sharedWith: [sharedUserId], __v: 1 }));
      repository.updateIfVersion.mockResolvedValueOnce(null);

      const result = await service.updateVisibility(contributorAuth, materialId, { sharedWith: [outsiderUserId] });

      expect(repository.updateIfVersion).toHaveBeenCalledTimes(2);
      expect(repository.updateIfVersion.mock.calls.map((call) => call[1])).toEqual([0, 1]);
      expect(result.visibility).toBe(current);
      expect(result.sharedWith.map(String)).toEqual(current === 'shared' ? [outsiderUserId] : []);
    });

    test('revalidates empty recipients against the current shared state after a stale write', async () => {
      repository.findById
        .mockResolvedValueOnce(materialDocument())
        .mockResolvedValueOnce(materialDocument({ visibility: 'shared', sharedWith: [sharedUserId], __v: 1 }));
      repository.updateIfVersion.mockResolvedValueOnce(null);

      await expect(service.updateVisibility(contributorAuth, materialId, { sharedWith: [] }))
        .rejects.toMatchObject({ statusCode: 400, code: 'VALIDATION_ERROR' });
      expect(repository.updateIfVersion).toHaveBeenCalledTimes(1);
    });

    test.each([
      [null, 404, 'NOT_FOUND'],
      [materialDocument({ ownerId: outsiderUserId, __v: 1 }), 403, 'FORBIDDEN'],
    ])('rechecks existence and ownership after a stale write (%s)', async (current, statusCode, code) => {
      repository.findById.mockResolvedValueOnce(materialDocument()).mockResolvedValueOnce(current);
      repository.updateIfVersion.mockResolvedValueOnce(null);

      await expect(service.updateVisibility(contributorAuth, materialId, { visibility: 'public' }))
        .rejects.toMatchObject({ statusCode, code });
      expect(repository.updateIfVersion).toHaveBeenCalledTimes(1);
    });

    test('returns a bounded conflict instead of acknowledging repeated stale updates', async () => {
      repository.findById.mockResolvedValue(materialDocument());
      repository.updateIfVersion.mockResolvedValue(null);

      await expect(service.updateVisibility(contributorAuth, materialId, { visibility: 'public' }))
        .rejects.toMatchObject({ statusCode: 409, code: 'MATERIAL_CONFLICT' });
      expect(repository.findById).toHaveBeenCalledTimes(3);
      expect(repository.updateIfVersion).toHaveBeenCalledTimes(3);
      expect(storage.put).not.toHaveBeenCalled();
      expect(storage.remove).not.toHaveBeenCalled();
    });

    test('rejects shared visibility with empty sharedWith array', async () => {
      repository.findById.mockResolvedValue(materialDocument());
      await expect(
        service.updateVisibility(contributorAuth, materialId, { visibility: 'shared', sharedWith: [] }),
      ).rejects.toMatchObject({
        statusCode: 400,
        code: 'VALIDATION_ERROR',
      });
    });
  });
});
