import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { http } from '../src/api/http';
import { listPublishedQuizzesByTopic } from '../src/features/quizzes/quizApi';
import MaterialDetailPage from '../src/features/materials/MaterialDetailPage';
import { MaterialSessionProvider } from '../src/features/materials/MaterialSession';
import {
  addComment,
  downloadMaterial,
  fetchComments,
  fetchRevisions,
  getMaterial,
  rateMaterial,
  reportMaterial,
  updateMaterial,
} from '../src/features/materials/materialApi';

jest.mock('../src/api/http', () => ({ http: { post: jest.fn() } }));
jest.mock('../src/features/quizzes/quizApi', () => ({
  listPublishedQuizzesByTopic: jest.fn().mockResolvedValue({ items: [], page: 1, limit: 20, total: 0 }),
}));
jest.mock('../src/features/materials/materialApi', () => ({
  ...jest.requireActual('../src/features/materials/materialApi'),
  addComment: jest.fn(),
  downloadMaterial: jest.fn(),
  fetchComments: jest.fn(),
  fetchRevisions: jest.fn(),
  getMaterial: jest.fn(),
  rateMaterial: jest.fn(),
  reportMaterial: jest.fn(),
  updateMaterial: jest.fn(),
}));

const material = {
  id: 'm1',
  title: 'Database notes',
  description: 'Normalisation',
  category: 'Notes',
  topic: 'dbms',
  tags: ['sql'],
  visibility: 'public',
  ownerId: 'u2',
  ratingAvg: 4,
  ratingCount: 1,
  updatedAt: '2026-01-01T00:00:00.000Z',
};

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/materials/m1']}>
      <MaterialSessionProvider>
        <Routes><Route path="/materials/:id" element={<MaterialDetailPage />} /></Routes>
      </MaterialSessionProvider>
    </MemoryRouter>,
  );
}

test('student views, rates, comments and reports material without seeing revisions', async () => {
  const user = userEvent.setup();
  http.post.mockImplementation(async (path) => (path === '/auth/login'
    ? { data: { accessToken: 'student-token', user: { id: 'u1', name: 'Student', role: 'student' } } }
    : { data: {} }));
  getMaterial.mockResolvedValue(material);
  fetchComments.mockResolvedValue({
    items: [{ id: 'c1', content: '<b>hostile</b>', author: { id: 'u2', name: 'Owner' }, createdAt: '2026-01-01T00:00:00.000Z' }],
    page: 1, limit: 20, total: 1,
  });
  fetchRevisions.mockRejectedValue({ response: { status: 403 } });
  rateMaterial.mockResolvedValue({ id: 'm1', ratingAvg: 4.5, ratingCount: 2 });
  addComment.mockResolvedValue({ id: 'c2' });
  reportMaterial.mockResolvedValue({ id: 'r1' });

  renderPage();
  await user.type(screen.getByLabelText('Email'), 'student@example.com');
  await user.type(screen.getByLabelText('Password'), 'Study1234');
  await user.click(screen.getByRole('button', { name: 'Sign in' }));

  expect(await screen.findByRole('heading', { name: 'Database notes' })).toBeInTheDocument();
  expect(screen.getByText('<b>hostile</b>')).toBeInTheDocument();
  expect(screen.queryByText('Revision history')).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Edit material' })).not.toBeInTheDocument();

  await user.selectOptions(screen.getByLabelText('Rating'), '5');
  await user.click(screen.getByRole('button', { name: 'Save rating' }));
  await waitFor(() => expect(rateMaterial).toHaveBeenCalledWith('m1', 5, 'student-token'));
  expect(await screen.findByText('Rating saved.')).toBeInTheDocument();

  await user.type(screen.getByLabelText('Add a comment'), '  Useful notes  ');
  await user.click(screen.getByRole('button', { name: 'Post comment' }));
  await waitFor(() => expect(addComment).toHaveBeenCalledWith('m1', 'Useful notes', 'student-token'));

  await user.selectOptions(screen.getByLabelText('Reason'), 'spam');
  await user.type(screen.getByLabelText(/Note/), 'Advertising');
  await user.click(screen.getByRole('button', { name: 'Submit report' }));
  await waitFor(() => expect(reportMaterial).toHaveBeenCalledWith('m1', { reason: 'spam', note: 'Advertising' }, 'student-token'));
  expect(await screen.findByText('Report submitted. A moderator will review it.')).toBeInTheDocument();
});

test('owner edits metadata, sees revisions and downloads the file', async () => {
  const user = userEvent.setup();
  const createObjectURL = jest.fn(() => 'blob:material');
  const revokeObjectURL = jest.fn();
  const originalCreate = URL.createObjectURL;
  const originalRevoke = URL.revokeObjectURL;
  URL.createObjectURL = createObjectURL;
  URL.revokeObjectURL = revokeObjectURL;

  http.post.mockImplementation(async (path) => (path === '/auth/login'
    ? { data: { accessToken: 'owner-token', user: { id: 'u2', name: 'Owner', role: 'student', contributor: true } } }
    : { data: {} }));
  getMaterial.mockResolvedValue(material);
  fetchComments.mockResolvedValue({ items: [], page: 1, limit: 20, total: 0 });
  fetchRevisions.mockResolvedValue({
    items: [{ id: 'v1', versionNo: 1, title: 'Old title', description: 'Old', category: 'Notes', topic: 'dbms', tags: ['sql'], createdAt: '2026-01-01T00:00:00.000Z' }],
  });
  updateMaterial.mockResolvedValue({ ...material, title: 'Updated notes' });
  downloadMaterial.mockResolvedValue({ blob: new Blob(['docx']), filename: 'material-m1.docx' });
  let downloadedName = '';
  const click = jest.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function capture() { downloadedName = this.download; });

  renderPage();
  await user.type(screen.getByLabelText('Email'), 'owner@example.com');
  await user.type(screen.getByLabelText('Password'), 'Study1234');
  await user.click(screen.getByRole('button', { name: 'Sign in' }));

  expect(await screen.findByText('Version 1')).toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'Edit material' }));
  await user.clear(screen.getByLabelText('Title'));
  await user.type(screen.getByLabelText('Title'), 'Updated notes');
  await user.click(screen.getByRole('button', { name: 'Save changes' }));
  await waitFor(() => expect(updateMaterial).toHaveBeenCalledWith('m1', expect.objectContaining({ title: 'Updated notes' }), 'owner-token'));
  expect(await screen.findByText(/previous details are kept/)).toBeInTheDocument();

  await user.click(screen.getByRole('button', { name: 'Download file' }));
  await waitFor(() => expect(downloadMaterial).toHaveBeenCalledWith('m1', 'owner-token'));
  expect(createObjectURL).toHaveBeenCalled();
  expect(revokeObjectURL).toHaveBeenCalledWith('blob:material');
  expect(downloadedName).toBe('Updated notes.docx');
  click.mockRestore();

  URL.createObjectURL = originalCreate;
  URL.revokeObjectURL = originalRevoke;
});

test('validation errors stay local and failed loads are announced', async () => {
  const user = userEvent.setup();
  http.post.mockResolvedValue({ data: { accessToken: 'student-token', user: { id: 'u1', name: 'Student', role: 'student' } } });
  getMaterial.mockRejectedValue({ response: { data: { error: { message: 'Material not found.' } } } });
  renderPage();
  await user.type(screen.getByLabelText('Email'), 'student@example.com');
  await user.type(screen.getByLabelText('Password'), 'Study1234');
  await user.click(screen.getByRole('button', { name: 'Sign in' }));
  expect(await screen.findByText('Material not found.')).toBeInTheDocument();
});

test('material detail links published quizzes with the same topic', async () => {
  const user = userEvent.setup();
  http.post.mockResolvedValue({ data: { accessToken: 'student-token', user: { id: 'u1', name: 'Student', role: 'student' } } });
  getMaterial.mockResolvedValue({ ...material, topic: 'DBMS' });
  fetchComments.mockResolvedValue({ items: [], page: 1, limit: 20, total: 0 });
  fetchRevisions.mockRejectedValue({ response: { status: 403 } });
  listPublishedQuizzesByTopic.mockResolvedValueOnce({
    items: [{ id: 'quiz-1', title: 'Database questions' }], page: 1, limit: 20, total: 1,
  });
  renderPage();
  await user.type(screen.getByLabelText('Email'), 'student@example.com');
  await user.type(screen.getByLabelText('Password'), 'Study1234');
  await user.click(screen.getByRole('button', { name: 'Sign in' }));

  expect(await screen.findByRole('link', { name: 'Database questions' }))
    .toHaveAttribute('href', '/quizzes/quiz-1/attempt');
  expect(listPublishedQuizzesByTopic).toHaveBeenCalledWith('DBMS', 'student-token');
});

test('editing a material topic replaces quizzes from the previous topic', async () => {
  const user = userEvent.setup();
  http.post.mockResolvedValue({
    data: { accessToken: 'owner-token', user: { id: 'u2', name: 'Owner', role: 'student', contributor: true } },
  });
  getMaterial.mockResolvedValue(material);
  fetchComments.mockResolvedValue({ items: [], page: 1, limit: 20, total: 0 });
  fetchRevisions.mockResolvedValue({ items: [] });
  listPublishedQuizzesByTopic
    .mockResolvedValueOnce({ items: [{ id: 'old-quiz', title: 'Old DBMS quiz' }], page: 1, limit: 20, total: 1 })
    .mockResolvedValueOnce({ items: [{ id: 'new-quiz', title: 'New networks quiz' }], page: 1, limit: 20, total: 1 });
  updateMaterial.mockResolvedValue({ ...material, topic: 'networks' });

  renderPage();
  await user.type(screen.getByLabelText('Email'), 'owner@example.com');
  await user.type(screen.getByLabelText('Password'), 'Study1234');
  await user.click(screen.getByRole('button', { name: 'Sign in' }));
  expect(await screen.findByRole('link', { name: 'Old DBMS quiz' })).toBeInTheDocument();

  await user.click(screen.getByRole('button', { name: 'Edit material' }));
  await user.clear(screen.getByLabelText('Topic'));
  await user.type(screen.getByLabelText('Topic'), 'networks');
  await user.click(screen.getByRole('button', { name: 'Save changes' }));

  expect(await screen.findByRole('link', { name: 'New networks quiz' }))
    .toHaveAttribute('href', '/quizzes/new-quiz/attempt');
  expect(screen.queryByRole('link', { name: 'Old DBMS quiz' })).not.toBeInTheDocument();
  expect(screen.getByRole('heading', { name: 'Quizzes for networks' })).toBeInTheDocument();
  expect(listPublishedQuizzesByTopic).toHaveBeenNthCalledWith(2, 'networks', 'owner-token');
});
