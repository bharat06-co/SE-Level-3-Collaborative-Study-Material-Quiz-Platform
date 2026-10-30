import { http } from '../src/api/http';
import { fetchLeaderboard } from '../src/features/quizzes/leaderboardApi';

test('leaderboard reads require a Bearer token and send one scope', async () => {
  const get = jest.spyOn(http, 'get').mockResolvedValue({ data: { items: [] } });
  await expect(fetchLeaderboard({ quizId: 'quiz', token: '' })).rejects.toThrow('Sign in');
  expect(get).not.toHaveBeenCalled();
  await fetchLeaderboard({ quizId: 'quiz', token: 'access-token' });
  expect(get).toHaveBeenCalledWith('/leaderboard', {
    headers: { Authorization: 'Bearer access-token' },
    params: { quizId: 'quiz', page: 1, limit: 20 },
  });
  await fetchLeaderboard({ topic: 'dbms', token: 'access-token', page: 2 });
  expect(get).toHaveBeenCalledWith('/leaderboard', {
    headers: { Authorization: 'Bearer access-token' },
    params: { topic: 'dbms', page: 2, limit: 20 },
  });
  get.mockRestore();
});
