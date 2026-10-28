import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { http } from '../src/api/http';
import MaterialLibraryPage from '../src/features/materials/MaterialLibraryPage';
import { listMaterials, uploadMaterial } from '../src/features/materials/materialApi';

jest.mock('../src/api/http', () => ({ http: { post: jest.fn() } }));
jest.mock('../src/features/materials/materialApi', () => ({
  ...jest.requireActual('../src/features/materials/materialApi'),
  listMaterials: jest.fn(),
  uploadMaterial: jest.fn(),
}));

const material = {
  id: 'aaaaaaaaaaaaaaaaaaaaaaaa',
  title: 'Database notes',
  description: 'Normalisation',
  category: 'Notes',
  topic: 'dbms',
  tags: ['sql'],
  visibility: 'public',
  ownerId: 'other',
  ratingAvg: 4.5,
  ratingCount: 2,
};

test('signs in, lists materials, filters and pages', async () => {
  const user = userEvent.setup();
  http.post.mockResolvedValue({ data: { accessToken: 'token-1', user: { id: 'u1', name: 'Student', role: 'student' } } });
  listMaterials.mockResolvedValue({ items: [material], page: 1, limit: 20, total: 21 });

  render(<MemoryRouter><MaterialLibraryPage /></MemoryRouter>);
  await user.type(screen.getByLabelText('Email'), 'student@example.com');
  await user.type(screen.getByLabelText('Password'), 'Study1234');
  await user.click(screen.getByRole('button', { name: 'Sign in' }));

  expect(await screen.findByRole('link', { name: 'Database notes' })).toHaveAttribute('href', '/materials/aaaaaaaaaaaaaaaaaaaaaaaa');
  expect(screen.getByText(/Rating 4.5 \(2\)/)).toBeInTheDocument();
  expect(listMaterials).toHaveBeenCalledWith('token-1', { q: '', tag: '', category: '', topic: '', page: 1 });
  expect(screen.getByText('Your account can browse materials but not upload them.')).toBeInTheDocument();

  await user.type(screen.getByLabelText('Search'), 'dbms');
  await user.click(screen.getByRole('button', { name: 'Apply filters' }));
  await waitFor(() => expect(listMaterials).toHaveBeenLastCalledWith('token-1', {
    q: 'dbms', tag: '', category: '', topic: '', page: 1,
  }));

  await user.click(screen.getByRole('button', { name: 'Next' }));
  await waitFor(() => expect(listMaterials).toHaveBeenLastCalledWith('token-1', {
    q: 'dbms', tag: '', category: '', topic: '', page: 2,
  }));

  await user.click(screen.getByRole('button', { name: 'Reset' }));
  await waitFor(() => expect(listMaterials).toHaveBeenLastCalledWith('token-1', {
    q: '', tag: '', category: '', topic: '', page: 1,
  }));
});

test('contributor can upload and the list refreshes; sign out clears the session', async () => {
  const user = userEvent.setup();
  http.post.mockImplementation(async (path) => (path === '/auth/login'
    ? { data: { accessToken: 'token-2', user: { id: 'u2', name: 'Contributor', role: 'student', contributor: true } } }
    : { data: {} }));
  listMaterials.mockResolvedValue({ items: [material], page: 1, limit: 20, total: 1 });
  uploadMaterial.mockResolvedValue({ id: 'm2' });

  render(<MemoryRouter><MaterialLibraryPage /></MemoryRouter>);
  await user.type(screen.getByLabelText('Email'), 'contributor@example.com');
  await user.type(screen.getByLabelText('Password'), 'Study1234');
  await user.click(screen.getByRole('button', { name: 'Sign in' }));

  expect(await screen.findByRole('heading', { name: 'Upload study material' })).toBeInTheDocument();
  const uploadForm = within(screen.getByRole('form', { name: 'Upload material' }));
  await user.type(uploadForm.getByLabelText('Title'), 'New notes');
  await user.type(uploadForm.getByLabelText('Description'), 'Details');
  await user.type(uploadForm.getByLabelText('Category'), 'Notes');
  await user.type(uploadForm.getByLabelText('Topic'), 'dbms');
  await user.type(uploadForm.getByLabelText('Tags'), 'sql');
  await user.upload(uploadForm.getByLabelText('File'), new File(['pdf'], 'notes.pdf', { type: 'application/pdf' }));
  await user.click(uploadForm.getByLabelText(/I have the rights/));
  await user.click(uploadForm.getByRole('button', { name: 'Upload material' }));

  await waitFor(() => expect(uploadMaterial).toHaveBeenCalledWith(expect.objectContaining({
    title: 'New notes', visibility: 'private', file: expect.any(File),
  }), 'token-2'));
  expect(await screen.findByText('Material uploaded.')).toBeInTheDocument();

  await user.click(screen.getByRole('button', { name: 'Sign out' }));
  expect(http.post).toHaveBeenCalledWith('/auth/logout');
  expect(await screen.findByRole('button', { name: 'Sign in' })).toBeInTheDocument();
});

test('handles load failures without losing the ability to sign in again', async () => {
  const user = userEvent.setup();
  http.post.mockResolvedValue({ data: { accessToken: 'token-3', user: { id: 'u3', name: 'Student', role: 'student' } } });
  listMaterials.mockRejectedValue({ response: { data: { error: { message: 'Search unavailable.' } } } });

  render(<MemoryRouter><MaterialLibraryPage /></MemoryRouter>);
  await user.type(screen.getByLabelText('Email'), 'student@example.com');
  await user.type(screen.getByLabelText('Password'), 'Study1234');
  await user.click(screen.getByRole('button', { name: 'Sign in' }));
  expect(await screen.findByText('Search unavailable.')).toBeInTheDocument();
});
