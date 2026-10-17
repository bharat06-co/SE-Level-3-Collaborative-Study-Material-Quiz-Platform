
jest.mock('../src/modules/auth/user.repository', () => ({
  create: jest.fn(),
}));

const bcrypt = require('bcryptjs');
const userRepository = require('../src/modules/auth/user.repository');
const { registerUser } = require('../src/modules/auth/auth.service');

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
      role: 'administrator',
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
