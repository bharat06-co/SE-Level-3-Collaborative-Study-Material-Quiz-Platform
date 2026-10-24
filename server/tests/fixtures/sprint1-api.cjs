// Independent API process for the disposable Sprint 1 regression database.
const mongoose = require('mongoose');
const { createApp } = require('../../src/app');
const { createAuthenticatedFeatures } = require('../../src/config/features');

async function start() {
  await mongoose.connect(process.env.MONGODB_URI);
  const app = createApp({
    storageDir: process.env.STORAGE_DIR,
    ...createAuthenticatedFeatures(),
  });
  const server = app.listen(0, '127.0.0.1', () => {
    process.send({ port: server.address().port });
  });
  process.once('message', () => {
    server.close(async () => {
      await mongoose.disconnect();
      process.disconnect();
    });
  });
}

start().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
