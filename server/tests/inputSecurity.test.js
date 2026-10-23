const request = require('supertest');
const { createApp } = require('../src/app');
const { rejectUnsafeKeys, assertSafeInput, hasUnsafeKeys, MAX_INPUT_DEPTH } = require('../src/middleware/rejectUnsafeKeys');
const { validatePlainText } = require('../src/utils/plainText');
const { asyncHandler } = require('../src/utils/asyncHandler');
function appWithBoundary() {
  return createApp({ registerRoutes(app) {
    app.post('/test/input', (req, res) => res.json({ value: req.body }));
    app.get('/test/input', (req, res) => res.json({ value: req.query }));
    // Simulates a parser that runs after the global JSON guard (e.g. Multer).
    app.post('/test/parsed', (req, res, next) => { req.body = { nested: { $gt: '' } }; next(); }, rejectUnsafeKeys, (req, res) => res.sendStatus(201));
    app.post('/test/comment', asyncHandler(async (req, res) => {
      res.status(201).json({ text: validatePlainText(req.body.text, { field: 'text' }) });
    }));
  } });
}
describe('SEC-004 shared input boundary', () => {
  const app = appWithBoundary();
  test.each([
    '{"email":{"$gt":""}}', '{"items":[{"$where":"return true"}]}',
    '{"nested":{"user.name":"x"}}', '{"__proto__":{"polluted":true}}',
    '{"nested":{"constructor":{"prototype":{"polluted":true}}}}',
  ])('rejects unsafe JSON without executing a handler: %s', async raw => {
    const res = await request(app).post('/test/input').set('Content-Type', 'application/json').send(raw);
    expect(res.status).toBe(400); expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect({}.polluted).toBeUndefined();
  });
  test.each(['email%5B%24gt%5D=', '%24where=x', 'name.first=x', 'nested%5Ba.b%5D=x'])('rejects decoded query operators/dotted keys: %s', async query => {
    expect((await request(app).get('/test/input?' + query)).status).toBe(400);
  });
  test('can be mounted again after a route-specific parser', async () => {
    expect((await request(app).post('/test/parsed').send({})).status).toBe(400);
  });
  test('bounds traversal and does not overflow the stack', async () => {
    let deep = 'leaf'; for (let i = 0; i < 5000; i++) deep = { nested: deep };
    expect(hasUnsafeKeys(deep)).toBe(true);
    let httpDeep = 'leaf'; for (let i = 0; i < MAX_INPUT_DEPTH + 2; i++) httpDeep = { nested: httpDeep };
    expect((await request(app).post('/test/input').send(httpDeep)).status).toBe(400);
    expect(hasUnsafeKeys(Array.from({ length: 20001 }, () => 1))).toBe(true);
  });
  test('preserves legitimate strings without interpreting operators or HTML', async () => {
    const body = { name: "O'Reilly", text: '<script>alert("$gt")</script>', price: '$5.00', values: [0, false, null] };
    const res = await request(app).post('/test/input').send(body);
    expect(res.status).toBe(200); expect(res.body.value).toEqual(body);
    expect(assertSafeInput(null)).toBeNull(); expect(hasUnsafeKeys(undefined)).toBe(false);
  });
  test('validates comment text without HTML-encoding the stored value', async () => {
    const text = '<script>window.pwned = true</script><img src=x onerror=alert(1)>';
    const res = await request(app).post('/test/comment').send({ text });
    expect(res.status).toBe(201); expect(res.body.text).toBe(text);
    expect(validatePlainText('  hello  ')).toBe('hello');
    expect(validatePlainText('a'.repeat(1000))).toHaveLength(1000);
  });
  test.each([null, {}, 42, '', '   ', 'a'.repeat(1001), 'null\0byte'])('rejects invalid plain text', value => {
    expect(() => validatePlainText(value)).toThrow('Invalid plain-text input.');
  });
});
