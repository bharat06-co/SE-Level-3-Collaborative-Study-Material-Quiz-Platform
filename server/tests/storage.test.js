const os = require('node:os');
const path = require('node:path');
const { createStorage, keyToPath } = require('../src/adapters/storage');

describe('Storage adapter (C-STO)', () => {
  let storageDir;
  let storage;

  beforeEach(() => {
    storageDir = path.join(os.tmpdir(), `t1-storage-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    storage = createStorage({ storageDir });
  });

  test('put/get/remove round trip persists bytes on the volume', async () => {
    const bytes = Buffer.from([0x25, 0x50, 0x44, 0x46, 0x01, 0x02]);
    await storage.put('abc123.pdf', bytes);
    const stored = await storage.get('abc123.pdf');
    expect(stored.equals(bytes)).toBe(true);
    await storage.remove('abc123.pdf');
    await expect(storage.get('abc123.pdf')).rejects.toThrow();
  });

  test('keys are sanitised against traversal and invalid forms', () => {
    expect(() => keyToPath(storageDir, '../escape.pdf')).toThrow('Invalid storage key.');
    expect(() => keyToPath(storageDir, 'sub/dir/file.pdf')).toThrow('Invalid storage key.');
    expect(() => keyToPath(storageDir, '')).toThrow('Invalid storage key.');
    expect(() => keyToPath(storageDir, 42)).toThrow('Invalid storage key.');
    const safe = keyToPath(storageDir, 'abc123.pdf');
    expect(safe.startsWith(path.resolve(storageDir))).toBe(true);
  });

  test('remove on missing key is idempotent', async () => {
    await expect(storage.remove('never-existed.pdf')).resolves.toBeUndefined();
  });
});
