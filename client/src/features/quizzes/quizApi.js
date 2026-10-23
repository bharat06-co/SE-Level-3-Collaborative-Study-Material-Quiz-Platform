import { http } from '../../api/http';

function authorized(token) {
  if (typeof token !== 'string' || !token) throw new Error('Sign in before accessing quizzes.');
  return { headers: { Authorization: `Bearer ${token}` } };
}

export async function listDraftQuizzes(token, page = 1) {
  const response = await http.get('/quizzes', { ...authorized(token), params: { status: 'draft', page } });
  return response.data;
}

export async function getQuiz(id, token) {
  const response = await http.get(`/quizzes/${id}`, authorized(token));
  return response.data;
}

export async function saveQuiz(id, payload, token) {
  const response = id
    ? await http.put(`/quizzes/${id}`, payload, authorized(token))
    : await http.post('/quizzes', payload, authorized(token));
  return response.data;
}

export async function setQuizPublication(id, publish, token) {
  const response = await http.post(`/quizzes/${id}/${publish ? 'publish' : 'unpublish'}`, undefined, authorized(token));
  return response.data;
}
