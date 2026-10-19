const express = require('express');
const multer = require('multer');
const { AppError } = require('../../utils/AppError');
const { asyncHandler } = require('../../utils/asyncHandler');
const { MAX_FILE_SIZE_BYTES } = require('./fileValidation');

function createMaterialsRouter({ service, authMiddleware } = {}) {
  if (!service) throw new Error('Materials router requires a configured service.');
  if (!authMiddleware) throw new Error('Materials router requires an auth middleware; the shared auth PR must supply a real one.');

  const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_FILE_SIZE_BYTES, files: 1 } });
  const router = express.Router();

  // The guard applies to materials routes only; other /api/v1 resources and the
  // 404/error handlers stay untouched until the shared auth PR lands.
  router.use('/materials', authMiddleware);
  router.post('/materials', (req, res, next) => {
    upload.single('file')(req, res, (error) => {
      if (error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE') {
        return next(new AppError(413, 'FILE_TOO_LARGE', 'The uploaded file exceeds the 20 MB limit.', [{ field: 'file', message: 'Maximum size is 20 MB.' }]));
      }
      if (error) return next(error);
      return next();
    });
  }, asyncHandler(async (req, res) => {
    const document = await service.uploadMaterial(req.auth, req.body, req.file);
    const view = {
      id: document._id.toString(),
      title: document.title,
      visibility: document.visibility,
      fileUrl: document.fileUrl,
    };
    return res.status(201).json(view);
  }));

  return router;
}

module.exports = { createMaterialsRouter };
