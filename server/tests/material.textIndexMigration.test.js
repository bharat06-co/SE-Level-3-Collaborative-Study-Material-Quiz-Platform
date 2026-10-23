const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const {
  COLLECTION_NAME,
  OLD_INDEX_NAME,
  NEW_INDEX_NAME,
  NEW_TEXT_KEY,
  MaterialTextIndexMigrationError,
  migrateMaterialTextIndex,
} = require('../src/migrations/materialTextIndex');

jest.setTimeout(120000);

const OLD_TEXT_KEY = { title: 'text', description: 'text' };
const NEW_TEXT_FIELDS = ['description', 'tags', 'title'];

let mongod;
let baseUri;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  baseUri = mongod.getUri();
});

afterAll(async () => {
  if (mongod) await mongod.stop();
});

async function connectionTo(databaseName) {
  const connection = mongoose.createConnection(`${baseUri}${databaseName}`);
  await connection.asPromise();
  return connection;
}

async function textIndexFields(collection, indexName) {
  const indexes = await collection.indexes();
  const index = indexes.find((candidate) => candidate.name === indexName);
  return index ? Object.keys(index.weights).sort() : null;
}

test('upgrades the #59 text index in place, preserves records and reruns safely', async () => {
  const connection = await connectionTo('migration_upgrade');
  try {
    const collection = connection.db.collection(COLLECTION_NAME);
    const firstId = new mongoose.Types.ObjectId();
    const secondId = new mongoose.Types.ObjectId();
    await collection.insertMany([
      { _id: firstId, title: 'ER Diagrams', description: 'Entity relationships', tags: ['dbms'], ownerId: new mongoose.Types.ObjectId() },
      { _id: secondId, title: 'Normal Forms', description: 'Database normalisation', tags: ['dbms', 'normalisation'], ownerId: new mongoose.Types.ObjectId() },
    ]);
    await collection.createIndex(OLD_TEXT_KEY, { name: OLD_INDEX_NAME });

    await expect(collection.createIndex(NEW_TEXT_KEY, { name: NEW_INDEX_NAME }))
      .rejects.toMatchObject({ code: 85, codeName: 'IndexOptionsConflict' });

    const result = await migrateMaterialTextIndex({ connection });
    expect(result).toMatchObject({
      status: 'migrated',
      dropped: OLD_INDEX_NAME,
      created: NEW_INDEX_NAME,
    });

    expect(await textIndexFields(collection, OLD_INDEX_NAME)).toBeNull();
    expect(await textIndexFields(collection, NEW_INDEX_NAME)).toEqual(NEW_TEXT_FIELDS);
    expect(await collection.countDocuments()).toBe(2);
    expect(await collection.findOne({ _id: firstId })).toMatchObject({ title: 'ER Diagrams', tags: ['dbms'] });
    expect(await collection.findOne({ _id: secondId })).toMatchObject({ title: 'Normal Forms', tags: ['dbms', 'normalisation'] });

    const rerun = await migrateMaterialTextIndex({ connection });
    expect(rerun).toMatchObject({ status: 'already-migrated', index: NEW_INDEX_NAME, dropped: null, created: null });
    expect(await textIndexFields(collection, NEW_INDEX_NAME)).toEqual(NEW_TEXT_FIELDS);
    expect(await collection.countDocuments()).toBe(2);
  } finally {
    await connection.close();
  }
});

test('creates the new text index on a fresh database', async () => {
  const connection = await connectionTo('migration_fresh');
  try {
    const result = await migrateMaterialTextIndex({ connection });
    expect(result).toMatchObject({ status: 'created', index: NEW_INDEX_NAME, dropped: null });
    const collection = connection.db.collection(COLLECTION_NAME);
    expect(await textIndexFields(collection, NEW_INDEX_NAME)).toEqual(NEW_TEXT_FIELDS);
  } finally {
    await connection.close();
  }
});

test('refuses to drop an unrelated text index', async () => {
  const connection = await connectionTo('migration_unexpected');
  try {
    const collection = connection.db.collection(COLLECTION_NAME);
    await collection.insertOne({ title: 'Custom search', ownerId: new mongoose.Types.ObjectId() });
    await collection.createIndex({ title: 'text' }, { name: 'title_text' });

    await expect(migrateMaterialTextIndex({ connection }))
      .rejects.toBeInstanceOf(MaterialTextIndexMigrationError);
    expect(await textIndexFields(collection, 'title_text')).toEqual(['title']);
    expect(await textIndexFields(collection, NEW_INDEX_NAME)).toBeNull();
  } finally {
    await connection.close();
  }
});
