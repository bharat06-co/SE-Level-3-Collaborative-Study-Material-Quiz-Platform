import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { http } from '../src/api/http';
import { MaterialSessionProvider } from '../src/features/materials/MaterialSession';
import LeaderboardPage from '../src/features/quizzes/LeaderboardPage';
import { fetchLeaderboard } from '../src/features/quizzes/leaderboardApi';

jest.mock('../src/api/http', () => ({ http: { post: jest.fn() } }));
jest.mock('../src/features/quizzes/leaderboardApi', () => ({ fetchLeaderboard: jest.fn() }));

test('student switches quiz and topic rankings without reloading the page', async () => {
  const user = userEvent.setup();
  http.post.mockResolvedValue({ data: { accessToken: 'student-token', user: { id: 'u1', name: 'Student', role: 'student' } } });
  fetchLeaderboard.mockResolvedValueOnce({
    quizId: 'aaaaaaaaaaaaaaaaaaaaaaaa', title: 'Database quiz', page: 1, limit: 20, total: 3,
    items: [
      { studentId: 'a', studentName: 'Alice', score: 8, rank: 1 },
      { studentId: 'b', studentName: 'Bob', score: 8, rank: 1 },
      { studentId: 'c', studentName: 'Charlie', score: 6, rank: 3 },
    ],
  }).mockResolvedValueOnce({
    topic: 'dbms', page: 1, limit: 20, total: 2,
    items: [
      { studentId: 'a', studentName: 'Alice', rankingScore: 140, rank: 1 },
      { studentId: 'b', studentName: 'Bob', rankingScore: 100, rank: 2 },
    ],
  });
  render(<MemoryRouter><MaterialSessionProvider><LeaderboardPage /></MaterialSessionProvider></MemoryRouter>);
  await user.type(screen.getByLabelText('Email'), 'student@example.com');
  await user.type(screen.getByLabelText('Password'), 'Study1234');
  await user.click(screen.getByRole('button', { name: 'Sign in' }));
  await user.type(screen.getByLabelText('Quiz ID'), 'aaaaaaaaaaaaaaaaaaaaaaaa');
  await user.click(screen.getByRole('button', { name: 'Show leaderboard' }));
  const quiz = await screen.findByRole('region', { name: 'Quiz leaderboard results' });
  expect(within(quiz).getAllByRole('row').slice(1).map((row) => within(row).getAllByRole('cell')[0].textContent))
    .toEqual(['1', '1', '3']);
  expect(fetchLeaderboard).toHaveBeenCalledWith({ quizId: 'aaaaaaaaaaaaaaaaaaaaaaaa', token: 'student-token', page: 1 });

  await user.click(screen.getByRole('button', { name: 'Topic leaderboard' }));
  expect(screen.queryByRole('region', { name: 'Quiz leaderboard results' })).not.toBeInTheDocument();
  await user.type(screen.getByLabelText('Topic'), 'dbms');
  await user.click(screen.getByRole('button', { name: 'Show leaderboard' }));
  const topic = await screen.findByRole('region', { name: 'Topic leaderboard results' });
  expect(within(topic).getByText('140')).toBeInTheDocument();
  expect(fetchLeaderboard).toHaveBeenLastCalledWith({ topic: 'dbms', token: 'student-token', page: 1 });
});

test('ignores an outdated quiz response after switching to a topic leaderboard', async () => {
  const user = userEvent.setup();
  http.post.mockResolvedValue({
    data: { accessToken: 'student-token', user: { id: 'u1', name: 'Student', role: 'student' } },
  });
  let resolveQuiz;
  const quizRequest = new Promise((resolve) => { resolveQuiz = resolve; });
  fetchLeaderboard
    .mockReturnValueOnce(quizRequest)
    .mockResolvedValueOnce({
      topic: 'networks', page: 1, limit: 20, total: 1,
      items: [{ studentId: 'topic-student', studentName: 'Topic winner', rankingScore: 175, rank: 1 }],
    });

  render(<MemoryRouter><MaterialSessionProvider><LeaderboardPage /></MaterialSessionProvider></MemoryRouter>);
  await user.type(screen.getByLabelText('Email'), 'student@example.com');
  await user.type(screen.getByLabelText('Password'), 'Study1234');
  await user.click(screen.getByRole('button', { name: 'Sign in' }));
  await user.type(screen.getByLabelText('Quiz ID'), 'aaaaaaaaaaaaaaaaaaaaaaaa');
  await user.click(screen.getByRole('button', { name: 'Show leaderboard' }));
  expect(screen.getByText('Loading leaderboard…')).toBeInTheDocument();

  await user.click(screen.getByRole('button', { name: 'Topic leaderboard' }));
  await user.type(screen.getByLabelText('Topic'), 'networks');
  await user.click(screen.getByRole('button', { name: 'Show leaderboard' }));
  const topic = await screen.findByRole('region', { name: 'Topic leaderboard results' });
  expect(within(topic).getByText('Topic winner')).toBeInTheDocument();
  expect(within(topic).getByText('175')).toBeInTheDocument();

  resolveQuiz({
    quizId: 'aaaaaaaaaaaaaaaaaaaaaaaa', title: 'Stale quiz', page: 1, limit: 20, total: 1,
    items: [{ studentId: 'quiz-student', studentName: 'Stale quiz winner', score: 10, rank: 1 }],
  });
  await Promise.resolve();
  expect(screen.getByRole('region', { name: 'Topic leaderboard results' })).toBeInTheDocument();
  expect(screen.getByText('Topic winner')).toBeInTheDocument();
  expect(screen.queryByText('Stale quiz winner')).not.toBeInTheDocument();
});
