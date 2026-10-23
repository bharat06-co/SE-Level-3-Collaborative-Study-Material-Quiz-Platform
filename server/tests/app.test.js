const request = require('supertest');
const { createApp } = require('../src/app');
const { AppError } = require('../src/utils/AppError');
const { asyncHandler } = require('../src/utils/asyncHandler');
const { hasUnsafeKeys } = require('../src/middleware/rejectUnsafeKeys');
const { readEnv } = require('../src/config/env');
const { createLogger } = require('../src/config/logger');

const logger = { error: jest.fn() };
const validTestSecret = 'a'.repeat(64);

function validTestEnv(overrides = {}) {
  return {
    MONGODB_URI: 'mongodb://127.0.0.1:27017/test',
    JWT_ACCESS_SECRET: validTestSecret,
    ...overrides,
  };
}

function appWithRoutes() {
  return createApp({
    databaseIsConnected: () => true,
    registerRoutes(app) {
      app.post('/api/v1/echo', (req, res) => res.json(req.body));

      app.get(
        '/api/v1/known-error',
        asyncHandler(() => {
          throw new AppError(409, 'EMAIL_TAKEN', 'Email already exists.', [
            { field: 'email', message: 'Already used.' },
          ]);
        }),
      );

      app.get(
        '/api/v1/unknown-error',
        asyncHandler(() => {
          throw new Error('secret-value-must-not-leak');
        }),
      );
    },
  });
}

describe('Foundation HTTP checks (not completed feature/STP cases)', () => {
  test('health checks process and injected DB connectivity', async () => {
    const response = await request(appWithRoutes()).get('/api/v1/health');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      status: 'ok',
      checks: { process: 'up', database: 'connected' },
    });
    expect(response.headers['x-request-id']).toMatch(/^[a-f0-9-]{36}$/);
    expect(response.headers['x-powered-by']).toBeUndefined();
    expect(response.headers['x-content-type-options']).toBe('nosniff');
    expect(response.headers['strict-transport-security']).toBeUndefined();
  });

  test('health is 503 when DB is disconnected', async () => {
    const response = await request(createApp()).get('/api/v1/health');

    expect(response.status).toBe(503);
    expect(response.body.error.code).toBe('SERVICE_UNAVAILABLE');
  });

  test('unknown routes share the documented error envelope', async () => {
    const response = await request(createApp()).get('/api/v1/not-implemented');

    expect(response.status).toBe(404);
    expect(Object.keys(response.body.error).sort()).toEqual([
      'code',
      'details',
      'message',
      'requestId',
    ]);
    expect(response.body.error.code).toBe('NOT_FOUND');
    expect(response.body.error.requestId).toBe(
      response.headers['x-request-id'],
    );
  });

  test('does not trust incoming request ID text', async () => {
    const response = await request(appWithRoutes())
      .get('/api/v1/health')
      .set('X-Request-ID', 'untrusted');

    expect(response.headers['x-request-id']).not.toBe('untrusted');
  });

  test('allows exact configured CORS origins, with credentials', async () => {
    const response = await request(appWithRoutes())
      .get('/api/v1/health')
      .set('Origin', 'http://localhost:5173');

    expect(response.headers['access-control-allow-origin']).toBe(
      'http://localhost:5173',
    );
    expect(response.headers['access-control-allow-credentials']).toBe('true');
  });

  test('rejects unapproved CORS origins', async () => {
    const response = await request(appWithRoutes())
      .get('/api/v1/health')
      .set('Origin', 'https://unapproved.example');

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('FORBIDDEN');
  });

  test('handles CORS preflight', async () => {
    const response = await request(appWithRoutes())
      .options('/api/v1/health')
      .set('Origin', 'http://localhost:5173')
      .set('Access-Control-Request-Method', 'GET');

    expect(response.status).toBe(204);
  });

  test('rejects malformed JSON through error handler', async () => {
    const response = await request(appWithRoutes())
      .post('/api/v1/echo')
      .set('Content-Type', 'application/json')
      .send('{broken');

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });

  test('enforces JSON body size cap', async () => {
    const response = await request(appWithRoutes())
      .post('/api/v1/echo')
      .send({ data: 'x'.repeat(1100000) });

    expect(response.status).toBe(413);
  });

  test.each([
    { password: { $gt: '' } },
    { profile: { 'nested.key': 'value' } },
    { values: [{ $where: 'x' }] },
  ])('rejects nested unsafe object keys: %j', async (body) => {
    const response = await request(appWithRoutes())
      .post('/api/v1/echo')
      .send(body);

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });

  test('rejects unsafe query keys', async () => {
    const response = await request(appWithRoutes()).get(
      '/api/v1/health?password[$gt]=x',
    );

    expect(response.status).toBe(400);
  });

  test('preserves safe bodies and string values', async () => {
    const body = {
      title: 'Costs $5.00',
      nested: { values: [null, 3, 'ok'] },
    };
    const response = await request(appWithRoutes())
      .post('/api/v1/echo')
      .send(body);

    expect(response.status).toBe(200);
    expect(response.body).toEqual(body);
  });

  test('forwards async typed errors and field details', async () => {
    const response = await request(appWithRoutes()).get(
      '/api/v1/known-error',
    );

    expect(response.status).toBe(409);
    expect(response.body.error.details[0].field).toBe('email');
  });

  test('hides unexpected errors from clients', async () => {
    const response = await request(appWithRoutes()).get(
      '/api/v1/unknown-error',
    );

    expect(response.status).toBe(500);
    expect(response.body.error.code).toBe('INTERNAL_ERROR');
    expect(JSON.stringify(response.body)).not.toContain('secret-value');
  });

  test('logs sanitized unexpected-error stack, not its message', async () => {
    const pino = createLogger('silent');
    pino.error = logger.error;

    const app = createApp({
      logger: pino,
      registerRoutes(app) {
        app.get('/oops', () => {
          throw new Error('secret-value');
        });
      },
    });

    await request(app).get('/oops');

    expect(JSON.stringify(logger.error.mock.calls)).not.toContain(
      'secret-value',
    );
    expect(logger.error).toHaveBeenCalled();
  });

  test('unsafe key detector accepts primitive roots', () => {
    expect(hasUnsafeKeys(null)).toBe(false);
    expect(hasUnsafeKeys('text')).toBe(false);
  });
});

describe('Environment validation', () => {
  test('validates MongoDB URI and provides defaults without opening a connection', () => {
    const config = readEnv(validTestEnv());

    expect(config.PORT).toBe(3000);
    expect(config.origins).toContain('http://localhost:5173');
    expect(config.TRUST_PROXY_HOPS).toBe(0);
    expect(config.JWT_ACCESS_TTL).toBe('15m');
    expect(config.JWT_ACCESS_SECRET).toBe(validTestSecret);
  });

  test('rejects an invalid MongoDB URI without exposing its value', () => {
    expect(() =>
      readEnv(validTestEnv({ MONGODB_URI: 'secret-invalid' })),
    ).toThrow('Invalid environment configuration');
  });

  test('rejects an invalid port', () => {
    expect(() => readEnv(validTestEnv({ PORT: -1 }))).toThrow(
      'Invalid environment configuration',
    );
  });

  test('rejects an invalid trust proxy count', () => {
    expect(() => readEnv(validTestEnv({ TRUST_PROXY_HOPS: 9 }))).toThrow(
      'Invalid environment configuration',
    );
  });

  test('rejects a missing MongoDB URI', () => {
    expect(() =>
      readEnv({ JWT_ACCESS_SECRET: validTestSecret }),
    ).toThrow('Invalid environment configuration');
  });

  test('rejects an empty JWT access secret', () => {
    expect(() =>
      readEnv(validTestEnv({ JWT_ACCESS_SECRET: '' })),
    ).toThrow('Invalid environment configuration');
  });

  test('rejects a JWT access secret shorter than 64 characters', () => {
    const shortSecret = 'x'.repeat(63);
    expect(shortSecret).toHaveLength(63);

    expect(() =>
      readEnv(validTestEnv({ JWT_ACCESS_SECRET: shortSecret })),
    ).toThrow('Invalid environment configuration');
  });

  test('rejects an unsafe CORS origin configuration', () => {
    for (const origins of [
      '*',
      '',
      'http://localhost:5173/path',
      'not-a-url',
      'https://name:password@host',
    ]) {
      expect(() =>
        readEnv(validTestEnv({ CORS_ORIGINS: origins })),
      ).toThrow('CORS_ORIGINS');
    }
  });

  test('rejects an invalid JWT access-token lifetime', () => {
    expect(() =>
      readEnv(validTestEnv({ JWT_ACCESS_TTL: 'forever' })),
    ).toThrow('Invalid environment configuration');
  });

  test('does not expose secret values in configuration errors', () => {
    const secret = 'sensitive-test-value';
    let errorMessage = '';

    try {
      readEnv(
        validTestEnv({
          MONGODB_URI: 'secret-invalid',
          JWT_ACCESS_SECRET: secret,
        }),
      );
    } catch (error) {
      errorMessage = error.message;
    }

    expect(errorMessage).toContain('Invalid environment configuration');
    expect(errorMessage).not.toContain('secret-invalid');
    expect(errorMessage).not.toContain(secret);
  });
});
