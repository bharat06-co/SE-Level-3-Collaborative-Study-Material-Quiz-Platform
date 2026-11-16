const { MongoMemoryReplSet, MongoMemoryServer } = require('mongodb-memory-server');

// Give disposable database processes time to become ready on slower hosts.
// This only controls mongod startup, before any application assertions run.
const launchTimeout = 30_000;

function startTestMongo() {
  return MongoMemoryServer.create({ instance: { launchTimeout } });
}

function startTestReplicaSet(options = {}) {
  return MongoMemoryReplSet.create({
    instanceOpts: [{ launchTimeout }],
    replSet: { count: 1, ...options },
  });
}

module.exports = { startTestMongo, startTestReplicaSet };
