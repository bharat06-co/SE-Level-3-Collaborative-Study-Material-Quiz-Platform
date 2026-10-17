import { http } from '../../api/http';

export async function saveQuiz(id, payload) {
  const response = id
    ? await http.put(`/quizzes/${id}`, payload)
    : await http.post('/quizzes', payload);
  return response.data;
}

export async function setQuizPublication(id, publish) {
  const response = await http.post(`/quizzes/${id}/${publish ? 'publish' : 'unpublish'}`);
  return response.data;
}
