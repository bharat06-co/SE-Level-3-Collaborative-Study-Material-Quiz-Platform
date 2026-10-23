
jest.mock('../src/modules/auth/user.repository', () => ({
  create: jest.fn(),
  findByEmail: jest.fn(),
}));

jest.mock('../src/modules/auth/refresh-token.repository', () => ({
  create: jest.fn(),
  findByTokenHash: jest.fn(),
  revokeById: jest.fn(),
  consumeActiveToken: jest.fn(),
}));

jest.mock('../src/config/env', () => ({
  readEnv: jest.fn(),
}));

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const userRepository = require('../src/modules/auth/user.repository');
const refreshTokenRepository = require('../src/modules/auth/refresh-token.repository');
const { readEnv } = require('../src/config/env');
const {
  registerUser,
  loginUser,
} = require('../src/modules/auth/auth.service');
const User = require('../src/models/User');

describe('FR-001 registration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('creates a student with normalized email and a bcrypt password hash', async () => {
    userRepository.create.mockImplementation(async (data) => ({
      ...data,
      _id: { toString: () => 'test-user-id' },
      createdAt: new Date('2026-01-01T00:00:00Z'),
      updatedAt: new Date('2026-01-01T00:00:00Z'),
    }));

    const result = await registerUser({
      name: 'Test Student',
      email: '  STUDENT@example.com ',
      password: 'Study1234',
      role: 'admin',
      contributor: true,
    });

    const savedUser = userRepository.create.mock.calls[0][0];

    expect(savedUser.email).toBe('student@example.com');
    expect(savedUser.role).toBe('student');
    expect(savedUser.contributor).toBe(false);
    expect(savedUser.passwordHash).not.toBe('Study1234');
    expect(await bcrypt.compare('Study1234', savedUser.passwordHash)).toBe(true);
    expect(result).not.toHaveProperty('passwordHash');
    expect(result.id).toBe('test-user-id');
  });

  test.each([
    [{ name: 'A', email: 'valid@example.com', password: 'Study1234' }],
    [{ name: 'Valid Name', email: 'invalid-email', password: 'Study1234' }],
    [{ name: 'Valid Name', email: 'valid@example.com', password: 'short1' }],
    [{ name: 'Valid Name', email: 'valid@example.com', password: 'passwordonly' }],
  ])('rejects invalid registration input', async (input) => {
    await expect(registerUser(input)).rejects.toMatchObject({
      statusCode: 400,
      code: 'VALIDATION_ERROR',
    });

    expect(userRepository.create).not.toHaveBeenCalled();
  });

  test('accepts a password of exactly 72 UTF-8 bytes', async () => {
    const password = 'A1' + 'x'.repeat(70);

    expect(Buffer.byteLength(password, 'utf8')).toBe(72);

    userRepository.create.mockImplementation(async (data) => ({
      ...data,
      _id: { toString: () => 'test-user-id' },
      createdAt: new Date(),
      updatedAt: new Date(),
    }));

    await expect(
      registerUser({
        name: 'Valid Name',
        email: 'valid@example.com',
        password,
      }),
    ).resolves.toMatchObject({ email: 'valid@example.com' });

    expect(userRepository.create).toHaveBeenCalledTimes(1);
  });

  test('rejects a password exceeding 72 UTF-8 bytes before hashing or saving', async () => {
    const password = 'A1' + 'x'.repeat(71);

    expect(Buffer.byteLength(password, 'utf8')).toBe(73);

    const hashSpy = jest.spyOn(bcrypt, 'hash');

    try {
      await expect(
        registerUser({
          name: 'Valid Name',
          email: 'valid@example.com',
          password,
        }),
      ).rejects.toMatchObject({
        statusCode: 400,
        code: 'VALIDATION_ERROR',
      });

      expect(hashSpy).not.toHaveBeenCalled();
      expect(userRepository.create).not.toHaveBeenCalled();
    } finally {
      hashSpy.mockRestore();
    }
  });

  test('rejects multibyte passwords exceeding 72 UTF-8 bytes', async () => {
    const password = 'A1' + '\u00e9'.repeat(36);

    expect(password.length).toBe(38);
    expect(Buffer.byteLength(password, 'utf8')).toBe(74);

    const hashSpy = jest.spyOn(bcrypt, 'hash');

    try {
      await expect(
        registerUser({
          name: 'Valid Name',
          email: 'valid@example.com',
          password,
        }),
      ).rejects.toMatchObject({
        statusCode: 400,
        code: 'VALIDATION_ERROR',
      });

      expect(hashSpy).not.toHaveBeenCalled();
      expect(userRepository.create).not.toHaveBeenCalled();
    } finally {
      hashSpy.mockRestore();
    }
  });

  test('real User schema accepts the agreed roles', () => {
    for (const role of ['student', 'educator', 'admin']) {
      const user = new User({
        name: 'Test User',
        email: role + '@example.com',
        passwordHash: 'test-hash',
        role,
      });

      const error = user.validateSync();

      expect(error?.errors?.role).toBeUndefined();
    }
  });

  test('real User schema rejects an unsupported role', () => {
    const user = new User({
      name: 'Test User',
      email: 'bad-role@example.com',
      passwordHash: 'test-hash',
      role: 'administrator',
    });

    const error = user.validateSync();

    expect(error?.errors?.role).toBeDefined();
  });

  test('returns 409 when the email already exists', async () => {
    userRepository.create.mockRejectedValue({
      code: 11000,
      keyPattern: { email: 1 },
    });

    await expect(
      registerUser({
        name: 'Test Student',
        email: 'existing@example.com',
        password: 'Study1234',
      }),
    ).rejects.toMatchObject({
      statusCode: 409,
      code: 'EMAIL_TAKEN',
    });
  });
});

describe('FR-002 login', () => {
  const password = 'Study1234';
  const userId = 'login-user-id';
  const jwtSecret = 'test-secret-'.repeat(6);

  let user;

  beforeEach(() => {
    jest.clearAllMocks();

    readEnv.mockReturnValue({
      JWT_ACCESS_SECRET: jwtSecret,
      JWT_ACCESS_TTL: '15m',
    });

    // Login's refresh-token persistence is mocked in these unit tests.
    refreshTokenRepository.create.mockResolvedValue({});

    user = {
      _id: { toString: () => userId },
      name: 'Test Student',
      email: 'student@example.com',
      passwordHash: bcrypt.hashSync(password, 10),
      role: 'student',
      contributor: false,
    };
  });

  test('logs in with valid credentials and returns a signed JWT and safe user details', async () => {
    userRepository.findByEmail.mockResolvedValue(user);

    const result = await loginUser({
      email: ' STUDENT@example.com ',
      password,
    });

    expect(userRepository.findByEmail).toHaveBeenCalledWith(
      'student@example.com',
    );

    expect(result.tokenType).toBe('Bearer');
    expect(result.expiresIn).toBe(900);

    expect(result.user).toEqual({
      id: userId,
      name: 'Test Student',
      email: 'student@example.com',
      role: 'student',
      contributor: false,
    });

    expect(result).not.toHaveProperty('passwordHash');
    expect(typeof result.refreshToken).toBe('string');
    expect(result.refreshToken.length).toBeGreaterThan(0);

    expect(refreshTokenRepository.create).toHaveBeenCalledTimes(1);

    const [storedRefreshToken] = refreshTokenRepository.create.mock.calls[0];

    expect(storedRefreshToken.userId.toString()).toBe(userId);
    expect(storedRefreshToken.tokenHash).not.toBe(result.refreshToken);
    expect(storedRefreshToken.tokenHash).toMatch(/^[a-f0-9]{64}$/);
    expect(storedRefreshToken.expiresAt).toBeInstanceOf(Date);
    expect(storedRefreshToken.revokedAt).toBeNull();

    // Verify the JWT's signature, identity, claims, and actual lifetime.
    const decoded = jwt.verify(result.accessToken, jwtSecret, {
      algorithms: ['HS256'],
    });

    expect(decoded.sub).toBe(userId);
    expect(decoded.role).toBe('student');
    expect(decoded.contributor).toBe(false);
    expect(decoded.exp - decoded.iat).toBe(900);
  });

  test('rejects an incorrect password with a generic credentials error', async () => {
    userRepository.findByEmail.mockResolvedValue(user);

    await expect(
      loginUser({
        email: 'student@example.com',
        password: 'WrongPassword1',
      }),
    ).rejects.toMatchObject({
      statusCode: 401,
      code: 'INVALID_CREDENTIALS',
      message: 'Email or password is incorrect.',
    });

    expect(refreshTokenRepository.create).not.toHaveBeenCalled();
  });

  test('rejects an unknown email with the same generic credentials error', async () => {
    userRepository.findByEmail.mockResolvedValue(null);

    await expect(
      loginUser({
        email: 'unknown@example.com',
        password,
      }),
    ).rejects.toMatchObject({
      statusCode: 401,
      code: 'INVALID_CREDENTIALS',
      message: 'Email or password is incorrect.',
    });

    expect(refreshTokenRepository.create).not.toHaveBeenCalled();
  });

  test('refuses to issue a token when the JWT secret is missing', async () => {
    readEnv.mockReturnValue({
      JWT_ACCESS_SECRET: undefined,
      JWT_ACCESS_TTL: '15m',
    });

    await expect(
      loginUser({
        email: 'student@example.com',
        password,
      }),
    ).rejects.toMatchObject({
      statusCode: 503,
      code: 'SERVICE_UNAVAILABLE',
    });

    expect(userRepository.findByEmail).not.toHaveBeenCalled();
    expect(refreshTokenRepository.create).not.toHaveBeenCalled();
  });

  test.each([
    [{ email: 'bad-email', password }],
    [{ email: 'student@example.com', password: '' }],
    [{ email: '', password }],
    [null],
  ])('rejects invalid login input', async (input) => {
    await expect(loginUser(input)).rejects.toMatchObject({
      statusCode: 400,
      code: 'VALIDATION_ERROR',
    });

    expect(userRepository.findByEmail).not.toHaveBeenCalled();
    expect(refreshTokenRepository.create).not.toHaveBeenCalled();
  });
});
