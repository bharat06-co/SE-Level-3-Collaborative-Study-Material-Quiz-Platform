require('dotenv').config();
const { readEnv } = require('./config/env');
const { createLogger } = require('./config/logger');
const { connectDatabase, disconnectDatabase, databaseIsConnected } = require('./config/database');
const { createApp } = require('./app');
const { createAuthenticate } = require('./middleware/authenticate');

async function start() {
  const config = readEnv();
  const logger = createLogger(config.LOG_LEVEL);
  // Fail startup if MongoDB is unavailable; never advertise false readiness.
  await connectDatabase(config.MONGODB_URI);
  const app = createApp({
    origins: config.origins,
    trustProxyHops: config.TRUST_PROXY_HOPS,
    databaseIsConnected,
    logger,
    quizAuthenticate: createAuthenticate(),
  });
  const server = app.listen(config.PORT, '0.0.0.0', () => logger.info({ port: config.PORT }, 'API started'));
  server.on('error', async () => { logger.error('API listen failed'); await disconnectDatabase(); process.exitCode = 1; });
  let stopping = false;
  async function shutdown() {
    if (stopping) return;
    stopping = true;
    const timeout = setTimeout(() => process.exit(1), 10000).unref();
    server.close(async () => {
      try { await disconnectDatabase(); clearTimeout(timeout); process.exitCode = 0; }
      catch { process.exitCode = 1; }
    });
  }
  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);
}
if (require.main === module) start().catch(() => { console.error('API startup failed. Check configuration and database availability; secret values are not printed.'); process.exitCode = 1; });
module.exports = { start };
