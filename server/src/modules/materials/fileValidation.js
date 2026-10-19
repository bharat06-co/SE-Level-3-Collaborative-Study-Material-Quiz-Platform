const { AppError } = require('../../utils/AppError');

const MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024;

// Extension and magic-byte signature must BOTH match. DOCX and PPTX are ZIP
// containers (PK\x03\x04), so the ZIP signature plus the extension identifies
// them; PDF/PNG/JPG signatures are unique.
const SIGNATURES = [
  { extension: 'pdf', mimeType: 'application/pdf', test: (bytes) => startsWith(bytes, [0x25, 0x50, 0x44, 0x46]) },
  { extension: 'docx', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', test: (bytes) => startsWith(bytes, [0x50, 0x4b, 0x03, 0x04]) },
  { extension: 'pptx', mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation', test: (bytes) => startsWith(bytes, [0x50, 0x4b, 0x03, 0x04]) },
  { extension: 'png', mimeType: 'image/png', test: (bytes) => startsWith(bytes, [0x89, 0x50, 0x4e, 0x47]) },
  { extension: 'jpg', mimeType: 'image/jpeg', test: (bytes) => startsWith(bytes, [0xff, 0xd8, 0xff]) },
];

function startsWith(bytes, expected) {
  if (!Buffer.isBuffer(bytes) || bytes.length < expected.length) return false;
  return expected.every((byteValue, index) => bytes[index] === byteValue);
}

function extractExtension(originalName) {
  const name = String(originalName || '');
  const dotIndex = name.lastIndexOf('.');
  if (dotIndex <= 0 || dotIndex === name.length - 1) return '';
  return name.slice(dotIndex + 1).toLowerCase();
}

/**
 * Validates an uploaded file against SEC-006:
 * - accepted types: PDF, DOCX, PPTX, PNG and JPG only
 * - extension and file signature must agree (exe renamed to .pdf -> 415)
 * - strict size cap: 20 MB accepted, 20 MB + 1 byte -> 413
 * Returns the matching { extension, mimeType } for an accepted file.
 */
function validateFile({ originalName, size, bytes }) {
  if (size > MAX_FILE_SIZE_BYTES) {
    throw new AppError(413, 'FILE_TOO_LARGE', 'The uploaded file exceeds the 20 MB limit.', [{ field: 'file', message: 'Maximum size is 20 MB.' }]);
  }
  const extension = extractExtension(originalName);
  if (!bytes || typeof size !== 'number' || size === 0) {
    throw unsupportedFileType(extension);
  }
  const match = SIGNATURES.find((candidate) => candidate.extension === extension);
  if (!match || !match.test(bytes)) {
    throw unsupportedFileType(extension);
  }
  return { extension, mimeType: match.mimeType };
}

function unsupportedFileType(extension) {
  return new AppError(415, 'UNSUPPORTED_FILE_TYPE', 'The uploaded file type is not supported.', [{ field: 'file', message: `Extension '${extension || 'unknown'}' is not supported or does not match the file contents.` }]);
}

module.exports = { MAX_FILE_SIZE_BYTES, validateFile, extractExtension };
