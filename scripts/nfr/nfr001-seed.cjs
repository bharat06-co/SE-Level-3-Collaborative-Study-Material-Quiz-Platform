'use strict';
// Seed ONLY the ephemeral Compose MongoDB used for NFR-001 acceptance.
// This script never opens production/shared MongoDB or deletes existing material.
const assert = require('node:assert/strict');
const mongoose = require('/app/node_modules/mongoose');

const database = 'team1_nfr_acceptance';
const expectedUri = `mongodb://mongo:27017/${database}?replicaSet=rs0`;
if (process.env.MONGODB_URI !== expectedUri || process.env.NFR_API_URL !== 'http://api:3000') {
  throw new Error('Refusing to seed outside the isolated NFR Compose database.');
}

async function main() {
  const connection = await mongoose.createConnection(expectedUri, {
    serverSelectionTimeoutMS: 20000,
  }).asPromise();
  try {
    const markers = connection.db.collection('nfr_acceptance_markers');
    const durability = await markers.findOne({ _id: 'nfr007' });
    assert.ok(durability?.studentId, 'NFR-007 prepare/verify must run before STP seed');
    assert.equal(await markers.findOne({ _id: 'nfr001-stp' }), null, 'STP dataset already seeded');
    const materials = connection.db.collection('studymaterials');
    const now = new Date();
    const items = Array.from({ length: 40 }, (_, i) => {
      const databaseTopic = i < 24;
      const title = databaseTopic ? `Database study material ${i + 1}` : `Operating systems study material ${i + 1}`;
      const _id = new mongoose.Types.ObjectId();
      return {
        _id, title,
        description: databaseTopic
          ? 'Database normalization, relational algebra and indexing study notes'
          : 'Operating systems scheduling, memory and process study notes',
        category: 'course-notes',
        topic: databaseTopic ? 'dbms' : 'os',
        tags: databaseTopic ? ['database', 'sql', 'notes'] : ['operating', 'systems', 'notes'],
        fileUrl: `/api/v1/materials/${_id}/file`,
        storageKey: `nfr001-stp-fixture-${i}.pdf`,
        mimeType: 'application/pdf', sizeBytes: 128,
        ownerId: durability.studentId,
        visibility: 'public', sharedWith: [], hidden: false,
        createdAt: now, updatedAt: now, __v: 0,
      };
    });
    const result = await materials.insertMany(items, { ordered: true });
    assert.equal(result.insertedCount, 40);
    await markers.insertOne({ _id: 'nfr001-stp', materialCount: 40, seededAt: now });
    console.log(JSON.stringify({ status: 'seeded', database, materials: 40,
      searchableDatabaseMaterials: 24, firstMaterialId: String(items[0]._id),
      note: 'Metadata-only public fixtures. File-download bytes are not part of this test.' }));
  } finally {
    await connection.close();
  }
}
main().catch((error) => {
  console.error(`FAIL NFR-001 STP seed: ${error.message}`);
  process.exitCode = 1;
});
