import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import QuizAuthoringPage from '../src/features/quizzes/QuizAuthoringPage';
import { http } from '../src/api/http';
import { listDraftQuizzes, saveQuiz } from '../src/features/quizzes/quizApi';

jest.mock('../src/features/quizzes/quizApi', () => ({
  getQuiz: jest.fn(),
  listDraftQuizzes: jest.fn(),
  saveQuiz: jest.fn(),
  setQuizPublication: jest.fn(),
}));

test('author signs in and sends the access token to quiz creation', async () => {
  const user = userEvent.setup();
  const post = jest.spyOn(http, 'post').mockResolvedValue({
    data: { accessToken: 'test-access-token', user: { id: 'author-1', name: 'Author', role: 'educator', contributor: false } },
  });
  listDraftQuizzes.mockResolvedValue({ items: [], page: 1, total: 0, limit: 20 });
  saveQuiz.mockResolvedValue({ id: 'quiz-1', status: 'draft' });

  render(<MemoryRouter><QuizAuthoringPage /></MemoryRouter>);
  expect(screen.queryByRole('heading', { name: 'Create quiz' })).not.toBeInTheDocument();
  await user.type(screen.getByLabelText('Email'), 'author@example.com');
  await user.type(screen.getByLabelText('Password'), 'Study1234');
  await user.click(screen.getByRole('button', { name: 'Sign in to author quizzes' }));
  expect(await screen.findByRole('heading', { name: 'Create quiz' })).toBeInTheDocument();
  expect(post).toHaveBeenCalledWith('/auth/login', { email: 'author@example.com', password: 'Study1234' });
  expect(listDraftQuizzes).toHaveBeenCalledWith('test-access-token', 1);

  await user.type(screen.getByLabelText('Title'), 'DBMS basics');
  await user.type(screen.getByLabelText('Topic'), 'dbms');
  await user.click(screen.getByRole('button', { name: 'Save draft' }));
  expect(saveQuiz).toHaveBeenCalledWith(null, { title: 'DBMS basics', topic: 'dbms', allowRetake: true, questions: [] }, 'test-access-token');
  post.mockRestore();
});
