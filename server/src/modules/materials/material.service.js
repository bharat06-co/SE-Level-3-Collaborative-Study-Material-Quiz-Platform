const mongoose = require('mongoose');
const { z } = require('zod');
const { AppError } = require('../../utils/AppError');
const { validateFile, MAX_FILE_SIZE_BYTES } = require('./fileValidation');
const { MAX_TAGS, TAG_MAX_LENGTH } = require('../../models/Material');

const metadataSchema = z.object({
  title: z.string().trim().min(3).max(120),
  description: z.string().trim().min(1).max(2000),
  category: z.string().trim().min(1).max(100),
  topic: z.string().trim().min(1).max(100),
  rightsConfirmed: z.literal('true'),
});

const optionalSearchText = (max) =>
  z.string()
    .trim()
    .max(max)
    .optional()
    .transform((val) => (val && val.length > 0 ? val : undefined));

const searchQuerySchema = z.object({
  q: optionalSearchText(200),
  tag: optionalSearchText(30),
  category: optionalSearchText(100),
  topic: optionalSearchText(100),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
}).strict();

const updateVisibilitySchema = z.object({
  visibility: z.enum(['private', 'shared', 'public']).optional(),
  sharedWith: z.array(z.string().regex(/^[a-f\d]{24}$/i, 'Invalid user ID in sharedWith')).optional(),
}).strict().refine((data) => data.visibility !== undefined || data.sharedWith !== undefined, {
  message: 'At least one of visibility or sharedWith must be provided.',
}).refine((data) => {
  if (data.visibility === 'shared') {
    return Array.isArray(data.sharedWith) && data.sharedWith.length > 0;
  }
  return true;
}, {
  message: 'sharedWith must contain at least one user ID when visibility is shared.',
  path: ['sharedWith'],
});

const updateMaterialSchema = z.object({
  title: z.string().trim().min(3).max(120).optional(),
  description: z.string().trim().min(1).max(2000).optional(),
  category: z.string().trim().min(1).max(100).optional(),
  topic: z.string().trim().min(1).max(100).optional(),
  tags: z.array(z.string().min(1).max(TAG_MAX_LENGTH)).min(1).max(MAX_TAGS).optional(),
  visibility: z.enum(['private', 'shared', 'public']).optional(),
  sharedWith: z.array(z.string().regex(/^[a-f\d]{24}$/i, 'Invalid user ID in sharedWith')).optional(),
}).strict().refine((data) => {
  if (data.visibility === 'shared') {
    return Array.isArray(data.sharedWith) && data.sharedWith.length > 0;
  }
  return true;
}, {
  message: 'sharedWith must contain at least one user ID when visibility is shared.',
  path: ['sharedWith'],
});

const METADATA_FIELDS = ['title', 'description', 'category', 'topic', 'tags'];

const ratingSchema = z.object({
  value: z.number().int().min(1).max(5),
}).strict();

function escapeRegex(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function normalizeTags(tagsInput) {
  let parsed;
  if (typeof tagsInput === 'string') {
    parsed = tagsInput.split(',');
  } else if (Array.isArray(tagsInput)) {
    parsed = tagsInput;
  } else {
    throw new AppError(400, 'VALIDATION_ERROR', 'Validation failed.', [{ field: 'tags', message: 'Provide 1-10 tags.' }]);
  }
  const tags = [...new Set(parsed
    .map((tag) => (typeof tag === 'string' ? tag.trim().toLowerCase() : ''))
    .filter(Boolean))];
  if (tags.length < 1) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Validation failed.', [{ field: 'tags', message: 'Provide 1-10 tags.' }]);
  }
  if (tags.length > MAX_TAGS) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Validation failed.', [{ field: 'tags', message: `At most ${MAX_TAGS} tags are allowed.` }]);
  }
  if (tags.some((tag) => tag.length > TAG_MAX_LENGTH || tag.length < 1)) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Validation failed.', [{ field: 'tags', message: `Each tag must be 1-${TAG_MAX_LENGTH} characters.` }]);
  }
  return tags;
}

function validationDetails(zodError) {
  return zodError.issues.map((issue) => ({
    field: issue.path.join('.') || 'request',
    message: issue.message,
  }));
}

function authorised(auth) {
  if (!auth || !auth.userId) return false;
  if (auth.role === 'educator') return true;
  return auth.role === 'student' && auth.contributor === true;
}

function canView(auth, document, { ignoreHidden = false } = {}) {
  const userId = String(auth.userId);
  if (String(document.ownerId) === userId) return true;
  if (auth.role === 'admin') return true;
  if (document.hidden && !ignoreHidden) return false;
  if (document.visibility === 'public') return true;
  if (document.visibility !== 'shared') return false;
  return (document.sharedWith || []).some((sharedId) => String(sharedId) === userId);
}

function requireAuth(auth) {
  if (!auth || !auth.userId) {
    throw new AppError(401, 'UNAUTHENTICATED', 'Authentication required.', [{ field: 'auth', message: 'Sign in first.' }]);
  }
}

function requireMaterialId(id) {
  if (typeof id !== 'string' || !/^[a-f\d]{24}$/i.test(id)) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Validation failed.', [{ field: 'id', message: 'Material ID is invalid.' }]);
  }
}

function createMaterialService({ repository, storage, revisionRepository } = {}) {
  if (!repository || !storage) throw new Error('Material service requires a repository and storage adapter.');

  async function uploadMaterial(auth, metadataInput, file) {
    if (!auth || !auth.userId) {
      throw new AppError(401, 'UNAUTHENTICATED', 'Authentication required.', [{ field: 'auth', message: 'Sign in first.' }]);
    }
    if (auth.role === 'admin') {
      throw new AppError(403, 'FORBIDDEN', 'Administrators do not author study material.');
    }
    if (!authorised(auth)) {
      throw new AppError(403, 'FORBIDDEN', 'No authoring rights.');
    }
    if (!file || !file.buffer || !file.originalname) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Validation failed.', [{ field: 'file', message: 'A file is required.' }]);
    }
    const meta = metadataSchema.safeParse(metadataInput);
    if (!meta.success) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Validation failed.', validationDetails(meta.error));
    }
    const tags = normalizeTags(metadataInput.tags);
    const { mimeType, extension } = validateFile({ originalName: file.originalname, size: file.size, bytes: file.buffer });

    const materialId = new mongoose.Types.ObjectId();
    const storageKey = `${materialId.toString()}.${extension}`;
    try {
      await storage.put(storageKey, file.buffer);
      const document = await repository.create({
        _id: materialId,
        title: meta.data.title,
        description: meta.data.description,
        category: meta.data.category,
        topic: meta.data.topic,
        tags,
        fileUrl: `/api/v1/materials/${materialId.toString()}/file`,
        storageKey,
        mimeType,
        sizeBytes: file.size,
        ownerId: auth.userId,
        visibility: 'private',
      });
      return document;
    } catch (error) {
      await storage.remove(storageKey).catch(() => {});
      if (error instanceof AppError) throw error;
      throw new AppError(500, 'INTERNAL_ERROR', 'Unable to save the uploaded material.');
    }
  }

  async function getMaterial(auth, id) {
    requireAuth(auth);
    requireMaterialId(id);

    const document = await repository.findById(id);
    if (!document || !canView(auth, document)) {
      throw new AppError(404, 'NOT_FOUND', 'Material not found.');
    }

    return document;
  }

  async function getMaterialFile(auth, id) {
    const document = await getMaterial(auth, id);

    let bytes;
    try {
      bytes = await storage.get(document.storageKey);
    } catch {
      throw new AppError(500, 'INTERNAL_ERROR', 'Unable to read the stored material.');
    }

    if (!Buffer.isBuffer(bytes)) {
      throw new AppError(500, 'INTERNAL_ERROR', 'Unable to read the stored material.');
    }

    return { document, bytes };
  }

  async function searchMaterials(auth, queryInput) {
    requireAuth(auth);

    const parsed = searchQuerySchema.safeParse(queryInput || {});
    if (!parsed.success) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Validation failed.', validationDetails(parsed.error));
    }
    const { q, tag, category, topic, page, limit } = parsed.data;

    const filter = {};

    if (auth.role !== 'admin') {
      const userObjectId = new mongoose.Types.ObjectId(auth.userId);
      filter.$or = [
        { visibility: 'public', hidden: false },
        { ownerId: userObjectId },
        { visibility: 'shared', hidden: false, sharedWith: userObjectId },
      ];
    }

    if (q) {
      filter.$text = { $search: q };
    }
    if (tag) {
      filter.tags = tag.toLowerCase();
    }
    if (category) {
      filter.category = new RegExp(`^${escapeRegex(category)}$`, 'i');
    }
    if (topic) {
      filter.topic = new RegExp(`^${escapeRegex(topic)}$`, 'i');
    }

    const sort = q ? { score: { $meta: 'textScore' }, createdAt: -1 } : { createdAt: -1 };
    return repository.list(filter, page, limit, sort);
  }

  async function updateVisibility(auth, id, updateInput) {
    requireAuth(auth);
    requireMaterialId(id);

    const parsed = updateVisibilitySchema.safeParse(updateInput);
    if (!parsed.success) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Validation failed.', validationDetails(parsed.error));
    }

    const { visibility, sharedWith } = parsed.data;

    // Recheck permissions and both sharing fields after a competing write.
    // The version predicate makes this safe across independent API processes.
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const document = await repository.findById(id);
      if (!document) {
        throw new AppError(404, 'NOT_FOUND', 'Material not found.');
      }

      if (String(document.ownerId) !== String(auth.userId) && auth.role !== 'admin') {
        throw new AppError(403, 'FORBIDDEN', 'Only the owner or an administrator can modify material visibility.');
      }

      const targetVisibility = visibility || document.visibility;
      const updateData = { visibility: targetVisibility, sharedWith: [] };

      if (targetVisibility === 'shared') {
        const ownerId = String(document.ownerId).toLowerCase();
        const candidates = sharedWith !== undefined
          ? sharedWith
          : (document.sharedWith || []).map(String);
        const unique = [...new Set(candidates.map((userId) => String(userId).toLowerCase()))]
          .filter((userId) => userId !== ownerId);
        if (unique.length === 0) {
          throw new AppError(400, 'VALIDATION_ERROR', 'Validation failed.', [
            { field: 'sharedWith', message: 'At least one other user must be shared with.' },
          ]);
        }
        updateData.sharedWith = unique.map((uid) => new mongoose.Types.ObjectId(uid));
      }

      const updated = await repository.updateIfVersion(id, document.__v, updateData);
      if (updated) return updated;
    }
    throw new AppError(409, 'MATERIAL_CONFLICT', 'Material changed during this request. Please retry.');
  }

  async function updateMaterial(auth, id, updateInput, file) {
    requireAuth(auth);
    requireMaterialId(id);

    const raw = { ...(updateInput || {}) };
    if (raw.tags !== undefined) {
      raw.tags = normalizeTags(raw.tags);
    }

    const parsed = updateMaterialSchema.safeParse(raw);
    if (!parsed.success) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Validation failed.', validationDetails(parsed.error));
    }

    const data = parsed.data;
    const hasFile = Boolean(file);
    if (hasFile && (!file.buffer || !file.originalname)) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Validation failed.', [{ field: 'file', message: 'A file is required.' }]);
    }
    const hasAnyChange = hasFile || METADATA_FIELDS.some((field) => data[field] !== undefined)
      || data.visibility !== undefined || data.sharedWith !== undefined;
    if (!hasAnyChange) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Validation failed.', [
        { field: 'request', message: 'Provide at least one field or file to update.' },
      ]);
    }
    const hasMetadataChange = hasFile || METADATA_FIELDS.some((field) => data[field] !== undefined);
    if (hasMetadataChange && !revisionRepository) {
      throw new AppError(500, 'INTERNAL_ERROR', 'Revision storage is not configured.');
    }

    let fileInfo = null;
    let newStorageKey = null;
    if (hasFile) {
      fileInfo = validateFile({ originalName: file.originalname, size: file.size, bytes: file.buffer });
      newStorageKey = `${id}-${Date.now()}-${Math.random().toString(36).slice(2)}.${fileInfo.extension}`;
      await storage.put(newStorageKey, file.buffer);
    }

    let committed = false;
    try {
      for (let attempt = 0; attempt < 3; attempt += 1) {
        const document = await repository.findById(id);
        if (!document) {
          throw new AppError(404, 'NOT_FOUND', 'Material not found.');
        }

        if (String(document.ownerId) !== String(auth.userId) && auth.role !== 'admin') {
          throw new AppError(403, 'FORBIDDEN', 'Only the owner or an administrator can edit material.');
        }

        const updateData = {};

        for (const field of METADATA_FIELDS) {
          if (data[field] !== undefined) updateData[field] = data[field];
        }

        if (data.visibility !== undefined || data.sharedWith !== undefined) {
          const targetVisibility = data.visibility || document.visibility;
          updateData.visibility = targetVisibility;
          if (targetVisibility === 'shared') {
            const ownerId = String(document.ownerId).toLowerCase();
            const candidates = data.sharedWith !== undefined
              ? data.sharedWith
              : (document.sharedWith || []).map(String);
            const unique = [...new Set(candidates.map((userId) => String(userId).toLowerCase()))]
              .filter((userId) => userId !== ownerId);
            if (unique.length === 0) {
              throw new AppError(400, 'VALIDATION_ERROR', 'Validation failed.', [
                { field: 'sharedWith', message: 'At least one other user must be shared with.' },
              ]);
            }
            updateData.sharedWith = unique.map((uid) => new mongoose.Types.ObjectId(uid));
          } else {
            updateData.sharedWith = [];
          }
        }

        if (hasFile) {
          updateData.storageKey = newStorageKey;
          updateData.mimeType = fileInfo.mimeType;
          updateData.sizeBytes = file.size;
        }

        let revision = null;
        if (hasMetadataChange) {
          let versionNo;
          try {
            versionNo = await revisionRepository.nextVersion(id);
            revision = await revisionRepository.create({
              materialId: id,
              versionNo,
              editorId: auth.userId,
              title: document.title,
              description: document.description || '',
              category: document.category,
              topic: document.topic,
              tags: document.tags || [],
              fileUrl: document.fileUrl,
            });
          } catch (error) {
            if (error?.code === 11000) continue;
            throw error;
          }
        }

        const updated = await repository.updateIfVersion(id, document.__v, updateData);
        if (updated) {
          committed = true;
          return updated;
        }

        if (revision) {
          await revisionRepository.remove(revision._id).catch(() => {});
        }
      }
    } finally {
      if (newStorageKey && !committed) {
        await storage.remove(newStorageKey).catch(() => {});
      }
    }

    throw new AppError(409, 'MATERIAL_CONFLICT', 'Material changed during this request. Please retry.');
  }

  async function getRevisions(auth, id) {
    requireAuth(auth);
    requireMaterialId(id);

    const document = await repository.findById(id);
    if (!document) {
      throw new AppError(404, 'NOT_FOUND', 'Material not found.');
    }
    if (String(document.ownerId) !== String(auth.userId) && auth.role !== 'admin') {
      throw new AppError(403, 'FORBIDDEN', 'Only the owner or an administrator can view revisions.');
    }
    if (!revisionRepository) {
      throw new AppError(500, 'INTERNAL_ERROR', 'Revision storage is not configured.');
    }

    return revisionRepository.listByMaterial(id);
  }

  async function getMaterialForReporting(auth, id) {
    requireAuth(auth);
    requireMaterialId(id);

    const document = await repository.findById(id);
    if (!document || !canView(auth, document, { ignoreHidden: true })) {
      throw new AppError(404, 'NOT_FOUND', 'Material not found.');
    }
    return document;
  }

  async function rateMaterial(auth, id, input) {
    requireAuth(auth);
    requireMaterialId(id);

    const parsed = ratingSchema.safeParse(input);
    if (!parsed.success) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Validation failed.', validationDetails(parsed.error));
    }

    const document = await repository.findById(id);
    if (!document || !canView(auth, document)) {
      throw new AppError(404, 'NOT_FOUND', 'Material not found.');
    }

    const updated = await repository.rate(id, auth.userId, parsed.data.value);
    if (!updated) {
      throw new AppError(404, 'NOT_FOUND', 'Material not found.');
    }
    return updated;
  }

  return {
    uploadMaterial,
    getMaterial,
    getMaterialFile,
    searchMaterials,
    updateVisibility,
    updateMaterial,
    getRevisions,
    rateMaterial,
    getMaterialForReporting,
  };
}

module.exports = { createMaterialService, MAX_FILE_SIZE_BYTES };
