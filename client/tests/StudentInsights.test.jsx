import { act, render, screen, waitFor, within } from '@testing-library/react';
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

function deferred() {
  let resolve, reject;
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise; reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

const history = { items: [{ id, quizId: qid, quizTitle: 'Database Basics', topic: 'dbms', score: 1, maxScore: 2, submittedAt: at }] };
const progress = {
  topics: [{ topic: 'dbms', quizzesAttempted: 2, averageBestPct: 70 }],
  timeline: [{ attemptId: id, quizId: qid, quizTitle: 'Database Basics', topic: 'dbms', score: 4, maxScore: 5, percentage: 80, submittedAt: at }],
};
const views = {
  history: { button: 'My attempt history', region: 'My attempt history', fetch: fetchAttemptHistory, data: history },
  progress: { button: 'My progress', region: 'My progress dashboard', fetch: fetchStudentProgress, data: progress },
};

test.each([
  ['history', 'progress', false], ['progress', 'history', false],
  ['history', 'progress', true], ['progress', 'history', true],
])('D-001: loaded %s switches to %s with populated=%s', async (from, to, populated) => {
  const first = views[from], next = views[to];
  const firstData = populated ? first.data : from === 'history' ? { items: [] } : { topics: [], timeline: [] };
  const nextData = populated ? next.data : to === 'history' ? { items: [] } : { topics: [], timeline: [] };
  first.fetch.mockResolvedValue(firstData);
  const pending = deferred(); next.fetch.mockReturnValue(pending.promise);
  const user = userEvent.setup();
  render(<StudentInsights token="student-token" />);

  await user.click(screen.getByRole('button', { name: first.button }));
  expect(await screen.findByRole('region', { name: first.region })).toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: next.button }));
  expect(screen.getByRole('status')).toHaveTextContent('Loading your');
  expect(screen.queryByRole('region', { name: first.region })).not.toBeInTheDocument();
  expect(screen.queryByRole('region', { name: next.region })).not.toBeInTheDocument();

  await act(async () => pending.resolve(nextData));
  const region = await screen.findByRole('region', { name: next.region });
  expect(screen.getByRole('button', { name: next.button })).toHaveAttribute('aria-pressed', 'true');
  if (!populated) expect(within(region).getByText('No attempts yet.')).toBeInTheDocument();
  else if (to === 'history') expect(within(region).getByText('Database Basics')).toBeInTheDocument();
  else expect(within(region).getByText(/2 quizzes attempted/)).toHaveTextContent('70.0%');
  expect(screen.queryByRole('status')).not.toBeInTheDocument();
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
});

test.each([['history', 'progress'], ['progress', 'history']])(
  'D-001: rapid %s -> %s -> original ignores out-of-order responses', async (from, to) => {
    const first = views[from], next = views[to];
    const staleFirst = deferred(), staleNext = deferred(), current = deferred();
    first.fetch.mockReturnValueOnce(staleFirst.promise).mockReturnValueOnce(current.promise);
    next.fetch.mockReturnValueOnce(staleNext.promise);
    const user = userEvent.setup();
    render(<StudentInsights token="student-token" />);

    await user.click(screen.getByRole('button', { name: first.button }));
    await user.click(screen.getByRole('button', { name: next.button }));
    await user.click(screen.getByRole('button', { name: first.button }));
    expect(first.fetch.mock.calls[0][0].signal.aborted).toBe(true);
    expect(next.fetch.mock.calls[0][0].signal.aborted).toBe(true);
    expect(first.fetch.mock.calls[1][0].signal.aborted).toBe(false);

    // The newest request is empty; older populated responses must not replace it.
    await act(async () => current.resolve(from === 'history' ? { items: [] } : { topics: [], timeline: [] }));
    expect(await screen.findByText('No attempts yet.')).toBeInTheDocument();
    await act(async () => { staleNext.resolve(next.data); staleFirst.resolve(first.data); });
    expect(screen.getByRole('region', { name: first.region })).toBeInTheDocument();
    expect(screen.getByText('No attempts yet.')).toBeInTheDocument();
    expect(screen.queryByText(/Database Basics/)).not.toBeInTheDocument();
    expect(screen.queryByRole('region', { name: next.region })).not.toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  },
);

test.each([['history', 'progress'], ['progress', 'history']])(
  'D-001: cancelled %s errors do not expire the selected %s view', async (from, to) => {
    const first = views[from], next = views[to];
    const stale = deferred(); first.fetch.mockReturnValueOnce(stale.promise);
    next.fetch.mockResolvedValue(next.data);
    const expired = jest.fn(); const user = userEvent.setup();
    render(<StudentInsights token="student-token" onUnauthorized={expired} />);
    await user.click(screen.getByRole('button', { name: first.button }));
    await user.click(screen.getByRole('button', { name: next.button }));
    expect(await screen.findByRole('region', { name: next.region })).toBeInTheDocument();
    await act(async () => stale.reject({ response: { status: 401 } }));
    expect(expired).not.toHaveBeenCalled();
    expect(screen.getByRole('region', { name: next.region })).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  },
);
