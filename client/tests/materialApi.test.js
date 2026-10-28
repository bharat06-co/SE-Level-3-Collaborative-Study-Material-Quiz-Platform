import { http } from '../src/api/http';
import {
  addComment,
  decideReport,
  downloadMaterial,
  materialDownloadName,
  parseDownloadFilename,
  fetchComments,
  fetchReports,
  fetchRevisions,
  getMaterial,
  listMaterials,
  normalizeTags,
  rateMaterial,
  reportMaterial,
  updateMaterial,
  uploadMaterial,
  validateComment,
  validateMaterialFields,
  validateRating,
} from '../src/features/materials/materialApi';

const auth = { headers: { Authorization: 'Bearer token-1' } };

test('normalises tags and validates material metadata inline', () => {
  expect(normalizeTags(' DBMS, sql, dbms ')).toEqual(['dbms', 'sql']);
  expect(validateMaterialFields({ title: 'ab' })).toMatchObject({
    title: expect.any(String),
    description: expect.any(String),
    category: expect.any(String),
    topic: expect.any(String),
    tags: expect.any(String),
  });
  expect(validateMaterialFields({
    title: 'Valid title',
    description: 'Valid description',
    category: 'Notes',
    topic: 'dbms',
    tags: 'a, b',
    visibility: 'shared',
    sharedWith: 'not-an-id',
  })).toMatchObject({ sharedWith: expect.any(String) });
  expect(validateMaterialFields({
    title: 'Valid title', description: 'Valid description', category: 'Notes', topic: 'dbms', tags: 'a',
  }, { requireFile: true, requireRights: true })).toMatchObject({
    file: expect.any(String),
    rightsConfirmed: expect.any(String),
  });
  expect(validateMaterialFields({
    title: 'Valid title', description: 'Valid description', category: 'Notes', topic: 'dbms', tags: 'a',
    rightsConfirmed: true,
  }, { requireFile: true, requireRights: true, file: { size: 21 * 1024 * 1024 } })).toMatchObject({
    file: expect.stringContaining('20 MB'),
  });
  expect(validateMaterialFields({
    title: 'Valid title', description: 'Valid description', category: 'Notes', topic: 'dbms', tags: 'a', rightsConfirmed: true,
  }, { requireFile: true, requireRights: true, file: { size: 10 } })).toEqual({});
});

test('validates comment and rating boundaries', () => {
  expect(validateComment('')).toContain('empty');
  expect(validateComment('x'.repeat(1001))).toContain('1000');
  expect(validateComment('ok')).toBeNull();
  expect(validateRating(0)).toContain('1 to 5');
  expect(validateRating(3.5)).toContain('1 to 5');
  expect(validateRating(5)).toBeNull();
});

test('download filenames preserve the server file extension', async () => {
  expect(parseDownloadFilename('attachment; filename="material-abc.docx"')).toBe('material-abc.docx');
  expect(parseDownloadFilename("attachment; filename*=UTF-8''my%20notes.pptx")).toBe('my notes.pptx');
  expect(materialDownloadName('Operating Systems: Notes', 'material-abc.docx')).toBe('Operating Systems Notes.docx');
  expect(materialDownloadName('Notes', 'material-abc.PPTX')).toBe('Notes.pptx');
  expect(materialDownloadName('Notes', 'no-extension')).toBe('Notes.bin');

  const get = jest.spyOn(http, 'get').mockResolvedValue({
    data: new Blob(['docx']),
    headers: { 'content-disposition': 'attachment; filename="material-abc.docx"' },
  });
  await expect(downloadMaterial('abc', 'token-1')).resolves.toMatchObject({ filename: 'material-abc.docx' });
  expect(get).toHaveBeenCalledWith('/materials/abc/file', {
    ...auth,
    responseType: 'blob',
  });
  get.mockRestore();
});

test('material reads send the bearer token and filters', async () => {
  const get = jest.spyOn(http, 'get').mockResolvedValue({ data: { items: [] } });
  await listMaterials('token-1', { q: 'dbms', page: 2 });
  expect(get).toHaveBeenCalledWith('/materials', { ...auth, params: { q: 'dbms', page: 2 } });
  await getMaterial('m1', 'token-1');
  expect(get).toHaveBeenCalledWith('/materials/m1', auth);
  await fetchRevisions('m1', 'token-1');
  expect(get).toHaveBeenCalledWith('/materials/m1/revisions', auth);
  await fetchComments('m1', 'token-1', 2);
  expect(get).toHaveBeenCalledWith('/materials/m1/comments', { ...auth, params: { page: 2 } });
  await fetchReports('token-1', 'open');
  expect(get).toHaveBeenCalledWith('/admin/reports', { ...auth, params: { status: 'open' } });
  get.mockRestore();
});

test('writes send payloads and require a token', async () => {
  const post = jest.spyOn(http, 'post').mockResolvedValue({ data: { ok: true } });
  const put = jest.spyOn(http, 'put').mockResolvedValue({ data: { ok: true } });
  const patch = jest.spyOn(http, 'patch').mockResolvedValue({ data: { ok: true } });

  await expect(uploadMaterial({}, '')).rejects.toThrow('Sign in');
  await uploadMaterial({
    title: 'T', description: 'D', category: 'C', topic: 'X', tags: 'a,b', file: new File(['x'], 'x.pdf'),
  }, 'token-1');
  const uploadBody = post.mock.calls[0][1];
  expect(uploadBody.get('title')).toBe('T');
  expect(uploadBody.get('tags')).toBe('a,b');
  expect(uploadBody.get('rightsConfirmed')).toBe('true');
  expect(uploadBody.get('file')).toBeTruthy();
  expect(post.mock.calls[0][2]).toEqual(auth);

  await updateMaterial('m1', { title: 'New', visibility: 'shared', sharedWith: 'aaaaaaaaaaaaaaaaaaaaaaaa' }, 'token-1');
  expect(patch).toHaveBeenCalledWith('/materials/m1', {
    title: 'New', visibility: 'shared', sharedWith: ['aaaaaaaaaaaaaaaaaaaaaaaa'],
  }, auth);

  await updateMaterial('m1', { title: 'New', sharedWith: 'aaaaaaaaaaaaaaaaaaaaaaaa,bbbbbbbbbbbbbbbbbbbbbbbb', file: new File(['x'], 'x.pdf') }, 'token-1');
  expect(patch.mock.calls[1][1]).toBeInstanceOf(FormData);
  expect(patch.mock.calls[1][1].getAll('sharedWith')).toEqual(['aaaaaaaaaaaaaaaaaaaaaaaa', 'bbbbbbbbbbbbbbbbbbbbbbbb']);

  await rateMaterial('m1', 4, 'token-1');
  expect(put).toHaveBeenCalledWith('/materials/m1/rating', { value: 4 }, auth);
  await addComment('m1', 'Nice', 'token-1');
  expect(post).toHaveBeenCalledWith('/materials/m1/comments', { content: 'Nice' }, auth);
  await reportMaterial('m1', { reason: 'spam' }, 'token-1');
  expect(post).toHaveBeenCalledWith('/materials/m1/reports', { reason: 'spam' }, auth);
  await reportMaterial('m1', { reason: 'spam', note: 'Why' }, 'token-1');
  expect(post).toHaveBeenCalledWith('/materials/m1/reports', { reason: 'spam', note: 'Why' }, auth);
  await decideReport('r1', 'dismiss', 'token-1');
  expect(patch).toHaveBeenCalledWith('/admin/reports/r1', { decision: 'dismiss' }, auth);

  post.mockRestore();
  put.mockRestore();
  patch.mockRestore();
});
