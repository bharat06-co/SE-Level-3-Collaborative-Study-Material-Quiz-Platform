const COLLECTION_NAME = 'studymaterials';
const OLD_INDEX_NAME = 'title_text_description_text';
const NEW_INDEX_NAME = 'title_text_description_text_tags_text';
const OLD_TEXT_KEY = { title: 'text', description: 'text' };
const NEW_TEXT_KEY = { title: 'text', description: 'text', tags: 'text' };
const NEW_TEXT_FIELDS = ['title', 'description', 'tags'];

class MaterialTextIndexMigrationError extends Error {}

function hasFields(index, expectedFields) {
  const actual = Object.keys(index.weights || {}).sort();
  const expected = [...expectedFields].sort();
  return actual.length === expected.length && actual.every((field, position) => field === expected[position]);
}

async function listIndexes(collection) {
  try {
    return await collection.indexes();
  } catch (error) {
    if (error.code === 26 || error.codeName === 'NamespaceNotFound') return [];
    throw error;
  }
}

/**
 * Idempotently upgrades the study-material text index from the #59 shape
 * (title, description) to the #60 shape (title, description, tags).
 *
 * MongoDB permits only one text index per collection, so the old index must be
 * dropped before the replacement can be created. This function only touches
 * that known text index; it never drops the collection or syncs other indexes.
 */
async function migrateMaterialTextIndex({ connection } = {}) {
  if (!connection || !connection.db) {
    throw new MaterialTextIndexMigrationError('A connected MongoDB connection is required.');
  }

  const collection = connection.db.collection(COLLECTION_NAME);
  const indexes = await listIndexes(collection);
  const textIndexes = indexes.filter((index) => index.weights && Object.keys(index.weights).length > 0);
  const target = textIndexes.find((index) => hasFields(index, NEW_TEXT_FIELDS));
  if (target) {
    return { status: 'already-migrated', index: target.name, dropped: null, created: null };
  }

  const old = textIndexes.find((index) => index.name === OLD_INDEX_NAME || hasFields(index, ['title', 'description']));
  const unexpected = textIndexes.filter((index) => index.name !== old?.name);
  if (unexpected.length > 0) {
    throw new MaterialTextIndexMigrationError(`Unexpected text index '${unexpected[0].name}' exists on ${COLLECTION_NAME}; reconcile it manually instead of dropping it automatically.`);
  }

  if (old) await collection.dropIndex(old.name);

  try {
    await collection.createIndex(NEW_TEXT_KEY, { name: NEW_INDEX_NAME });
  } catch (error) {
    if (old) await collection.createIndex(OLD_TEXT_KEY, { name: old.name }).catch(() => {});
    throw error;
  }

  return {
    status: old ? 'migrated' : 'created',
    index: NEW_INDEX_NAME,
    dropped: old ? old.name : null,
    created: NEW_INDEX_NAME,
  };
}

module.exports = {
  COLLECTION_NAME,
  OLD_INDEX_NAME,
  NEW_INDEX_NAME,
  NEW_TEXT_KEY,
  MaterialTextIndexMigrationError,
  migrateMaterialTextIndex,
};
