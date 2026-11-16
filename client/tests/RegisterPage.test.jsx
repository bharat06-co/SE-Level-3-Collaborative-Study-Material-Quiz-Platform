import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import RegisterPage from '../src/features/auth/RegisterPage';
import { http } from '../src/api/http';

jest.mock('../src/api/http', () => ({ http: { post: jest.fn() } }));

function start() {
  render(<MemoryRouter><RegisterPage /></MemoryRouter>);
  return userEvent.setup();
}

function fill(password = 'Valid1234') {
  fireEvent.change(screen.getByLabelText('Full name'), { target: { value: 'Riya Sharma' } });
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'riya@example.com' } });
  fireEvent.change(screen.getByLabelText('Password', { exact: true }), { target: { value: password } });
  fireEvent.change(screen.getByLabelText('Confirm password'), { target: { value: password } });
}

test('registers via existing API and offers sign-in afterward', async () => {
  http.post.mockResolvedValue({ status: 201, data: { user: { role: 'student', contributor: false } } });
  const user = start();
  fill();
  await user.click(screen.getByRole('button', { name: 'Register' }));
  expect(http.post).toHaveBeenCalledWith('/auth/register', {
    name: 'Riya Sharma', email: 'riya@example.com', password: 'Valid1234',
  });
  expect(await screen.findByText('Account created. Sign in to continue.')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Sign in' })).toHaveAttribute('href', '/profile');
});

test('rejects weak password without network request', async () => {
  const user = start();
  fill('weak');
  await user.click(screen.getByRole('button', { name: 'Register' }));
  expect(screen.getByText(/Password needs at least 8/)).toBeInTheDocument();
  expect(http.post).not.toHaveBeenCalled();
});

test('displays duplicate email API error', async () => {
  http.post.mockRejectedValue({ response: { status: 409, data: { error: { message: 'Email already registered.' } } } });
  const user = start();
  fill();
  await user.click(screen.getByRole('button', { name: 'Register' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Email already registered.');
});

test('marks invalid email and mismatched password fields without submitting', async () => {
  const user = start();
  fill();
  const email = screen.getByLabelText('Email');
  const confirm = screen.getByLabelText('Confirm password');
  fireEvent.change(email, { target: { value: 'invalid-email' } });
  fireEvent.change(confirm, { target: { value: 'different' } });
  await user.click(screen.getByRole('button', { name: 'Register' }));
  expect(email).toHaveAttribute('aria-invalid', 'true');
  expect(confirm).toHaveAccessibleDescription('Passwords do not match.');
  expect(http.post).not.toHaveBeenCalled();
});
