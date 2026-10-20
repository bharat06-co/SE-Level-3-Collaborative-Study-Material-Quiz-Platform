// Isolated SEC-004 boundary check, NOT the FR-014 comment implementation.
// No .env loading, no production authentication bypass or domain route changes.
const assert = require('node:assert/strict');
const { randomBytes } = require('node:crypto');
const mongoose = require('mongoose');
const request = require('supertest');
const { createApp } = require('../server/src/app');
const { validatePlainText } = require('../server/src/utils/plainText');
const { asyncHandler } = require('../server/src/utils/asyncHandler');
async function runMongoCheck(uri) {
  // Restrict this convenience harness to a local MongoDB server. Never fall
  // back to the application's configured DB or accept a named database URI.
  if (!uri || !/^mongodb:\/\/(127\.0\.0\.1|localhost|\[::1\]):\d+\/?$/.test(uri)) {
    throw new Error('Set SEC004_TEST_MONGODB_URI to mongodb://127.0.0.1:27017 (local server only, no database or credentials).');
  }
  const dbName = `team1_sec004_test_${randomBytes(12).toString('hex')}`;
  const connection = mongoose.createConnection(uri, { dbName, serverSelectionTimeoutMS: 10000 });
  const passed = [];
  try {
    await connection.asPromise();
    const collection = connection.collection('sec004_text_fixture');
    const app = createApp({ registerRoutes(app) {
      app.post('/__sec004/text-fixture', asyncHandler(async (req, res) => {
        const text = validatePlainText(req.body.text, { field: 'text' });
        const doc = { text };
        await collection.insertOne(doc);
        res.status(201).json({ id: String(doc._id), text: doc.text });
      }));
    } });
    for (const payload of [
      { email: { $gt: '' } }, { text: { $where: 'return true' } },
      JSON.parse('{"text":"safe","nested":{"__proto__":{"polluted":true}}}'),
    ]) {
      const res = await request(app).post('/__sec004/text-fixture').send(payload);
      assert.equal(res.status, 400); assert.equal(res.body.error.code, 'VALIDATION_ERROR');
    }
    assert.equal(await collection.countDocuments(), 0);
    passed.push('Unsafe operator/prototype inputs return 400 and produce no database records.');
    const payloads = [
      '<script>window.__sec004_xss = true</script>',
      '<img src=x onerror="window.__sec004_xss=true">',
      '<svg onload="window.__sec004_xss=true"></svg>',
      '<a href="javascript:alert(1)">click</a>',
      '&lt;script&gt;alert(1)&lt;/script&gt;',
    ];
    for (const text of payloads) {
      const res = await request(app).post('/__sec004/text-fixture').send({ text });
      assert.equal(res.status, 201); const stored = await collection.findOne({ _id: new mongoose.Types.ObjectId(res.body.id) });
      assert.equal(stored.text, text); assert.equal(res.body.text, text);
    }
    passed.push('Actual MongoDB persistence and HTTP round-trip preserve hostile markup as literal plain text.');
    for (const text of ['', 'a'.repeat(1001), { $gt: '' }]) {
      assert.equal((await request(app).post('/__sec004/text-fixture').send({ text })).status, 400);
    }
    assert.equal(await collection.countDocuments(), payloads.length);
    passed.push('Invalid plain-text types/lengths create no records.');
    return { passed, payloads, limitations: 'Test-only fixture, not actual FR-014 comments, JWT authentication, or all feature routes. Browser rendering is checked separately.' };
  } finally {
    try { if (connection.readyState === 1) await connection.dropDatabase(); }
    finally { await connection.close(); }
  }
}
if (require.main === module) runMongoCheck(process.env.SEC004_TEST_MONGODB_URI).then(result => {
  result.passed.forEach(text => console.log('PASS: ' + text));
  console.log('LIMITATION: ' + result.limitations);
}).catch(() => { console.error('FAIL: isolated security check failed. Use a running local test MongoDB; never share credentials or application .env values.'); process.exitCode = 1; });
module.exports = { runMongoCheck };
