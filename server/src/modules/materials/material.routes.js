const path = require('node:path');
const express = require('express');
const multer = require('multer');
const { AppError } = require('../../utils/AppError');
const { asyncHandler } = require('../../utils/asyncHandler');
const { rejectUnsafeKeys } = require('../../middleware/rejectUnsafeKeys');
const { MAX_FILE_SIZE_BYTES } = require('./fileValidation');

function parserErrorToAppError(error) {
  if (error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE') {
    return new AppError(413, 'FILE_TOO_LARGE', 'The uploaded file exceeds the 20 MB limit.', [{ field: 'file', message: 'Maximum size is 20 MB.' }]);
  }
  if (error instanceof multer.MulterError) {
    const messages = {
      LIMIT_FILE_COUNT: 'Only one file may be uploaded.',
      LIMIT_UNEXPECTED_FILE: 'The file must be sent in the "file" field.',
      LIMIT_PART_COUNT: 'The multipart request contains too many parts.',
      LIMIT_FIELD_COUNT: 'The multipart request contains too many fields.',
      LIMIT_FIELD_KEY: 'A multipart field name is too long.',
      LIMIT_FIELD_VALUE: 'A multipart field value is too long.',
    };
    return new AppError(400, 'VALIDATION_ERROR', 'Invalid multipart request.', [{ field: 'file', message: messages[error.code] || 'The multipart request is invalid.' }]);
  }
  return new AppError(400, 'VALIDATION_ERROR', 'Malformed multipart request.', [{ field: 'request', message: 'The multipart request could not be parsed.' }]);
}

function materialView(document, auth) {
  const view = {
    id: document._id.toString(),
    title: document.title,
    description: document.description,
    category: document.category,
    topic: document.topic,
    tags: document.tags || [],
    fileUrl: document.fileUrl,
    mimeType: document.mimeType,
    sizeBytes: document.sizeBytes,
    ownerId: document.ownerId.toString(),
    visibility: document.visibility,
    createdAt: document.createdAt,
    updatedAt: document.updatedAt,
  };

  if (String(document.ownerId) === String(auth.userId) || auth.role === 'admin') {
    view.sharedWith = (document.sharedWith || []).map(String);
    view.hidden = document.hidden;
  }

  return view;
}

function createMaterialsRouter({ service, authMiddleware } = {}) {
  if (!service) throw new Error('Materials router requires a configured service.');
  if (!authMiddleware) throw new Error('Materials router requires an auth middleware.');

  const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_FILE_SIZE_BYTES, files: 1 } });
  const router = express.Router();

  // The guard applies to materials routes only; public resources and the
  // 404/error handlers remain outside this router.
  router.use('/materials', authMiddleware);
  router.post('/materials', (req, res, next) => {
    upload.single('file')(req, res, (error) => {
      if (error) return next(parserErrorToAppError(error));
      return next();
    });
  }, rejectUnsafeKeys, asyncHandler(async (req, res) => {
    const document = await service.uploadMaterial(req.auth, req.body, req.file);
    const view = {
      id: document._id.toString(),
      title: document.title,
      visibility: document.visibility,
      fileUrl: document.fileUrl,
    };
    return res.status(201).json(view);
  }));

  router.get('/materials/:id/file', asyncHandler(async (req, res) => {
    const { document, bytes } = await service.getMaterialFile(req.auth, req.params.id);
    const extension = path.extname(document.storageKey).slice(1).toLowerCase().replace(/[^a-z0-9]/g, '') || 'bin';
    const filename = `material-${document._id.toString()}.${extension}`;

    res.set({
      'Content-Type': document.mimeType,
      'Content-Length': String(bytes.length),
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'private, no-store',
    });

    return res.send(bytes);
  }));

  router.get('/materials/:id', asyncHandler(async (req, res) => {
    const document = await service.getMaterial(req.auth, req.params.id);
    return res.json(materialView(document, req.auth));
  }));

  return router;
}

module.exports = { createMaterialsRouter };
