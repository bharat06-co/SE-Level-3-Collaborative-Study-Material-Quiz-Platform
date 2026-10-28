import { validateEmail, validateObjectId, validatePassword } from '../src/utils/formValidation';

test('validates email fields', () => {
  expect(validateEmail('')).toBe('Email is required.');
  expect(validateEmail('not-an-email')).toBe('Enter a valid email address.');
  expect(validateEmail('student@example.com')).toBeNull();
});

test('validates password presence', () => {
  expect(validatePassword('')).toBe('Password is required.');
  expect(validatePassword('x')).toBeNull();
});

test('validates MongoDB object IDs', () => {
  expect(validateObjectId('', 'Quiz ID')).toBe('Quiz ID is required.');
  expect(validateObjectId('abc', 'Quiz ID')).toBe('Quiz ID must be 24 hexadecimal characters.');
  expect(validateObjectId('aaaaaaaaaaaaaaaaaaaaaaaa', 'Quiz ID')).toBeNull();
});
