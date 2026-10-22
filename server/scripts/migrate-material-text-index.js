require('dotenv').config();
const mongoose = require('mongoose');
const { readEnv } = require('../src/config/env');
const { migrateMaterialTextIndex } = require('../src/migrations/materialTextIndex');

async function main() {
  const config = readEnv();
  await mongoose.connect(config.MONGODB_URI, { serverSelectionTimeoutMS: 10000 });
  try {
    const result = await migrateMaterialTextIndex({ connection: mongoose.connection });
    console.log(`Material text index migration: ${result.status} (${result.index}).`);
  } finally {
    await mongoose.disconnect();
  }
}

if (require.main === module) {
  main().catch(async (error) => {
    console.error(`Material text index migration failed: ${error.message}`);
    await mongoose.disconnect().catch(() => {});
    process.exitCode = 1;
  });
}

module.exports = { main };
