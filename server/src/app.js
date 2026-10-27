
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const pinoHttp = require('pino-http');
const { AppError } = require('./utils/AppError');
const { createLogger } = require('./config/logger');
const { requestId } = require('./middleware/requestId');
const { rejectUnsafeKeys } = require('./middleware/rejectUnsafeKeys');
const { errorHandler } = require('./middleware/errorHandler');
const authRouter = require('./modules/auth/auth.routes');
const { createAuthenticate } = require('./middleware/authenticate');
const { createMaterialsRouter } = require('./modules/materials/material.routes');
const { createMaterialRepository } = require('./modules/materials/material.repository');
const { createMaterialService } = require('./modules/materials/material.service');
const { createStorage } = require('./adapters/storage');
const { createAttemptRouter } = require('./modules/attempts/attempt.routes');
const { createAnalyticsRouter } = require('./modules/analytics/analytics.routes');
const { createQuizRouter } = require('./modules/quizzes/quiz.routes');

function rejectUnconfiguredQuizAuthentication(req, res, next) {
  next(new AppError(401, 'UNAUTHENTICATED', 'Authentication required.'));
}

function createApp({
  origins = ['http://localhost:5173', 'http://127.0.0.1:5173'],
  trustProxyHops = 0,
  databaseIsConnected = () => false,
  logger = createLogger('silent'),
  registerRoutes = () => {},
  storageDir = 'data/uploads',
  authMiddleware = createAuthenticate(),
  quizAuthenticate = rejectUnconfiguredQuizAuthentication,
  attempts = {},
} = {}) {
  const materialRepository = createMaterialRepository();
  const materialService = createMaterialService({
    repository: materialRepository,
    storage: createStorage({ storageDir }),
  });
  const materialsRouter = createMaterialsRouter({
    service: materialService,
    authMiddleware,
  });
  const app = express();

  app.disable('x-powered-by');
  app.set('trust proxy', trustProxyHops);
  app.use(requestId);

  app.use(
    pinoHttp({
      logger,
      genReqId: (req) => req.id,
      serializers: {
        req: (req) => ({
          id: req.id,
          method: req.method,
          url: (req.url || '').split('?')[0],
        }),
        res: (res) => ({ statusCode: res.statusCode }),
        err: (err) => ({ type: err.type }),
      },
    }),
  );

  // Production HTTPS/HSTS is a separate deployment task (SEC-005).
  app.use(helmet({ strictTransportSecurity: false }));

  app.use(
    cors({
      origin(origin, callback) {
        if (!origin || origins.includes(origin)) {
          return callback(null, true);
        }

        return callback(
          new AppError(403, 'FORBIDDEN', 'Origin is not allowed.'),
        );
      },
      credentials: true,
      exposedHeaders: ['X-Request-ID'],
    }),
  );

  app.use(express.json({ limit: '1mb' }));
  app.use(rejectUnsafeKeys);

  app.get('/api/v1/health', (req, res, next) => {
    if (!databaseIsConnected()) {
      return next(
        new AppError(
          503,
          'SERVICE_UNAVAILABLE',
          'Service is not ready.',
          [{ field: 'database', message: 'Not connected.' }],
        ),
      );
    }

    return res.json({
      status: 'ok',
      checks: { process: 'up', database: 'connected' },
    });
  });
  app.use('/api/v1', materialsRouter);

  // Register feature routes before the 404 and error handlers.
  registerRoutes(app);
  app.use('/api/v1/auth', authRouter);
  app.use('/api/v1', createAttemptRouter(attempts));
  app.use('/api/v1', createAnalyticsRouter(attempts));
  app.use('/api/v1/quizzes', createQuizRouter({ authenticate: quizAuthenticate }));

  app.use((req, res, next) =>
    next(new AppError(404, 'NOT_FOUND', 'Resource not found.')),
  );

  app.use(errorHandler(logger));

  return app;
}

module.exports = { createApp };
