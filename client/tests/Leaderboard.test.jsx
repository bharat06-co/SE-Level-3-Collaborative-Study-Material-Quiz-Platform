import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Leaderboard from '../src/features/leaderboard/Leaderboard';

test('switches quiz and topic rankings without a page reload and shows tied ranks', async () => {
  const user = userEvent.setup();
  const fetchQuizzes = jest.fn().mockResolvedValue([{ id: 'q1', title: 'DBMS basics' }]);
  const fetchRanking = jest.fn()
    .mockResolvedValueOnce({ items: [
      { rank: 1, studentId: 'a', name: 'A', score: 8 },
      { rank: 1, studentId: 'b', name: 'B', score: 8 },
      { rank: 3, studentId: 'c', name: 'C', score: 6 },
    ] })
    .mockResolvedValueOnce({ items: [{ rank: 1, studentId: 'a', name: 'A', score: 140 }] });
  render(<Leaderboard fetchQuizzes={fetchQuizzes} fetchRanking={fetchRanking} />);
  await user.selectOptions(await screen.findByLabelText('Choose a quiz'), 'q1');
  await user.click(screen.getByRole('button', { name: 'Show rankings' }));
  expect(await screen.findByText('Best quiz scores')).toBeInTheDocument();
  expect(screen.getAllByRole('row').slice(1).map((row) => row.cells[0].textContent)).toEqual(['1', '1', '3']);
  await user.click(screen.getByRole('button', { name: 'Topic' }));
  await user.type(screen.getByLabelText('Topic'), 'DBMS');
  await user.click(screen.getByRole('button', { name: 'Show rankings' }));
  expect(await screen.findByText('Sum of best quiz percentages')).toBeInTheDocument();
  expect(screen.getByText('140')).toBeInTheDocument();
  expect(fetchRanking).toHaveBeenNthCalledWith(1, { quizId: 'q1' });
  expect(fetchRanking).toHaveBeenNthCalledWith(2, { topic: 'DBMS' });
});

test('shows empty and error states', async () => {
  const user = userEvent.setup();
  const fetchQuizzes = jest.fn().mockResolvedValue([{ id: 'q1', title: 'DBMS basics' }]);
  const fetchRanking = jest.fn().mockResolvedValueOnce({ items: [] }).mockRejectedValueOnce(new Error('offline'));
  render(<Leaderboard fetchQuizzes={fetchQuizzes} fetchRanking={fetchRanking} />);
  await user.selectOptions(await screen.findByLabelText('Choose a quiz'), 'q1');
  await user.click(screen.getByRole('button', { name: 'Show rankings' }));
  expect(await screen.findByText('No attempts yet for this selection.')).toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'Show rankings' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('could not be loaded');
});
