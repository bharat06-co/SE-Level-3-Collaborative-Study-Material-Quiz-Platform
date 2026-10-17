import { http } from '../../api/http';

export async function loadLeaderboard(selection) {
  const response = await http.get('/leaderboard', { params: selection });
  return response.data;
}

export async function loadPublishedQuizzes() {
  const response = await http.get('/quizzes', { params: { status: 'published', limit: 50 } });
  return response.data.items;
}
