const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const pinoHttp = require('pino-http');
const { AppError } = require('./utils/AppError');
const { createLogger } = require('./config/logger');
const { requestId } = require('./middleware/requestId');
const { rejectUnsafeKeys } = require('./middleware/rejectUnsafeKeys');
const { errorHandler } = require('./middleware/errorHandler');

function createApp({ origins = ['http://localhost:5173', 'http://127.0.0.1:5173'], trustProxyHops = 0, databaseIsConnected = () => false, logger = createLogger('silent'), registerRoutes = () => {} } = {}) {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', trustProxyHops);
  app.use(requestId);
  app.use(pinoHttp({ logger, genReqId: (req) => req.id, serializers: {
    req: (req) => ({ id: req.id, method: req.method, url: (req.url || '').split('?')[0] }),
    res: (res) => ({ statusCode: res.statusCode }),
    err: (err) => ({ type: err.type }),
  } }));
  // Production HTTPS/HSTS is a separate deployment task (SEC-005), not local HTTP scaffolding.
  app.use(helmet({ strictTransportSecurity: false }));
  app.use(cors({ origin(origin, callback) {
    if (!origin || origins.includes(origin)) return callback(null, true);
    return callback(new AppError(403, 'FORBIDDEN', 'Origin is not allowed.'));
  }, credentials: true, exposedHeaders: ['X-Request-ID'] }));
  app.use(express.json({ limit: '1mb' }));
  app.use(rejectUnsafeKeys);
  app.get('/api/v1/health', (req, res, next) => {
    if (!databaseIsConnected()) return next(new AppError(503, 'SERVICE_UNAVAILABLE', 'Service is not ready.', [{ field: 'database', message: 'Not connected.' }]));
    res.json({ status: 'ok', checks: { process: 'up', database: 'connected' } });
  });
  // Feature owners mount real routers here. No fake auth or placeholder success endpoints.
  registerRoutes(app);
  app.use((req, res, next) => next(new AppError(404, 'NOT_FOUND', 'Resource not found.')));
  app.use(errorHandler(logger));
  return app;
}
module.exports = { createApp };
