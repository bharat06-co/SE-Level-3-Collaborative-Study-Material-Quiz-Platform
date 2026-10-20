const { z } = require('zod');

const schema = z.object({
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),

  PORT: z.coerce.number().int().min(1).max(65535).default(3000),

  MONGODB_URI: z
    .string()
    .refine(
      (value) => /^mongodb(?:\+srv)?:\/\//.test(value),
      'Use a MongoDB URI',
    ),

  CORS_ORIGINS: z
    .string()
    .default('http://localhost:5173,http://127.0.0.1:5173'),

  TRUST_PROXY_HOPS: z.coerce.number().int().min(0).max(2).default(0),

  LOG_LEVEL: z
    .enum(['silent', 'fatal', 'error', 'warn', 'info', 'debug', 'trace'])
    .default('info'),

 JWT_ACCESS_SECRET: z
  .string()
  .optional()
  .refine(
    (secret) => secret === undefined || secret.length >= 64,
    'JWT access secret must contain at least 64 characters',
  ),
  JWT_ACCESS_TTL: z
    .string()
    .regex(/^[1-9]\d*(s|m|h|d)$/, 'Use a duration such as 15m')
    .default('15m'),
});

function readEnv(input = process.env) {
  const result = schema.safeParse(input);

  if (!result.success) {
    // Never expose environment values because they may contain secrets.
    throw new Error(
      `Invalid environment configuration: ${result.error.issues
        .map((issue) => issue.path.join('.'))
        .join(', ')}`,
    );
  }

  const config = result.data;

  const origins = config.CORS_ORIGINS
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  if (
    !origins.length ||
    origins.some((origin) => {
      try {
        const url = new URL(origin);

        return (
          !['http:', 'https:'].includes(url.protocol) ||
          url.origin !== origin ||
          Boolean(url.username || url.password)
        );
      } catch {
        return true;
      }
    })
  ) {
    throw new Error(
      'CORS_ORIGINS must contain exact HTTP(S) origins without paths, wildcards or credentials',
    );
  }

  return { ...config, origins };
}

module.exports = { readEnv };