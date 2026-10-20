jest.mock('../src/modules/auth/user.repository', () => ({
  create: jest.fn(),
}));

const bcrypt = require('bcryptjs');
const userRepository = require('../src/modules/auth/user.repository');
const { registerUser } = require('../src/modules/auth/auth.service');
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
    // \u00e9 represents é: 1 JavaScript character but 2 UTF-8 bytes.
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
