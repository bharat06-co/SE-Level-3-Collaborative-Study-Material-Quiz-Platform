const { validateFile, MAX_FILE_SIZE_BYTES, extractExtension } = require('../src/modules/materials/fileValidation');
const { createGenericZip, createOoxmlPackage, createZip } = require('./helpers/zipFixture');

const PDF_HEADER = [0x25, 0x50, 0x44, 0x46];
const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const JPG_HEADER = [0xff, 0xd8, 0xff];
const ZIP_HEADER = [0x50, 0x4b, 0x03, 0x04];

const PNG_1X1 = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAFgwJ/lK3iWQAAAABJRU5ErkJggg==', 'base64');
const DOCX_PACKAGE = createOoxmlPackage('docx');
const PPTX_PACKAGE = createOoxmlPackage('pptx');

function bytes(...pattern) {
  return Buffer.from(pattern);
}

describe('SEC-006 file validation (unit)', () => {
  test.each([
    ['report.pdf', bytes(...PDF_HEADER)],
    ['notes.docx', DOCX_PACKAGE],
    ['slides.pptx', PPTX_PACKAGE],
    ['stored.docx', createOoxmlPackage('docx', { compress: false })],
    ['figure.png', PNG_1X1],
    ['signature-only.png', bytes(...PNG_SIGNATURE)],
    ['photo.jpg', bytes(...JPG_HEADER)],
  ])('accepts matching extension and signature: %s', (originalName, content) => {
    const result = validateFile({ originalName, size: content.length, bytes: content });
    expect(result).toMatchObject({ extension: originalName.split('.')[1] });
    expect(typeof result.mimeType).toBe('string');
  });

  test.each([
    ['executable.pdf', bytes(0x4d, 0x5a, 0x00, 0x00)],
    ['malware.PDF', bytes(0x4d, 0x5a, 0x00, 0x00)],
    ['wrong-ext.svg', bytes(0x3c, 0x73, 0x76, 0x67)],
    ['no-ext', bytes(...PDF_HEADER)],
    ['trailing-dot.pdf.', bytes(...PDF_HEADER)],
  ])('rejects signature mismatches and unsupported types: %s', (originalName, content) => {
    expect(() => validateFile({ originalName, size: content.length, bytes: content }))
      .toThrow(expect.objectContaining({ statusCode: 415, code: 'UNSUPPORTED_FILE_TYPE' }));
  });

  test('jpg named png is rejected (signature priority)', () => {
    expect(() => validateFile({ originalName: 'image.png', size: 9, bytes: bytes(...JPG_HEADER, 0x01) }))
      .toThrow(expect.objectContaining({ statusCode: 415 }));
  });

  test('a truncated four-byte PNG prefix is rejected', () => {
    expect(() => validateFile({ originalName: 'image.png', size: 8, bytes: bytes(0x89, 0x50, 0x4e, 0x47, 0x00, 0x00, 0x00, 0x00) }))
      .toThrow(expect.objectContaining({ statusCode: 415, code: 'UNSUPPORTED_FILE_TYPE' }));
  });

  test('a PNG with an invalid trailing signature is rejected', () => {
    expect(() => validateFile({ originalName: 'image.png', size: 12, bytes: bytes(0x89, 0x50, 0x4e, 0x47, 0x00, 0x00, 0x00, 0x00, 0x01, 0x02, 0x03, 0x04) }))
      .toThrow(expect.objectContaining({ statusCode: 415, code: 'UNSUPPORTED_FILE_TYPE' }));
  });

  describe('OOXML package inspection', () => {
    test.each([
      ['arbitrary.docx', createGenericZip(), 'docx'],
      ['arbitrary.pptx', createGenericZip(), 'pptx'],
      ['renamed.docx', PPTX_PACKAGE, 'docx'],
      ['renamed.pptx', DOCX_PACKAGE, 'pptx'],
    ])('rejects a ZIP that is not the declared Office format: %s', (originalName, content) => {
      expect(() => validateFile({ originalName, size: content.length, bytes: content }))
        .toThrow(expect.objectContaining({ statusCode: 415, code: 'UNSUPPORTED_FILE_TYPE' }));
    });

    test('rejects a truncated DOCX package', () => {
      const truncated = DOCX_PACKAGE.subarray(0, DOCX_PACKAGE.length - 12);
      expect(() => validateFile({ originalName: 'broken.docx', size: truncated.length, bytes: truncated }))
        .toThrow(expect.objectContaining({ statusCode: 415 }));
    });

    test('rejects a DOCX package with no content-types declaration', () => {
      const content = createZip([{ name: 'word/document.xml', content: '<w:document/>' }]);
      expect(() => validateFile({ originalName: 'broken.docx', size: content.length, bytes: content }))
        .toThrow(expect.objectContaining({ statusCode: 415 }));
    });

    test('rejects a DOCX package with the wrong main-part content type', () => {
      const contentTypes = '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/></Types>';
      const content = createZip([
        { name: '[Content_Types].xml', content: contentTypes },
        { name: 'word/document.xml', content: '<w:document/>' },
      ]);
      expect(() => validateFile({ originalName: 'broken.docx', size: content.length, bytes: content }))
        .toThrow(expect.objectContaining({ statusCode: 415 }));
    });

    test('rejects a four-byte ZIP signature with no archive structure', () => {
      const content = bytes(...ZIP_HEADER);
      expect(() => validateFile({ originalName: 'fake.docx', size: content.length, bytes: content }))
        .toThrow(expect.objectContaining({ statusCode: 415 }));
    });
  });

  test(`accepts a file of exactly ${MAX_FILE_SIZE_BYTES} bytes`, () => {
    const buffer = Buffer.alloc(MAX_FILE_SIZE_BYTES, 0x33, 'latin1');
    bytes(...PDF_HEADER).copy(buffer, 0);
    expect(() => validateFile({ originalName: 'big.pdf', size: MAX_FILE_SIZE_BYTES, bytes: buffer })).not.toThrow();
  });

  test(`rejects a file of exactly ${MAX_FILE_SIZE_BYTES + 1} bytes`, () => {
    const buffer = Buffer.alloc(MAX_FILE_SIZE_BYTES + 1, 0x33, 'latin1');
    Buffer.from(PDF_HEADER).copy(buffer, 0);
    expect(() => validateFile({ originalName: 'big.pdf', size: MAX_FILE_SIZE_BYTES + 1, bytes: buffer }))
      .toThrow(expect.objectContaining({ statusCode: 413, code: 'FILE_TOO_LARGE' }));
  });

  test('empty or missing content is rejected', () => {
    expect(() => validateFile({ originalName: 'x.pdf', size: 0, bytes: Buffer.alloc(0) }))
      .toThrow(expect.objectContaining({ statusCode: 415 }));
    expect(() => validateFile({ originalName: 'x.pdf', size: 5, bytes: undefined }))
      .toThrow(expect.objectContaining({ statusCode: 415 }));
  });

  describe('extractExtension', () => {
    test.each([
      ['a.b.c.pdf', 'pdf'],
      ['A.PDF', 'pdf'],
      ['noext', ''],
      ['.hidden', ''],
      ['endsdot.', ''],
      ['', ''],
      [undefined, ''],
    ])('.name=(%p) -> %p', (input, expected) => {
      expect(extractExtension(input)).toBe(expected);
    });
  });
});
