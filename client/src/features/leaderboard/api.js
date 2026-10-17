import { http } from '../../api/http';

export async function loadLeaderboard(selection) {
  const response = await http.get('/leaderboard', { params: selection });
  return response.data;
}

export async function loadPublishedQuizzes() {
  const items = [];
  const seen = new Set();
  let page = 1;
  while (true) {
    const response = await http.get('/quizzes', { params: { status: 'published', limit: 50, page } });
    const batch = response.data.items;
    if (!Array.isArray(batch)) throw new Error('Invalid quiz page.');
    const before = seen.size;
    for (const quiz of batch) {
      if (!seen.has(quiz.id)) { seen.add(quiz.id); items.push(quiz); }
    }
    if (items.length >= response.data.total) return items;
    if (seen.size === before) throw new Error('Published quiz pages made no progress.');
    page += 1;
  }
}
