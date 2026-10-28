const os = require('node:os');
const path = require('node:path');
const fsp = require('node:fs/promises');
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const { MongoMemoryReplSet } = require('mongodb-memory-server');
const { createApp } = require('../server/src/app');
const User = require('../server/src/models/User');
const { Material } = require('../server/src/models/Material');
const { MaterialReport } = require('../server/src/models/MaterialReport');
const Comment = require('../server/src/models/Comment');
const MaterialRevision = require('../server/src/models/MaterialRevision');

const PASSWORD = 'Study1234';
const USERS = {
  owner: { name: 'Fullstack Owner', email: 'fullstack-owner@example.com', role: 'student', contributor: true },
  student: { name: 'Fullstack Student', email: 'fullstack-student@example.com', role: 'student', contributor: false },
  reporterOne: { name: 'Fullstack Reporter One', email: 'fullstack-reporter-one@example.com', role: 'student', contributor: false },
  reporterTwo: { name: 'Fullstack Reporter Two', email: 'fullstack-reporter-two@example.com', role: 'student', contributor: false },
  admin: { name: 'Fullstack Admin', email: 'fullstack-admin@example.com', role: 'admin', contributor: false },
};

let mongo;
let apiServer;
let storageDir;

async function createUser(spec) {
  return User.create({
    name: spec.name,
    email: spec.email,
    passwordHash: await bcrypt.hash(PASSWORD, 10),
    role: spec.role,
    contributor: spec.contributor,
  });
}

async function createMaterial(ownerId, title) {
  const materialId = new mongoose.Types.ObjectId();
  return Material.create({
    _id: materialId,
    title,
    description: 'Full-stack integration material',
    category: 'Notes',
    topic: 'distributed systems',
    tags: ['integration'],
    fileUrl: `/api/v1/materials/${materialId}/file`,
    storageKey: `${materialId}.pdf`,
    mimeType: 'application/pdf',
    sizeBytes: 4,
    ownerId,
    visibility: 'public',
    hidden: false,
  });
}

async function shutdown(code = 0) {
  try {
    if (apiServer) await new Promise((resolve) => apiServer.close(resolve));
    if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
    if (mongo) await mongo.stop();
    if (storageDir) await fsp.rm(storageDir, { recursive: true, force: true });
  } finally {
    process.exit(code);
  }
}

async function main() {
  mongo = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  process.env.NODE_ENV = 'test';
  process.env.MONGODB_URI = mongo.getUri();
  process.env.JWT_ACCESS_SECRET = 'material-fullstack-secret-'.repeat(3);
  process.env.JWT_ACCESS_TTL = '15m';

  await mongoose.connect(mongo.getUri(), { serverSelectionTimeoutMS: 15000 });
  await Promise.all([
    User.init(),
    Material.init(),
    MaterialReport.init(),
    Comment.init(),
    MaterialRevision.init(),
  ]);

  const users = {};
  for (const [key, spec] of Object.entries(USERS)) users[key] = await createUser(spec);

  const materials = {
    library: await createMaterial(users.owner._id, 'Fullstack library material'),
    revision: await createMaterial(users.owner._id, 'Fullstack revision material'),
    moderation: await createMaterial(users.owner._id, 'Fullstack moderation material'),
  };

  storageDir = path.join(os.tmpdir(), `team1-material-fullstack-${Date.now()}`);
  await fsp.mkdir(storageDir, { recursive: true });
  const app = createApp({ databaseIsConnected: () => true, storageDir, origins: ['http://localhost'] });
  await new Promise((resolve) => {
    apiServer = app.listen(0, '127.0.0.1', resolve);
  });

  console.log(`MATERIAL_TEST_READY ${JSON.stringify({
    baseURL: `http://127.0.0.1:${apiServer.address().port}/api/v1`,
    password: PASSWORD,
    users: Object.fromEntries(Object.entries(users).map(([key, user]) => [key, user.email])),
    materials: Object.fromEntries(Object.entries(materials).map(([key, material]) => [key, {
      id: material._id.toString(),
      title: material.title,
    }])),
  })}`);
}

process.on('SIGTERM', () => shutdown(0));
process.on('SIGINT', () => shutdown(0));
main().catch(async (error) => {
  console.error(error);
  await shutdown(1);
});
