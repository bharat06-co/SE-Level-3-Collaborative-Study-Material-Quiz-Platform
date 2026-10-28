import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { http } from '../src/api/http';
import AdminReportsPage from '../src/features/materials/AdminReportsPage';
import { MaterialSessionProvider } from '../src/features/materials/MaterialSession';
import { decideReport, fetchReports } from '../src/features/materials/materialApi';

jest.mock('../src/api/http', () => ({ http: { post: jest.fn() } }));
jest.mock('../src/features/materials/materialApi', () => ({
  ...jest.requireActual('../src/features/materials/materialApi'),
  fetchReports: jest.fn(),
  decideReport: jest.fn(),
}));

const openReport = {
  id: 'r1',
  materialId: 'm1',
  materialTitle: 'Database notes',
  reporter: { id: 'u2', name: 'Reporter' },
  reason: 'copyright',
  note: '<script>alert(1)</script>',
  status: 'open',
  createdAt: '2026-01-01T00:00:00.000Z',
  decidedAt: null,
};

test('non-admin cannot load the moderation queue', async () => {
  const user = userEvent.setup();
  http.post.mockResolvedValue({ data: { accessToken: 'token-1', user: { id: 'u1', name: 'Student', role: 'student' } } });
  render(<MemoryRouter><MaterialSessionProvider><AdminReportsPage /></MaterialSessionProvider></MemoryRouter>);
  await user.type(screen.getByLabelText('Email'), 'student@example.com');
  await user.type(screen.getByLabelText('Password'), 'Study1234');
  await user.click(screen.getByRole('button', { name: 'Sign in' }));
  expect(await screen.findByText('Only administrators can review reports.')).toBeInTheDocument();
  expect(fetchReports).not.toHaveBeenCalled();
});

test('admin reviews queue, renders notes as plain text, and decides reports', async () => {
  const user = userEvent.setup();
  http.post.mockImplementation(async (path) => (path === '/auth/login'
    ? { data: { accessToken: 'admin-token', user: { id: 'admin-1', name: 'Admin', role: 'admin' } } }
    : { data: {} }));
  fetchReports.mockResolvedValue({ items: [openReport] });
  decideReport.mockResolvedValue({ ...openReport, status: 'dismissed' });

  render(<MemoryRouter><MaterialSessionProvider><AdminReportsPage /></MaterialSessionProvider></MemoryRouter>);
  await user.type(screen.getByLabelText('Email'), 'admin@example.com');
  await user.type(screen.getByLabelText('Password'), 'Study1234');
  await user.click(screen.getByRole('button', { name: 'Sign in' }));

  expect(await screen.findByRole('heading', { name: /Database notes/ })).toBeInTheDocument();
  expect(screen.getByText('<script>alert(1)</script>')).toBeInTheDocument();
  expect(fetchReports).toHaveBeenCalledWith('admin-token', 'open');

  await user.click(screen.getByRole('button', { name: 'Dismiss' }));
  await waitFor(() => expect(decideReport).toHaveBeenCalledWith('r1', 'dismiss', 'admin-token'));
  expect(await screen.findByText('Report dismissed.')).toBeInTheDocument();

  await user.selectOptions(screen.getByLabelText('Queue status'), 'dismissed');
  await waitFor(() => expect(fetchReports).toHaveBeenLastCalledWith('admin-token', 'dismissed'));

  await user.click(screen.getByRole('button', { name: 'Sign out' }));
  expect(await screen.findByRole('button', { name: 'Sign in' })).toBeInTheDocument();
});
