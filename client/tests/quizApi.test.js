import { http } from '../src/api/http';
import { getQuiz, listDraftQuizzes, saveQuiz, setQuizPublication } from '../src/features/quizzes/quizApi';

test('quiz writes require and send a Bearer token', async () => {
  const post = jest.spyOn(http, 'post').mockResolvedValue({ data: { id: 'quiz-1' } });
  await expect(saveQuiz(null, {}, '')).rejects.toThrow('Sign in');
  expect(post).not.toHaveBeenCalled();

  await saveQuiz(null, { title: 'DBMS basics' }, 'access-token');
  expect(post).toHaveBeenCalledWith('/quizzes', { title: 'DBMS basics' }, {
    headers: { Authorization: 'Bearer access-token' },
  });
  await setQuizPublication('quiz-1', true, 'access-token');
  expect(post).toHaveBeenCalledWith('/quizzes/quiz-1/publish', undefined, {
    headers: { Authorization: 'Bearer access-token' },
  });
  post.mockRestore();
});

test('draft listing and quiz detail send the same Bearer credential', async () => {
  const get = jest.spyOn(http, 'get').mockResolvedValue({ data: { items: [] } });
  await listDraftQuizzes('access-token', 2);
  expect(get).toHaveBeenCalledWith('/quizzes', {
    headers: { Authorization: 'Bearer access-token' },
    params: { status: 'draft', page: 2 },
  });
  await getQuiz('quiz-1', 'access-token');
  expect(get).toHaveBeenCalledWith('/quizzes/quiz-1', {
    headers: { Authorization: 'Bearer access-token' },
  });
  get.mockRestore();
});
