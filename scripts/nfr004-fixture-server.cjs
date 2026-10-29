'use strict';

// Disposable NFR-004 usability fixture. Real Express routes, JWT auth and
// MongoDB-backed repositories are used; only users, one DBMS quiz and one
// public material are seeded. No project .env or shared database is read.
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const { MongoMemoryReplSet } = require('mongodb-memory-server');
const { createApp } = require('../server/src/app');
const { createAuthenticatedFeatures } = require('../server/src/config/features');
const User = require('../server/src/models/User');
const RefreshToken = require('../server/src/models/RefreshToken');
const { Material } = require('../server/src/models/Material');
const { Quiz } = require('../server/src/modules/quizzes/quiz.model');

const DEFAULT_PASSWORD = 'Study1234';
const participantNames = [
  ['P1', 'NFR004 Participant One'],
  ['P2', 'NFR004 Participant Two'],
  ['P3', 'NFR004 Participant Three'],
  ['P4', 'NFR004 Participant Four'],
  ['P5', 'NFR004 Participant Five'],
];

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

async function seed() {
  const origin = process.env.NFR004_FRONTEND_ORIGIN;
  if (!/^http:\/\/127\.0\.0\.1:[1-9]\d{1,4}$/.test(origin || '')) {
    throw new Error('Refusing browser fixture: NFR004_FRONTEND_ORIGIN must be a loopback HTTP origin.');
  }
  const password = process.env.NFR004_PASSWORD || DEFAULT_PASSWORD;
  if (password.length < 8 || !/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
    throw new Error('NFR004_PASSWORD must be at least 8 characters and contain a letter and a digit.');
  }

  mongo = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  process.env.NODE_ENV = 'test';
  process.env.MONGODB_URI = mongo.getUri();
  process.env.JWT_ACCESS_SECRET = 'nfr004-disposable-browser-test-secret-'.repeat(3);
  process.env.JWT_ACCESS_TTL = '15m';
  process.env.CORS_ORIGINS = origin;
  process.env.LOG_LEVEL = 'silent';

  await mongoose.connect(mongo.getUri(), { serverSelectionTimeoutMS: 15000 });
  await Promise.all([User.init(), RefreshToken.init(), Material.init(), Quiz.init()]);

  const passwordHash = await bcrypt.hash(password, 10);
  const participants = [];
  for (const [id, name] of participantNames) {
    const email = `nfr004-${id.toLowerCase()}@example.com`;
    const user = await User.create({
      name, email, role: 'student', contributor: false, passwordHash,
    });
    participants.push({ id, name, email: user.email, userId: user._id.toString() });
  }

  const author = await User.create({
    name: 'NFR004 Quiz Author',
    email: 'nfr004-author@example.com',
    role: 'student',
    contributor: true,
    passwordHash,
  });
  const admin = await User.create({
    name: 'NFR004 Administrator',
    email: 'nfr004-admin@example.com',
    role: 'admin',
    contributor: false,
    passwordHash,
  });

  const quizId = new mongoose.Types.ObjectId();
  const quiz = await Quiz.create({
    _id: quizId,
    title: 'DBMS Fundamentals',
    topic: 'dbms',
    authorId: author._id,
    status: 'published',
    allowRetake: true,
    questions: [
      {
        _id: new mongoose.Types.ObjectId(),
        text: 'Which normal form removes partial dependencies on a composite candidate key?',
        type: 'mcq',
        options: ['First normal form (1NF)', 'Second normal form (2NF)', 'Third normal form (3NF)', 'Boyce-Codd normal form (BCNF)'],
        answerKey: 1,
      },
      {
        _id: new mongoose.Types.ObjectId(),
        text: 'A primary key may contain NULL values.',
        type: 'true_false',
        answerKey: false,
      },
      {
        _id: new mongoose.Types.ObjectId(),
        text: 'Which SQL command removes all rows but keeps the table definition?',
        type: 'mcq',
        options: ['DELETE', 'DROP TABLE', 'TRUNCATE TABLE', 'ALTER TABLE'],
        answerKey: 2,
      },
    ],
  });

  let material = null;
  if (process.env.NFR004_INCLUDE_MATERIAL !== '0') {
    const materialId = new mongoose.Types.ObjectId();
    const storageKey = `${materialId}.pdf`;
    const materialTitle = 'DBMS Normalisation Notes';
    storageDir = await fs.mkdtemp(path.join(os.tmpdir(), 'team1-nfr004-'));
    await fs.writeFile(path.join(storageDir, storageKey), '%PDF-1.4\nNFR-004 disposable fixture\n%%EOF\n');
    const document = await Material.create({
      _id: materialId,
      title: materialTitle,
      description: 'Disposable public material used only for NFR-004 form validation.',
      category: 'Notes',
      topic: 'dbms',
      tags: ['dbms', 'normalisation'],
      fileUrl: `/api/v1/materials/${materialId}/file`,
      storageKey,
      mimeType: 'application/pdf',
      sizeBytes: 54,
      ownerId: author._id,
      visibility: 'public',
      hidden: false,
    });
    material = {
      id: document._id.toString(),
      title: materialTitle,
      url: `${origin}/materials/${document._id.toString()}`,
    };
  }

  const app = createApp({
    origins: [origin],
    databaseIsConnected: () => mongoose.connection.readyState === 1,
    storageDir,
    ...createAuthenticatedFeatures(),
  });

  await new Promise((resolve) => {
    listener = app.listen(0, '127.0.0.1', resolve);
  });
  const apiOrigin = `http://127.0.0.1:${listener.address().port}`;

  process.stdout.write(`NFR004_READY ${JSON.stringify({
    origin,
    baseURL: `${apiOrigin}/api/v1`,
    password,
    participants,
    author: { name: author.name, email: author.email, userId: author._id.toString() },
    admin: { name: admin.name, email: admin.email, userId: admin._id.toString() },
    quiz: {
      id: quiz._id.toString(),
      title: quiz.title,
      url: `${origin}/quizzes/${quiz._id.toString()}/attempt`,
    },
    material,
  })}\n`);
}

process.on('SIGTERM', () => stop(0));
process.on('SIGINT', () => stop(0));
seed().catch(async (error) => {
  console.error(`NFR-004 disposable fixture failed: ${error.message}`);
  await stop(1);
});
