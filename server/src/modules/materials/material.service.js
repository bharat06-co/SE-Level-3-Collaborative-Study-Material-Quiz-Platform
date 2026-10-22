const mongoose = require('mongoose');
const { z } = require('zod');
const { AppError } = require('../../utils/AppError');
const { validateFile, MAX_FILE_SIZE_BYTES } = require('./fileValidation');

const metadataSchema = z.object({
  title: z.string().trim().min(3).max(120),
  description: z.string().trim().min(1).max(2000),
  category: z.string().trim().min(1).max(100),
  topic: z.string().trim().min(1).max(100),
  rightsConfirmed: z.literal('true'),
});

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

function canView(auth, document) {
  const userId = String(auth.userId);
  if (String(document.ownerId) === userId) return true;
  if (auth.role === 'admin') return true;
  if (document.hidden) return false;
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

function createMaterialService({ repository, storage } = {}) {
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

  return { uploadMaterial, getMaterial, getMaterialFile };
}

module.exports = { createMaterialService, MAX_FILE_SIZE_BYTES };
