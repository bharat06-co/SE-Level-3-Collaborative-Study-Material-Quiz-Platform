import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import StudentAttemptPage from '../src/features/attempts/StudentAttemptPage';
import { http } from '../src/api/http';
import { loadAttemptQuiz, submitAttempt } from '../src/features/attempts/attemptApi';
import { quiz, quizId, result } from './attemptFixtures';

jest.mock('../src/api/http', () => ({ http: { post: jest.fn() } }));
jest.mock('../src/features/attempts/attemptApi', () => {
  const actual = jest.requireActual('../src/features/attempts/attemptApi');
  return { ...actual, loadAttemptQuiz: jest.fn(), submitAttempt: jest.fn() };
});

beforeEach(() => {
  loadAttemptQuiz.mockResolvedValue(quiz());
  submitAttempt.mockResolvedValue(result());
  http.post.mockImplementation(async path => path === '/auth/login'
    ? { data: { accessToken: 'memory-only-token', user: { name: 'Student', role: 'student' } } }
    : { data: {} });
});
async function login() {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText('Email'), 'student@example.com');
  await user.type(screen.getByLabelText('Password'), 'Study1234');
  await user.click(screen.getByRole('button', { name: 'Sign in', exact: true }));
  return user;
}
test('requires real login, forwards token and renders server feedback after submission', async () => {
  const storage = jest.spyOn(Storage.prototype, 'setItem');
  render(<StudentAttemptPage quizId={quizId} />);
  expect(loadAttemptQuiz).not.toHaveBeenCalled();
  const user = await login();
  await screen.findByText('Database basics');
  expect(loadAttemptQuiz).toHaveBeenCalledWith(quizId, expect.objectContaining({ token: 'memory-only-token' }));
  await user.click(screen.getByRole('radio', { name: 'Primary key' }));
  await user.click(screen.getByRole('radio', { name: 'False' }));
  await user.click(screen.getByRole('button', { name: 'Submit attempt' }));
  expect(await screen.findByText('2/3')).toBeInTheDocument();
  expect(submitAttempt).toHaveBeenCalledWith(quizId,
    [{ questionId: 'q1', response: 0 }, { questionId: 'q2', response: false }],
    expect.objectContaining({ token: 'memory-only-token' }));
  expect(storage).not.toHaveBeenCalled();
  storage.mockRestore();
});
test('student can open a published quiz by ID from the entry route', async () => {
  render(<StudentAttemptPage />);
  const user = await login();
  expect(loadAttemptQuiz).not.toHaveBeenCalled();
  await user.type(screen.getByLabelText('Published quiz ID'), 'invalid');
  await user.click(screen.getByRole('button', { name: 'Open quiz' }));
  expect(screen.getByRole('alert')).toHaveTextContent('24 hexadecimal characters');
  await user.clear(screen.getByLabelText('Published quiz ID'));
  await user.type(screen.getByLabelText('Published quiz ID'), quizId);
  await user.click(screen.getByRole('button', { name: 'Open quiz' }));
  await screen.findByText('Database basics');
});
test('empty sign-in fields show inline validation and do not call the API', async () => {
  const user = userEvent.setup();
  render(<StudentAttemptPage quizId={quizId} />);
  await user.click(screen.getByRole('button', { name: 'Sign in', exact: true }));
  expect(screen.getByText('Email is required.')).toBeInTheDocument();
  expect(screen.getByText('Password is required.')).toBeInTheDocument();
  expect(http.post).not.toHaveBeenCalled();
});
test('educator login cannot enter the attempt screen', async () => {
  http.post.mockResolvedValue({ data: { accessToken: 'educator-token', user: { role: 'educator' } } });
  render(<StudentAttemptPage quizId={quizId} />);
  await login();
  expect(await screen.findByRole('status')).toHaveTextContent('Only students');
  expect(loadAttemptQuiz).not.toHaveBeenCalled();
});
test('401 clears the in-memory session and asks for sign-in', async () => {
  loadAttemptQuiz.mockRejectedValue({ response: { status: 401 } });
  render(<StudentAttemptPage quizId={quizId} />);
  await login();
  expect(await screen.findByText(/session has expired/i)).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: 'Sign in to attempt a quiz' })).toBeInTheDocument();
});
test('logout unmounts the attempt and a late result cannot restore feedback', async () => {
  let resolve;
  submitAttempt.mockImplementation(() => new Promise(done => { resolve = done; }));
  render(<StudentAttemptPage quizId={quizId} />);
  const user = await login();
  await screen.findByText('Database basics');
  fireEvent.click(screen.getByRole('button', { name: 'Submit attempt' }));
  await user.click(screen.getByRole('button', { name: 'Sign out' }));
  await act(async () => resolve(result()));
  expect(screen.queryByText('Your results')).not.toBeInTheDocument();
  expect(screen.getByRole('heading', { name: 'Sign in to attempt a quiz' })).toBeInTheDocument();
  expect(http.post).toHaveBeenCalledWith('/auth/logout');
});