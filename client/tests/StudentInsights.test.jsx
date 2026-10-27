import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import StudentInsights from '../src/features/attempts/StudentInsights';
import { fetchAttemptHistory, fetchOwnAttempt, fetchStudentProgress } from '../src/features/attempts/attemptApi';

jest.mock('../src/features/attempts/attemptApi', () => ({
  fetchAttemptHistory: jest.fn(), fetchOwnAttempt: jest.fn(), fetchStudentProgress: jest.fn(),
}));
const id = 'aaaaaaaaaaaaaaaaaaaaaaaa';
const qid = 'bbbbbbbbbbbbbbbbbbbbbbbb';
const at = '2026-10-24T08:00:00.000Z';

beforeEach(() => {
  fetchAttemptHistory.mockReset().mockResolvedValue({ items: [] });
  fetchOwnAttempt.mockReset().mockResolvedValue({
    id, quizId: qid, quizTitle: 'Database Basics', topic: 'dbms', score: 1, maxScore: 2,
    submittedAt: at, answers: [{ questionId: '1', response: true, isCorrect: true, unanswered: false, correctAnswer: true }],
  });
  fetchStudentProgress.mockReset().mockResolvedValue({ topics: [], timeline: [] });
});

test('FR-033: renders empty history and then stored entries with own attempt details', async () => {
  const user = userEvent.setup();
  const { rerender } = render(<StudentInsights token="student-token" />);
  await user.click(screen.getByRole('button', { name: 'My attempt history' }));
  expect(await screen.findByText('No attempts yet.')).toBeInTheDocument();
  expect(fetchAttemptHistory).toHaveBeenCalledWith(expect.objectContaining({ token: 'student-token' }));
  fetchAttemptHistory.mockResolvedValue({ items: [{ id, quizId: qid, quizTitle: 'Database Basics', topic: 'dbms', score: 1, maxScore: 2, submittedAt: at }] });
  rerender(<StudentInsights token="student-token" refreshKey={1} />);
  expect(await screen.findByText(/Database Basics/)).toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'View attempt' }));
  expect(await screen.findByRole('heading', { name: 'Database Basics: 1/2' })).toBeInTheDocument();
  expect(fetchOwnAttempt).toHaveBeenCalledWith(id, expect.objectContaining({ token: 'student-token' }));
});

test('FR-034: displays topic aggregation and attempt timeline', async () => {
  fetchStudentProgress.mockResolvedValue({
    topics: [{ topic: 'dbms', quizzesAttempted: 2, averageBestPct: 70 }],
    timeline: [{ attemptId: id, quizId: qid, quizTitle: 'Database Basics', topic: 'dbms', score: 4, maxScore: 5, percentage: 80, submittedAt: at }],
  });
  const user = userEvent.setup();
  render(<StudentInsights token="student-token" />);
  await user.click(screen.getByRole('button', { name: 'My progress' }));
  expect(await screen.findByText(/2 quizzes attempted/)).toHaveTextContent('70.0%');
  expect(screen.getByText(/Database Basics: 80.0%/)).toBeInTheDocument();
});

test('401 signals session expiry instead of exposing student data', async () => {
  fetchAttemptHistory.mockRejectedValue({ response: { status: 401 } });
  const expired = jest.fn();
  const user = userEvent.setup();
  render(<StudentInsights token="expired-token" onUnauthorized={expired} />);
  await user.click(screen.getByRole('button', { name: 'My attempt history' }));
  await waitFor(() => expect(expired).toHaveBeenCalledTimes(1));
});
