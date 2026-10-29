'use strict';

// Disposable browser acceptance fixture. Real Express handlers/auth/Mongoose
// repositories are used; only users/material documents are seeded.
// No production database, app .env or developer Docker volume is ever used.
const os = require('node:os');
const path = require('node:path');
const fs = require('node:fs/promises');
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const { MongoMemoryReplSet } = require('mongodb-memory-server');
const { createApp } = require('../server/src/app');
const User = require('../server/src/models/User');
const RefreshToken = require('../server/src/models/RefreshToken');
const { Material } = require('../server/src/models/Material');
const Comment = require('../server/src/models/Comment');
const { MaterialReport } = require('../server/src/models/MaterialReport');

const PASSWORD = 'Study1234'; // Disposable test password only.
let mongo;
let listener;
let storageDir;
let shuttingDown = false;

async function stop(code = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  try {
    if (listener) await new Promise((resolve) => listener.close(resolve));
    if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
    if (mongo) await mongo.stop();
    if (storageDir) await fs.rm(storageDir, { recursive: true, force: true });
  } finally {
    process.exit(code);
  }
}

async function main() {
  const origin = process.env.SEC004_BROWSER_ORIGIN;
  if (!/^http:\/\/127\.0\.0\.1:[1-9]\d{1,4}$/.test(origin || '')) {
    throw new Error('Refusing browser fixture: SEC004_BROWSER_ORIGIN must be a loopback HTTP origin.');
  }

  // Override any inherited settings before constructing the real app.
  mongo = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  process.env.NODE_ENV = 'test';
  process.env.MONGODB_URI = mongo.getUri();
  process.env.JWT_ACCESS_SECRET = 'sec004-disposable-browser-test-secret-'.repeat(3);
  process.env.JWT_ACCESS_TTL = '15m';
  await mongoose.connect(mongo.getUri(), { serverSelectionTimeoutMS: 15000 });
  await Promise.all([User.init(), RefreshToken.init(), Material.init(), Comment.init(), MaterialReport.init()]);

  const student = await User.create({
    name: 'SEC004 Student', email: 'sec004-student@example.com', role: 'student', contributor: false,
    passwordHash: await bcrypt.hash(PASSWORD, 10),
  });
  const owner = await User.create({
    name: 'SEC004 Owner', email: 'sec004-owner@example.com', role: 'student', contributor: true,
    passwordHash: await bcrypt.hash(PASSWORD, 10),
  });
  const id = new mongoose.Types.ObjectId();
  const material = await Material.create({
    _id: id,
    title: 'SEC004 browser acceptance material',
    description: 'Disposable record for SEC004 only',
    category: 'Notes', topic: 'application security', tags: ['security'],
    fileUrl: `/api/v1/materials/${id}/file`, storageKey: `${id}.pdf`,
    mimeType: 'application/pdf', sizeBytes: 16, ownerId: owner._id,
    visibility: 'public', hidden: false,
  });

  storageDir = await fs.mkdtemp(path.join(os.tmpdir(), 'team1-sec004-'));
  const app = createApp({
    origins: [origin], databaseIsConnected: () => mongoose.connection.readyState === 1,
    storageDir,
  });
  await new Promise((resolve) => { listener = app.listen(0, '127.0.0.1', resolve); });
  process.stdout.write('MATERIAL_TEST_READY ' + JSON.stringify({
    baseURL: `http://127.0.0.1:${listener.address().port}/api/v1`,
    password: PASSWORD,
    users: { student: student.email, owner: owner.email },
    materials: { library: { id: material._id.toString(), title: material.title } },
  }) + '\n');
}

process.on('SIGTERM', () => stop(0));
process.on('SIGINT', () => stop(0));
main().catch(async (error) => {
  console.error('SEC004 disposable fixture failed: ' + error.message);
  await stop(1);
});
