import { http } from '../../api/http';

export async function fetchLeaderboard({ quizId, topic, token, page = 1 }) {
  if (typeof token !== 'string' || !token) throw new Error('Sign in before viewing leaderboards.');
  const params = { page, limit: 20, ...(quizId ? { quizId } : { topic }) };
  const response = await http.get('/leaderboard', {
    headers: { Authorization: `Bearer ${token}` }, params,
  });
  return response.data;
}
