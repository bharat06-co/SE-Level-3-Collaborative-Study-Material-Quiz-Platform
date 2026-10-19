const { validateFile, MAX_FILE_SIZE_BYTES, extractExtension } = require('../src/modules/materials/fileValidation');

const PDF_HEADER = [0x25, 0x50, 0x44, 0x46];
const PNG_HEADER = [0x89, 0x50, 0x4e, 0x47];
const JPG_HEADER = [0xff, 0xd8, 0xff];
const ZIP_HEADER = [0x50, 0x4b, 0x03, 0x04];

function bytes(...pattern) {
  return Buffer.from(pattern);
}

describe('SEC-006 file validation (unit)', () => {
  test.each([
    ['report.pdf', bytes(...PDF_HEADER)],
    ['notes.docx', bytes(...ZIP_HEADER)],
    ['slides.pptx', bytes(...ZIP_HEADER)],
    ['figure.png', bytes(...PNG_HEADER)],
    ['photo.jpg', bytes(...JPG_HEADER)],
  ])('accepts matching extension and signature: %s', (originalName, content) => {
    const result = validateFile({ originalName, size: 1024, bytes: content });
    expect(result).toMatchObject({ extension: originalName.split('.')[1] });
    expect(typeof result.mimeType).toBe('string');
  });

  test.each([
    ['executable.pdf', bytes(0x4d, 0x5a, 0x00, 0x00)],
    ['malware.PDF', bytes(0x4d, 0x5a, 0x00, 0x00)],
    ['wrong-ext.svg', bytes(0x3c, 0x73, 0x76, 0x67)],
    ['no-ext', bytes(...PDF_HEADER)],
    ['trailing-dot.pdf.', bytes(...PDF_HEADER)],
  ])('rejects digit-signature mismatches and unsupported types: %s', (originalName, content) => {
    expect(() => validateFile({ originalName, size: 1024, bytes: content }))
      .toThrow(expect.objectContaining({ statusCode: 415, code: 'UNSUPPORTED_FILE_TYPE' }));
  });

  test('jpg named png is rejected (signature priority)', () => {
    expect(() => validateFile({ originalName: 'image.png', size: 9, bytes: bytes(...JPG_HEADER, 0x01) }))
      .toThrow(expect.objectContaining({ statusCode: 415 }));
  });

  test(`accepts a file of exactly ${MAX_FILE_SIZE_BYTES} bytes`, () => {
    const buffer = Buffer.alloc(MAX_FILE_SIZE_BYTES, 0x33, 'latin1');
    bytes(...PDF_HEADER).copy(buffer, 0);
    expect(() => validateFile({ originalName: 'big.pdf', size: MAX_FILE_SIZE_BYTES, bytes: buffer })).not.toThrow();
  });

  test(`accepts a file of exactly ${MAX_FILE_SIZE_BYTES + 1} bytes`, () => {
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
