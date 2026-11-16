import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import ProfilePage from '../src/features/auth/ProfilePage';
import AdminUsersPage from '../src/features/auth/AdminUsersPage';
import { MaterialSessionProvider } from '../src/features/materials/MaterialSession';
import { http } from '../src/api/http';

jest.mock('../src/api/http', () => ({ http: { get: jest.fn(), post: jest.fn(), patch: jest.fn() } }));

const student = { _id: 'student-id', name: 'Demo Student', email: 'student@example.test', role: 'student', contributor: false };
const admin = { ...student, name: 'Demo Admin', role: 'admin' };
beforeEach(() => jest.resetAllMocks());

const headers = { Authorization: 'Bearer fixture-token' };

function show(Page) {
  render(<MemoryRouter><MaterialSessionProvider><Page /></MaterialSessionProvider></MemoryRouter>);
  return userEvent.setup();
}

async function signIn(user, account) {
  http.post.mockResolvedValueOnce({ data: { accessToken: 'fixture-token', user: account } });
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: account.email } });
  fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'Fixture123' } });
  await user.click(screen.getByRole('button', { name: 'Sign in' }));
}

test('gets and updates the signed-in profile and loads the saved value after sign-out', async () => {
  const updated = { ...student, name: 'Updated Student' };
  http.get.mockResolvedValueOnce({ data: { user: student } }).mockResolvedValueOnce({ data: { user: updated } });
  http.patch.mockResolvedValueOnce({ data: { user: updated } });
  const user = show(ProfilePage);
  await signIn(user, student);
  const input = await screen.findByDisplayValue(student.name);
  fireEvent.change(input, { target: { value: updated.name } });
  await user.click(screen.getByRole('button', { name: 'Save changes' }));
  expect(await screen.findByText('Profile updated.')).toBeInTheDocument();
  expect(http.get).toHaveBeenCalledWith('/users/me', expect.objectContaining({ headers }));
  expect(http.patch).toHaveBeenCalledWith('/users/me', { name: updated.name }, expect.objectContaining({ headers }));
  await user.click(screen.getByRole('button', { name: 'Sign out' }));
  expect(http.post).toHaveBeenCalledWith('/auth/logout');
  await signIn(user, student);
  expect(await screen.findByDisplayValue(updated.name)).toBeInTheDocument();
});

test('shows an admin-only message for students without making a privileged request', async () => {
  const user = show(AdminUsersPage);
  await signIn(user, student);
  expect(await screen.findByRole('alert')).toHaveTextContent('Administrator access required.');
  expect(http.get).not.toHaveBeenCalled();
});

test('lists users and toggles contributor status through the authenticated admin endpoint', async () => {
  const contributor = { ...student, contributor: true };
  http.get.mockResolvedValueOnce({ data: { users: [student] } });
  http.patch.mockResolvedValueOnce({ data: { user: contributor } }).mockResolvedValueOnce({ data: { user: student } });
  const user = show(AdminUsersPage);
  await signIn(user, admin);
  await user.click(await screen.findByRole('button', { name: 'Grant contributor' }));
  expect(await screen.findByText(/contributor enabled/)).toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'Revoke contributor' }));
  expect(await screen.findByText(/contributor disabled/)).toBeInTheDocument();
  expect(http.get).toHaveBeenCalledWith('/admin/users', expect.objectContaining({ headers }));
  const path = '/admin/users/student-id/role';
  expect(http.patch).toHaveBeenNthCalledWith(1, path, { contributor: true }, expect.objectContaining({ headers }));
  expect(http.patch).toHaveBeenNthCalledWith(2, path, { contributor: false }, expect.objectContaining({ headers }));
});

test('shows the server 403 message when a stale admin session is denied', async () => {
  http.get.mockRejectedValueOnce({ response: { status: 403, data: { error: { message: 'Forbidden.' } } } });
  const user = show(AdminUsersPage);
  await signIn(user, admin);
  expect(await screen.findByRole('alert')).toHaveTextContent('Forbidden.');
  expect(screen.queryByRole('button', { name: 'Grant contributor' })).not.toBeInTheDocument();
});
