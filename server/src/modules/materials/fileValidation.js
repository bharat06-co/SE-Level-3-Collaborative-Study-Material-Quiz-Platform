const zlib = require('node:zlib');
const { AppError } = require('../../utils/AppError');

const MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024;
const MAX_ZIP_ENTRIES = 2000;
const MAX_INSPECTED_ENTRY_BYTES = 1024 * 1024;

const ZIP_LOCAL_SIGNATURE = 0x04034b50;
const ZIP_CENTRAL_SIGNATURE = 0x02014b50;
const ZIP_EOCD_SIGNATURE = 0x06054b50;
const ZIP_FLAG_ENCRYPTED = 0x0001;

// Extension and magic-byte signature must BOTH match. DOCX/PPTX require a
// bounded inspection of the OOXML package because the ZIP signature alone does
// not identify a Word or PowerPoint document.
const SIGNATURES = [
  { extension: 'pdf', mimeType: 'application/pdf', test: (bytes) => startsWith(bytes, [0x25, 0x50, 0x44, 0x46]) },
  { extension: 'png', mimeType: 'image/png', test: (bytes) => startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]) },
  { extension: 'jpg', mimeType: 'image/jpeg', test: (bytes) => startsWith(bytes, [0xff, 0xd8, 0xff]) },
];

const OOXML_FORMATS = {
  docx: {
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    mainPart: 'word/document.xml',
    contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml',
  },
  pptx: {
    mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    mainPart: 'ppt/presentation.xml',
    contentType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml',
  },
};

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

function findEndOfCentralDirectory(bytes) {
  if (bytes.length < 22) return -1;
  const earliest = Math.max(0, bytes.length - 22 - 0xffff);
  for (let offset = bytes.length - 22; offset >= earliest; offset -= 1) {
    if (bytes.readUInt32LE(offset) === ZIP_EOCD_SIGNATURE) return offset;
  }
  return -1;
}

function readZipEntry(bytes, entry, maxOutputLength) {
  const localOffset = entry.localOffset;
  if (localOffset + 30 > bytes.length) return null;
  if (bytes.readUInt32LE(localOffset) !== ZIP_LOCAL_SIGNATURE) return null;
  const nameLength = bytes.readUInt16LE(localOffset + 26);
  const extraLength = bytes.readUInt16LE(localOffset + 28);
  const dataStart = localOffset + 30 + nameLength + extraLength;
  const dataEnd = dataStart + entry.compressedSize;
  if (dataStart > bytes.length || dataEnd > bytes.length) return null;
  const compressed = bytes.subarray(dataStart, dataEnd);
  if (entry.method === 0) {
    return compressed.length <= maxOutputLength ? compressed : null;
  }
  if (entry.method === 8) {
    try {
      return zlib.inflateRawSync(compressed, { maxOutputLength });
    } catch {
      return null;
    }
  }
  return null;
}

function readXmlAttribute(tag, attributeName) {
  const pattern = new RegExp(`\\b${attributeName}\\s*=\\s*("([^"]*)"|'([^']*)')`, 'i');
  const match = pattern.exec(tag);
  if (!match) return null;
  return match[2] !== undefined ? match[2] : match[3];
}

function hasContentTypeOverride(contentTypesXml, mainPart, expectedContentType) {
  const text = contentTypesXml.toString('utf8');
  const overrides = text.match(/<Override\b[^>]*>/gi) || [];
  return overrides.some((tag) => readXmlAttribute(tag, 'PartName') === `/${mainPart}`
    && readXmlAttribute(tag, 'ContentType') === expectedContentType);
}

function isExpectedOoxmlPackage(bytes, format) {
  try {
    if (!startsWith(bytes, [0x50, 0x4b, 0x03, 0x04])) return false;
    const eocdOffset = findEndOfCentralDirectory(bytes);
    if (eocdOffset < 0) return false;

    const diskNumber = bytes.readUInt16LE(eocdOffset + 4);
    const centralDirectoryDisk = bytes.readUInt16LE(eocdOffset + 6);
    const entriesOnDisk = bytes.readUInt16LE(eocdOffset + 8);
    const totalEntries = bytes.readUInt16LE(eocdOffset + 10);
    const centralDirectorySize = bytes.readUInt32LE(eocdOffset + 12);
    const centralDirectoryOffset = bytes.readUInt32LE(eocdOffset + 16);
    const commentLength = bytes.readUInt16LE(eocdOffset + 20);

    if (diskNumber !== 0 || centralDirectoryDisk !== 0) return false;
    if (entriesOnDisk !== totalEntries) return false;
    if (totalEntries === 0 || totalEntries > MAX_ZIP_ENTRIES) return false;
    if (totalEntries === 0xffff || centralDirectorySize === 0xffffffff || centralDirectoryOffset === 0xffffffff) return false;
    if (eocdOffset + 22 + commentLength !== bytes.length) return false;
    if (centralDirectoryOffset + centralDirectorySize > eocdOffset) return false;

    const entries = new Map();
    let cursor = centralDirectoryOffset;
    for (let index = 0; index < totalEntries; index += 1) {
      if (cursor + 46 > eocdOffset) return false;
      if (bytes.readUInt32LE(cursor) !== ZIP_CENTRAL_SIGNATURE) return false;

      const flags = bytes.readUInt16LE(cursor + 8);
      const method = bytes.readUInt16LE(cursor + 10);
      const compressedSize = bytes.readUInt32LE(cursor + 20);
      const uncompressedSize = bytes.readUInt32LE(cursor + 24);
      const nameLength = bytes.readUInt16LE(cursor + 28);
      const extraLength = bytes.readUInt16LE(cursor + 30);
      const entryCommentLength = bytes.readUInt16LE(cursor + 32);
      const localOffset = bytes.readUInt32LE(cursor + 42);

      if (flags & ZIP_FLAG_ENCRYPTED) return false;
      if (compressedSize === 0xffffffff || uncompressedSize === 0xffffffff || localOffset === 0xffffffff) return false;

      const nameStart = cursor + 46;
      const nextCursor = nameStart + nameLength + extraLength + entryCommentLength;
      if (nextCursor > eocdOffset) return false;
      const name = bytes.toString('utf8', nameStart, nameStart + nameLength);
      if (!name || name.includes('\0') || entries.has(name)) return false;

      entries.set(name, { method, compressedSize, localOffset });
      cursor = nextCursor;
    }
    if (cursor !== centralDirectoryOffset + centralDirectorySize) return false;

    const contentTypesEntry = entries.get('[Content_Types].xml');
    const mainPartEntry = entries.get(format.mainPart);
    if (!contentTypesEntry || !mainPartEntry) return false;
    if (![0, 8].includes(contentTypesEntry.method) || ![0, 8].includes(mainPartEntry.method)) return false;

    const contentTypesXml = readZipEntry(bytes, contentTypesEntry, MAX_INSPECTED_ENTRY_BYTES);
    if (!contentTypesXml) return false;
    return hasContentTypeOverride(contentTypesXml, format.mainPart, format.contentType);
  } catch {
    return false;
  }
}

/**
 * Validates an uploaded file against SEC-006:
 * - accepted types: PDF, DOCX, PPTX, PNG and JPG only
 * - extension and file signature must agree (exe renamed to .pdf -> 415)
 * - DOCX/PPTX must be bounded, structurally valid OOXML packages
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

  const ooxmlFormat = OOXML_FORMATS[extension];
  if (ooxmlFormat) {
    if (!isExpectedOoxmlPackage(bytes, ooxmlFormat)) throw unsupportedFileType(extension);
    return { extension, mimeType: ooxmlFormat.mimeType };
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
