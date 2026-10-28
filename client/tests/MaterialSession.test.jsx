import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { http } from '../src/api/http';
import AppRoutes from '../src/AppRoutes';
import {
  fetchComments,
  fetchRevisions,
  getMaterial,
  listMaterials,
} from '../src/features/materials/materialApi';

jest.mock('../src/api/http', () => ({ http: { post: jest.fn() } }));
jest.mock('../src/features/materials/materialApi', () => ({
  ...jest.requireActual('../src/features/materials/materialApi'),
  fetchComments: jest.fn(),
  fetchRevisions: jest.fn(),
  getMaterial: jest.fn(),
  listMaterials: jest.fn(),
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
  ratingAvg: 0,
  ratingCount: 0,
};

test('shares the material session when navigating from the library to detail', async () => {
  const user = userEvent.setup();
  http.post.mockResolvedValue({
    data: { accessToken: 'shared-token', user: { id: 'u1', name: 'Student', role: 'student' } },
  });
  listMaterials.mockResolvedValue({ items: [material], page: 1, limit: 20, total: 1 });
  getMaterial.mockResolvedValue(material);
  fetchComments.mockResolvedValue({ items: [], page: 1, limit: 20, total: 0 });
  fetchRevisions.mockResolvedValue({ items: [] });

  render(<MemoryRouter initialEntries={['/materials']}><AppRoutes /></MemoryRouter>);
  await user.type(screen.getByLabelText('Email'), 'student@example.com');
  await user.type(screen.getByLabelText('Password'), 'Study1234');
  await user.click(screen.getByRole('button', { name: 'Sign in' }));

  await user.click(await screen.findByRole('link', { name: 'Database notes' }));

  expect(await screen.findByRole('heading', { name: 'Database notes' })).toBeInTheDocument();
  expect(screen.queryByRole('heading', { name: 'Sign in to open this material' })).not.toBeInTheDocument();
  expect(http.post).toHaveBeenCalledTimes(1);
  await waitFor(() => expect(getMaterial).toHaveBeenCalledWith(material.id, 'shared-token'));
});
